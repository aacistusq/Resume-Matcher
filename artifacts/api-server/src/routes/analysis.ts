import { Router, type IRouter } from "express";
import { db, resumesTable, analysesTable } from "@workspace/db";
import { AnalyzeResumeBody, GetAnalysisHistoryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/analysis", async (req, res) => {
  try {
    const { resumeId, jobDescription } = AnalyzeResumeBody.parse(req.body);

    const [resume] = await db.select().from(resumesTable).where(eq(resumesTable.id, resumeId));
    if (!resume) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const prompt = `You are an expert resume reviewer and career coach. Analyze the following resume against the job description and provide a detailed assessment.

RESUME:
${resume.content}

JOB DESCRIPTION:
${jobDescription}

Provide your analysis in the following JSON format exactly (no markdown, just JSON):
{
  "matchScore": <number 0-100>,
  "matchedSkills": [<list of skills/qualifications from job description that appear in the resume>],
  "missingSkills": [<list of required/preferred skills from job description NOT found in resume>],
  "suggestions": [<list of 3-6 specific, actionable improvement suggestions for the resume>],
  "summary": "<2-3 sentence summary of the overall fit and key points>"
}

Be specific and accurate. Only list skills that are explicitly mentioned or clearly implied.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: "You are an expert resume reviewer. Always respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    
    let parsed: {
      matchScore: number;
      matchedSkills: string[];
      missingSkills: string[];
      suggestions: string[];
      summary: string;
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const [analysis] = await db
      .insert(analysesTable)
      .values({
        resumeId,
        jobDescription,
        matchScore: parsed.matchScore,
        matchedSkills: parsed.matchedSkills,
        missingSkills: parsed.missingSkills,
        suggestions: parsed.suggestions,
        summary: parsed.summary,
      })
      .returning();

    res.json({
      matchScore: parsed.matchScore,
      matchedSkills: parsed.matchedSkills,
      missingSkills: parsed.missingSkills,
      suggestions: parsed.suggestions,
      summary: parsed.summary,
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
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
