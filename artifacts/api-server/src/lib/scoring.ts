export interface RequirementItem {
  requirement: string;
  status: "matched" | "partial" | "missing";
  evidence?: string;
  reasoning?: string;
  critical?: boolean;
  weight?: number;
}

export interface AIAnalysisOutput {
  requirement_analysis: {
    must_have: RequirementItem[];
    preferred: RequirementItem[];
    experience: RequirementItem[];
    domain: RequirementItem[];
    responsibilities: RequirementItem[];
  };
  subscores: {
    experience_relevance_score: number; // 0–20 (AI-provided)
    evidence_strength_score: number;    // 0–15 (AI-provided)
    resume_quality_score: number;       // 0–10 (AI-provided)
  };
  penalty_flags: {
    missing_critical_must_haves: number;  // count (AI-provided, used as hint; backend recalculates)
    major_seniority_mismatch: boolean;
    missing_core_domain: boolean;
    no_quantified_achievements: boolean;
    generic_resume_language: boolean;
    largely_unrelated_background: boolean;
  };
  fit_summary: {
    strong_matches: string[];
    partial_matches: string[];
    missing_core_requirements: string[];
    top_gaps: string[];
    top_improvements: string[];
    score_rationale: string;
  };
}

export interface ScoreBreakdown {
  mustHaveScore: number;
  preferredScore: number;
  experienceScore: number;
  evidenceScore: number;
  resumeQualityScore: number;
  penaltiesApplied: number;
  scoreCapApplied: number | null;
  rawScoreBeforePenalties: number;
  finalScore: number;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  missingCriticalCount: number;
  scoreBand: string;
}

function statusValue(status: string): number {
  if (status === "matched") return 1.0;
  if (status === "partial") return 0.5;
  return 0;
}

function defaultWeight(item: RequirementItem, section: string): number {
  // --- TUNE WEIGHTS HERE ---
  if (section === "must_have") return item.critical ? 3 : 2;
  if (section === "preferred") return 1;
  if (section === "experience") return 2;
  if (section === "domain") return 2;
  return 1; // responsibilities
}

function scoredSection(
  items: RequirementItem[],
  section: string,
  maxPoints: number
): number {
  if (!items || items.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of items) {
    const w = item.weight ?? defaultWeight(item, section);
    weightedSum += statusValue(item.status) * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? (weightedSum / totalWeight) * maxPoints : 0;
}

export function calculateScore(aiOutput: AIAnalysisOutput): ScoreBreakdown {
  const ra = aiOutput.requirement_analysis;
  const sub = aiOutput.subscores;
  const flags = aiOutput.penalty_flags;

  // --- SECTION WEIGHTS (tune here) ---
  // A. Must-have = 40 pts
  const mustHaves = ra.must_have ?? [];
  const mustHaveScore = scoredSection(mustHaves, "must_have", 40);

  // B. Preferred = 15 pts
  const preferredScore = scoredSection(ra.preferred ?? [], "preferred", 15);

  // C. Experience relevance = AI-provided 0–20
  const experienceScore = Math.min(20, Math.max(0, sub.experience_relevance_score ?? 0));

  // D. Evidence strength = AI-provided 0–15
  const evidenceScore = Math.min(15, Math.max(0, sub.evidence_strength_score ?? 0));

  // E. Resume quality = AI-provided 0–10
  const resumeQualityScore = Math.min(10, Math.max(0, sub.resume_quality_score ?? 0));

  const rawScore = mustHaveScore + preferredScore + experienceScore + evidenceScore + resumeQualityScore;

  // --- PENALTIES (tune here) ---
  let penalty = 0;
  let missingCriticalCount = 0;

  for (const item of mustHaves) {
    if (item.critical && item.status === "missing") missingCriticalCount++;
  }

  penalty += missingCriticalCount * 8;          // each missing critical must-have: -8
  if (flags.major_seniority_mismatch) penalty += 10;  // seniority mismatch: -10
  if (flags.missing_core_domain) penalty += 8;         // core domain missing: -8
  if (flags.no_quantified_achievements) penalty += 5;  // no metrics: -5
  if (flags.generic_resume_language) penalty += 5;     // vague bullets: -5
  if (flags.largely_unrelated_background) penalty += 12; // unrelated: -12

  let scoreAfterPenalties = Math.max(0, rawScore - penalty);

  // --- SCORE CAPS (tune here) ---
  let scoreCapApplied: number | null = null;

  // Cap at 65 if 2+ critical must-haves missing
  if (missingCriticalCount >= 2 && scoreAfterPenalties > 65) {
    scoreAfterPenalties = 65;
    scoreCapApplied = 65;
  }
  // Cap at 55 for major seniority mismatch
  if (flags.major_seniority_mismatch && scoreAfterPenalties > 55) {
    scoreAfterPenalties = 55;
    scoreCapApplied = scoreCapApplied !== null ? Math.min(scoreCapApplied, 55) : 55;
  }
  // Cap at 45 for largely unrelated background
  if (flags.largely_unrelated_background && scoreAfterPenalties > 45) {
    scoreAfterPenalties = 45;
    scoreCapApplied = scoreCapApplied !== null ? Math.min(scoreCapApplied, 45) : 45;
  }

  const finalScore = Math.round(scoreAfterPenalties);

  // Count statuses across all sections
  const allItems = [
    ...(ra.must_have ?? []),
    ...(ra.preferred ?? []),
    ...(ra.experience ?? []),
    ...(ra.domain ?? []),
    ...(ra.responsibilities ?? []),
  ];
  const matchedCount = allItems.filter((i) => i.status === "matched").length;
  const partialCount = allItems.filter((i) => i.status === "partial").length;
  const missingCount = allItems.filter((i) => i.status === "missing").length;

  // --- SCORE BANDS ---
  let scoreBand: string;
  if (finalScore >= 85) scoreBand = "Strong Fit";
  else if (finalScore >= 70) scoreBand = "Decent Fit";
  else if (finalScore >= 50) scoreBand = "Partial Fit";
  else if (finalScore >= 30) scoreBand = "Weak Fit";
  else scoreBand = "Poor Fit";

  return {
    mustHaveScore: Math.round(mustHaveScore * 10) / 10,
    preferredScore: Math.round(preferredScore * 10) / 10,
    experienceScore,
    evidenceScore,
    resumeQualityScore,
    penaltiesApplied: penalty,
    scoreCapApplied,
    rawScoreBeforePenalties: Math.round(rawScore * 10) / 10,
    finalScore,
    matchedCount,
    partialCount,
    missingCount,
    missingCriticalCount,
    scoreBand,
  };
}
