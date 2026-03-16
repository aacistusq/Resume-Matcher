import { Router, type IRouter } from "express";
import { db, resumesTable, analysesTable } from "@workspace/db";
import { AnalyzeResumeBody, GetAnalysisHistoryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { calculateScore, type AIAnalysisOutput, type ScoreBreakdown } from "../lib/scoring.js";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a strict ATS resume scoring analyst.

Your task is to compare a candidate's resume against a job description and return structured evidence-based analysis.

Be conservative and skeptical.
Do not reward general similarity unless there is direct evidence in the resume.
Do not infer tools, technologies, or responsibilities unless explicitly mentioned or strongly evidenced.
If a requirement is only somewhat reflected, classify it as partial, not matched.
If there is no clear evidence, classify it as missing.

Scoring intent:
- Weak or loosely related resumes should often land in the 30–55 range after backend scoring
- Partial but somewhat relevant resumes should often land in the 50–69 range
- Strong resumes with clear evidence across most must-haves can land in the 70–84 range
- Only exceptional, highly aligned resumes should land in the 85+ range

Important rules:
1. For every matched or partial requirement, provide exact evidence from the resume
2. If there is no direct evidence, do not mark as matched
3. Broad business analytics experience does not automatically equal domain expertise
4. Broad data experience does not automatically mean Python, dbt, Snowflake, experimentation, or stakeholder leadership
5. Missing critical requirements should be clearly reflected in the analysis
6. Be strict about seniority mismatch
7. Be strict about lack of quantified achievements
8. Be strict about vague or generic resume bullets
9. Do not produce a final score — the backend will calculate it
10. Return valid JSON only in the required schema`;

function buildPrompt(resumeContent: string, jobDescription: string): string {
  return `Compare the following resume against the job description. Return structured JSON only — no commentary, no markdown.

RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescription}

Return this exact JSON structure (all fields required):
{
  "job_analysis": {
    "must_have_skills": [],
    "preferred_skills": [],
    "required_experience": [],
    "domain_requirements": [],
    "seniority_level": "",
    "key_responsibilities": [],
    "qualifications_or_certifications": [],
    "tools_and_technologies": []
  },
  "requirement_analysis": {
    "must_have": [
      {
        "requirement": "",
        "status": "matched|partial|missing",
        "evidence": "",
        "reasoning": "",
        "critical": true,
        "weight": 2
      }
    ],
    "preferred": [
      {
        "requirement": "",
        "status": "matched|partial|missing",
        "evidence": "",
        "reasoning": "",
        "weight": 1
      }
    ],
    "experience": [
      {
        "requirement": "",
        "status": "matched|partial|missing",
        "evidence": "",
        "reasoning": "",
        "weight": 2
      }
    ],
    "domain": [
      {
        "requirement": "",
        "status": "matched|partial|missing",
        "evidence": "",
        "reasoning": "",
        "weight": 2
      }
    ],
    "responsibilities": [
      {
        "requirement": "",
        "status": "matched|partial|missing",
        "evidence": "",
        "reasoning": "",
        "weight": 1
      }
    ]
  },
  "subscores": {
    "experience_relevance_score": 0,
    "evidence_strength_score": 0,
    "resume_quality_score": 0
  },
  "penalty_flags": {
    "missing_critical_must_haves": 0,
    "major_seniority_mismatch": false,
    "missing_core_domain": false,
    "no_quantified_achievements": false,
    "generic_resume_language": false,
    "largely_unrelated_background": false
  },
  "fit_summary": {
    "strong_matches": [],
    "partial_matches": [],
    "missing_core_requirements": [],
    "top_gaps": [],
    "top_improvements": [],
    "score_rationale": ""
  }
}

Scoring rules for subscores:
- experience_relevance_score: 0–20. How directly relevant is the candidate's experience to this specific role?
- evidence_strength_score: 0–15. How strong is the evidence? Consider: quantified achievements, specificity, ownership language, proven tools, business outcomes.
- resume_quality_score: 0–10. How clear, well-structured and ATS-friendly is the resume? Consider: clarity, formatting, bullet quality, lack of fluff.

