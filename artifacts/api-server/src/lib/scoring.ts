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

// --- SCORING CONSTANTS (tune here) ---

const STATUS_PARTIAL_VALUE = 0.35;

const PENALTIES = {
  missingCriticalPerItem: 10, // each missing critical must-have: -10
  majorSeniorityMismatch: 10, // seniority mismatch: -10
  missingCoreDomain: 10, // core domain missing: -10
  noQuantifiedAchievements: 6, // no metrics: -6
  genericResumeLanguage: 6, // vague bullets: -6
  largelyUnrelatedBackground: 15, // unrelated: -15
} as const;

const SCORE_CAPS = {
  missingCriticalTwoOrMore: 60, // 2+ critical must-haves missing
  missingCriticalThreeOrMore: 50, // 3+ critical must-haves missing
  majorSeniorityMismatch: 55,
  largelyUnrelatedBackground: 40,
  missingCoreDomainStrongRole: 55,
  highScoreGuardCap: 79,
} as const;

function statusValue(status: string): number {
  if (status === "matched") return 1.0;
  if (status === "partial") return STATUS_PARTIAL_VALUE;
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
  let totalCriticalCount = 0;
  let matchedCriticalCount = 0;

  for (const item of mustHaves) {
    if (item.critical) {
      totalCriticalCount++;
      if (item.status === "missing") {
        missingCriticalCount++;
      }
      if (item.status === "matched") {
        matchedCriticalCount++;
      }
    }
  }

  penalty += missingCriticalCount * PENALTIES.missingCriticalPerItem;
  if (flags.major_seniority_mismatch) penalty += PENALTIES.majorSeniorityMismatch;
  if (flags.missing_core_domain) penalty += PENALTIES.missingCoreDomain;
  if (flags.no_quantified_achievements) penalty += PENALTIES.noQuantifiedAchievements;
  if (flags.generic_resume_language) penalty += PENALTIES.genericResumeLanguage;
  if (flags.largely_unrelated_background) penalty += PENALTIES.largelyUnrelatedBackground;

  let scoreAfterPenalties = Math.max(0, rawScore - penalty);

  // --- SCORE CAPS (tune here) ---
  let scoreCapApplied: number | null = null;

  // Cap at 60 if 2+ critical must-haves missing
  if (missingCriticalCount >= 2 && scoreAfterPenalties > SCORE_CAPS.missingCriticalTwoOrMore) {
    scoreAfterPenalties = SCORE_CAPS.missingCriticalTwoOrMore;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.missingCriticalTwoOrMore)
        : SCORE_CAPS.missingCriticalTwoOrMore;
  }
  // Cap at 50 if 3+ critical must-haves missing
  if (missingCriticalCount >= 3 && scoreAfterPenalties > SCORE_CAPS.missingCriticalThreeOrMore) {
    scoreAfterPenalties = SCORE_CAPS.missingCriticalThreeOrMore;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.missingCriticalThreeOrMore)
        : SCORE_CAPS.missingCriticalThreeOrMore;
  }
  // Cap at 55 for major seniority mismatch
  if (flags.major_seniority_mismatch && scoreAfterPenalties > SCORE_CAPS.majorSeniorityMismatch) {
    scoreAfterPenalties = SCORE_CAPS.majorSeniorityMismatch;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.majorSeniorityMismatch)
        : SCORE_CAPS.majorSeniorityMismatch;
  }
  // Cap at 40 for largely unrelated background
  if (flags.largely_unrelated_background && scoreAfterPenalties > SCORE_CAPS.largelyUnrelatedBackground) {
    scoreAfterPenalties = SCORE_CAPS.largelyUnrelatedBackground;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.largelyUnrelatedBackground)
        : SCORE_CAPS.largelyUnrelatedBackground;
  }
  // Cap at 55 when missing core domain and the role strongly depends on domain experience
  if (flags.missing_core_domain && scoreAfterPenalties > SCORE_CAPS.missingCoreDomainStrongRole) {
    scoreAfterPenalties = SCORE_CAPS.missingCoreDomainStrongRole;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.missingCoreDomainStrongRole)
        : SCORE_CAPS.missingCoreDomainStrongRole;
  }

  // Guard: prevent >80 scores unless the profile is truly strong
  const hasCriticalRequirements = totalCriticalCount > 0;
  const criticalMatchRatio = hasCriticalRequirements ? matchedCriticalCount / totalCriticalCount : 0;
  const canExceedEighty =
    (!hasCriticalRequirements || criticalMatchRatio >= 0.8) &&
    missingCriticalCount === 0 &&
    !flags.major_seniority_mismatch &&
    !flags.largely_unrelated_background &&
    evidenceScore >= 10 &&
    experienceScore >= 14;

  if (scoreAfterPenalties > 80 && !canExceedEighty) {
    scoreAfterPenalties = SCORE_CAPS.highScoreGuardCap;
    scoreCapApplied =
      scoreCapApplied !== null
        ? Math.min(scoreCapApplied, SCORE_CAPS.highScoreGuardCap)
        : SCORE_CAPS.highScoreGuardCap;
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
