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

Matching rules:
- "matched" should only be used when the resume has direct, explicit, strong evidence for that requirement (clear mention of the skill, tool, domain, or responsibility with concrete context).
- "partial" should be used when there is some transferable or incomplete evidence, but not a clear one-to-one match.
- If there is no explicit evidence, mark the requirement as "missing" rather than inferring it.
- Broad analytics or data experience does NOT automatically count as:
  - specific domain expertise (e.g., healthcare, fintech, ads, gaming) unless clearly stated
  - specific tools like Python, dbt, Snowflake, or experimentation frameworks
  - stakeholder leadership, ownership, or product strategy
- Vague wording or generic buzzwords should not be treated as strong evidence.

Scoring intent:
- Weak or loosely related resumes should often land in the 30–55 range after backend scoring.
- Partial but somewhat relevant resumes should often land in the 50–69 range.
- Strong resumes with clear evidence across most must-haves can land in the 70–84 range.
- Only exceptional, highly aligned resumes should land in the 85+ range.

Important rules:
1. For every matched or partial requirement, provide exact evidence from the resume (quote phrases or summarize very specific bullets).
2. If there is no direct evidence, do not mark as matched.
3. Broad business or data experience does not automatically equal domain expertise or specific tools.
4. Only set "missing_core_domain" when the role strongly depends on domain experience and the resume clearly lacks it.
5. Missing critical requirements should be clearly reflected in the analysis.
6. Be strict about seniority mismatch.
7. Be strict about lack of quantified achievements.
8. Be strict about vague or generic resume bullets.
9. Be skeptical and avoid inflating numeric subscores.
10. Do not produce a final score — the backend will calculate it.
11. Return valid JSON only in the required schema.`;

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

Scoring rules for subscores (be strict and skeptical, avoid inflating these numbers):
- experience_relevance_score: 0–20. How directly relevant is the candidate's experience to this specific role?
  - 0–5 = weakly related or mostly unrelated background.
  - 6–10 = some transferable relevance but meaningful gaps in responsibilities, tools, or domain.
  - 11–15 = fairly relevant but not strong across all core areas (some must-haves or responsibilities are only partial).
  - 16–20 = strongly aligned role, responsibilities, and seniority with clear evidence across core requirements.
- evidence_strength_score: 0–15. How strong is the evidence in the resume?
  - 0–4 = vague claims, little proof, few specifics, mostly generic language.
  - 5–8 = some decent evidence but still generic or incomplete, limited quantified outcomes.
  - 9–12 = strong specific evidence with measurable outcomes, clear ownership and impact.
  - 13–15 = exceptional evidence quality with repeated strong proof and outcomes.
- resume_quality_score: 0–10. How clear, well-structured and ATS-friendly is the resume?
  - 0–3 = weak structure, hard to scan, vague bullets, or very cluttered.
  - 4–6 = decent but average clarity and structure; some bullets are still generic.
  - 7–8 = strong and clear ATS-friendly structure with mostly specific, readable bullets.
  - 9–10 = excellent clarity, communication, and structure; very easy to scan and understand.

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
    reasons.push(
      `Missing ${breakdown.missingCriticalCount} critical requirement${
        breakdown.missingCriticalCount > 1 ? "s" : ""
      }`
    );
  }
  if (flags.major_seniority_mismatch) {
    reasons.push("Seniority mismatch with the role level");
  }
  if (flags.missing_core_domain) {
    reasons.push("Domain mismatch or missing core domain expertise");
  }
  if (flags.no_quantified_achievements) {
    reasons.push("No quantified achievements or clear business impact");
  }
  if (flags.generic_resume_language) {
    reasons.push("Resume bullets are too generic or vague");
  }
  if (flags.largely_unrelated_background) {
    reasons.push("Candidate's background is largely unrelated to this role");
  }
  if (breakdown.scoreCapApplied !== null) {
    reasons.push(`Score capped at ${breakdown.scoreCapApplied} due to critical gaps`);
  }

  const missingMustHaves = (aiOutput.requirement_analysis.must_have ?? []).filter(
    (i) => i.status === "missing" && i.critical
  );

  const missingMustHaveReasons = missingMustHaves
    .map((i) => `No evidence of: ${i.requirement}`)
    .slice(0, 3);
  reasons.push(...missingMustHaveReasons);

  // Add more structured reasons derived from missing requirements and signals
  const missingPython = missingMustHaves.some((i) =>
    i.requirement.toLowerCase().includes("python")
  );
  if (missingPython) {
    reasons.push("No explicit evidence of Python experience");
  }

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