For must_have items, set critical: true for hard requirements (certifications, specific technologies, minimum experience levels).
Use weight 3 for the most critical must-have items, 2 for normal must-haves.
Use weight 1 for all preferred items.
Use weight 2 for experience and domain requirements.
Use weight 1 for responsibilities.`;
}

function extractMatchedSkills(aiOutput: AIAnalysisOutput): string[] {
  const ra = aiOutput.requirement_analysis;
  const all = [
    ...(ra.must_have ?? []),
    ...(ra.preferred ?? []),
    ...(ra.experience ?? []),
    ...(ra.domain ?? []),
  ];
  return all
    .filter((i) => i.status === "matched")
    .map((i) => i.requirement)
    .slice(0, 20);
}

function extractPartialSkills(aiOutput: AIAnalysisOutput): string[] {
  const ra = aiOutput.requirement_analysis;
  const all = [
    ...(ra.must_have ?? []),
    ...(ra.preferred ?? []),
    ...(ra.experience ?? []),
    ...(ra.domain ?? []),
  ];
  return all
    .filter((i) => i.status === "partial")
    .map((i) => i.requirement)
    .slice(0, 15);
}

function extractMissingSkills(aiOutput: AIAnalysisOutput): string[] {
  const ra = aiOutput.requirement_analysis;
  const all = [
    ...(ra.must_have ?? []),
    ...(ra.preferred ?? []),
    ...(ra.domain ?? []),
  ];
  return all
    .filter((i) => i.status === "missing")
    .map((i) => i.requirement)
    .slice(0, 20);
}

function buildWhyNotHigher(
  aiOutput: AIAnalysisOutput,
  breakdown: ScoreBreakdown
): string[] {
  const reasons: string[] = [];
  const flags = aiOutput.penalty_flags;

  if (breakdown.missingCriticalCount > 0) {
    reasons.push(`${breakdown.missingCriticalCount} critical requirement${breakdown.missingCriticalCount > 1 ? "s" : ""} missing`);
  }
  if (flags.major_seniority_mismatch) {
    reasons.push("Significant seniority mismatch with the role level");
  }
  if (flags.missing_core_domain) {
    reasons.push("Core domain expertise required by the role is not demonstrated");
  }
  if (flags.no_quantified_achievements) {
    reasons.push("Resume lacks quantified achievements and metrics");
  }
  if (flags.generic_resume_language) {
    reasons.push("Resume uses generic or vague language that doesn't stand out");
  }
  if (flags.largely_unrelated_background) {
    reasons.push("Candidate's background is largely unrelated to this role");
  }
  if (breakdown.scoreCapApplied !== null) {
    reasons.push(`Score capped at ${breakdown.scoreCapApplied} due to critical gaps`);
  }

  const missingMustHaves = (aiOutput.requirement_analysis.must_have ?? [])
    .filter((i) => i.status === "missing" && i.critical)
    .map((i) => `No evidence of: ${i.requirement}`)
    .slice(0, 3);
  reasons.push(...missingMustHaves);

  return reasons.slice(0, 6);
}

function detectConfidence(
  resumeContent: string,
  jobDescription: string
): { level: string; warnings: string[] } {
  const warnings: string[] = [];

  if (resumeContent.trim().length < 200) {
    warnings.push("Resume text is very short — extraction may be incomplete");
  }
  if (jobDescription.trim().length < 100) {
    warnings.push("Job description is very short — analysis may be limited");
  }

  if (warnings.length > 0) return { level: "low", warnings };
  if (resumeContent.trim().length < 500 || jobDescription.trim().length < 300) {
    return { level: "medium", warnings };
  }
  return { level: "high", warnings };
}

router.post("/analysis", async (req, res) => {
  try {
    const { resumeId, jobDescription } = AnalyzeResumeBody.parse(req.body);

    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const { level: confidenceLevel, warnings } = detectConfidence(resume.content, jobDescription);

    if (confidenceLevel === "low") {
      res.status(422).json({
        error: "Low confidence",
        warnings,
        message: warnings.join(". "),
      });
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(resume.content, jobDescription) },
      ],
    });

    const rawContent = response.choices[0]?.message?.content ?? "{}";

    let aiOutput: AIAnalysisOutput;
    try {
      aiOutput = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiOutput = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    // Deterministic scoring — no LLM score used
    const breakdown = calculateScore(aiOutput);

    const matchedSkills = extractMatchedSkills(aiOutput);
    const partialSkills = extractPartialSkills(aiOutput);
    const missingSkills = extractMissingSkills(aiOutput);
    const topGaps = (aiOutput.fit_summary?.top_gaps ?? []).slice(0, 6);
    const suggestions = (aiOutput.fit_summary?.top_improvements ?? []).slice(0, 6);
    const summary = aiOutput.fit_summary?.score_rationale ?? "";
    const scoreRationale = aiOutput.fit_summary?.score_rationale ?? "";
    const whyNotHigher = buildWhyNotHigher(aiOutput, breakdown);

    const [analysis] = await db
      .insert(analysesTable)
      .values({
        resumeId,
        jobDescription,
        matchScore: breakdown.finalScore,
        fitScore: breakdown.finalScore,
        resumeQualityScore: breakdown.resumeQualityScore,
        scoreBand: breakdown.scoreBand,
        scoreBreakdown: breakdown as unknown as Record<string, unknown>,
        scoreRationale,
        matchedSkills,
        partialSkills,
        missingSkills,
        topGaps,
        whyNotHigher,
        suggestions,
        summary: summary || "Analysis complete.",
        confidenceLevel,
      })
      .returning();

    res.json({
      fitScore: breakdown.finalScore,
      resumeQualityScore: breakdown.resumeQualityScore,
      scoreBand: breakdown.scoreBand,
      scoreBreakdown: breakdown,
      matchedSkills,
      partialSkills,
      missingSkills,
      topGaps,
      whyNotHigher,
      suggestions,
      summary: summary || "Analysis complete.",
      scoreRationale,
      confidenceLevel,
      analysisId: analysis.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.get("/analysis/history/:resumeId", async (req, res) => {
  try {
    const { resumeId } = GetAnalysisHistoryParams.parse({ resumeId: Number(req.params.resumeId) });
    const history = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.resumeId, resumeId))
      .orderBy(analysesTable.createdAt);

    // Map to the new shape, falling back for legacy rows that predate the schema change
    const mapped = history.map((r) => ({
      id: r.id,
      resumeId: r.resumeId,
      jobDescription: r.jobDescription,
      fitScore: r.fitScore ?? r.matchScore,
      resumeQualityScore: r.resumeQualityScore ?? 0,
      scoreBand: r.scoreBand ?? scoreBandFromScore(r.fitScore ?? r.matchScore),
      scoreBreakdown: r.scoreBreakdown ?? null,
      matchedSkills: r.matchedSkills ?? [],
      partialSkills: r.partialSkills ?? [],
      missingSkills: r.missingSkills ?? [],
      topGaps: r.topGaps ?? [],
      whyNotHigher: r.whyNotHigher ?? [],
      suggestions: r.suggestions ?? [],
      summary: r.summary,
      scoreRationale: r.scoreRationale ?? r.summary,
      confidenceLevel: r.confidenceLevel ?? "unknown",
      createdAt: r.createdAt,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

function scoreBandFromScore(score: number): string {
  if (score >= 85) return "Strong Fit";
  if (score >= 70) return "Decent Fit";
  if (score >= 50) return "Partial Fit";
  if (score >= 30) return "Weak Fit";
  return "Poor Fit";
}

export default router;
