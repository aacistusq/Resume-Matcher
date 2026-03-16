import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  FileSearch,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  TrendingDown,
  BarChart3,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisResult } from "@workspace/api-client-react";

interface AnalysisResultViewProps {
  result: AnalysisResult;
}

function scoreBandColor(band: string) {
  switch (band) {
    case "Strong Fit":
      return { bg: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "Decent Fit":
      return { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700", dot: "bg-blue-500" };
    case "Partial Fit":
      return { bg: "bg-amber-50", border: "border-amber-500", text: "text-amber-700", dot: "bg-amber-500" };
    case "Weak Fit":
      return { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700", dot: "bg-orange-500" };
    default:
      return { bg: "bg-rose-50", border: "border-rose-500", text: "text-rose-700", dot: "bg-rose-500" };
  }
}

function scoreColor(score: number) {
  if (score >= 85) return { ring: "#10b981", text: "text-emerald-600" };
  if (score >= 70) return { ring: "#3b82f6", text: "text-blue-600" };
  if (score >= 50) return { ring: "#f59e0b", text: "text-amber-600" };
  if (score >= 30) return { ring: "#f97316", text: "text-orange-600" };
  return { ring: "#ef4444", text: "text-rose-600" };
}

interface ScoreRingProps {
  value: number;
  max?: number;
  label: string;
  size?: number;
}

function ScoreRing({ value, max = 100, label, size = 120 }: ScoreRingProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;
  const { ring, text } = scoreColor(pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            strokeWidth={strokeWidth}
            stroke="#f1f5f9"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <motion.circle
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
            stroke={ring}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={cn("font-bold tracking-tight", size > 100 ? "text-3xl" : "text-xl", text)}>
            {Math.round(value)}
            <span className="text-slate-400" style={{ fontSize: size > 100 ? "1.1rem" : "0.8rem" }}>
              {max === 100 ? "%" : `/${max}`}
            </span>
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface BreakdownRowProps {
  label: string;
  value: number;
  max: number;
  accent?: string;
}

function BreakdownRow({ label, value, max, accent = "bg-indigo-500" }: BreakdownRowProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">
          {Math.round(value * 10) / 10} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", accent)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function AnalysisResultView({ result }: AnalysisResultViewProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const bandColors = scoreBandColor(result.scoreBand);
  const bd = result.scoreBreakdown;
  const resumeQualityPct = Math.round((result.resumeQualityScore / 10) * 100);

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVars = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
  };

  return (
    <motion.div variants={containerVars} initial="hidden" animate="show" className="space-y-5 w-full">
      {/* ── Row 1: Scores + Band + Summary ── */}
      <motion.div variants={itemVars} className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Two score rings */}
          <div className="flex gap-8 shrink-0">
            <ScoreRing value={result.fitScore} label="Fit Score" size={120} />
            <ScoreRing value={resumeQualityPct} label="Resume Quality" size={120} />
          </div>

          {/* Band + summary */}
          <div className="flex-1 space-y-4">
            <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold", bandColors.bg, bandColors.border, bandColors.text)}>
              <div className={cn("w-2 h-2 rounded-full", bandColors.dot)} />
              {result.scoreBand}
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">
              <FileSearch className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
              <p>{result.summary}</p>
            </div>

            {result.confidenceLevel === "medium" && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Medium confidence — resume or job description may be incomplete.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Row 2: Score Breakdown (collapsible) ── */}
      {bd && (
        <motion.div variants={itemVars} className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Score Breakdown
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>
                Raw {bd.rawScoreBeforePenalties} → Penalties −{bd.penaltiesApplied}
                {bd.scoreCapApplied !== null && ` → Cap ${bd.scoreCapApplied}`}
                {" "}→ <span className="font-bold text-slate-800">{bd.finalScore}</span>
              </span>
              {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          <AnimatePresence>
            {showBreakdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scoring Components</p>
                      <BreakdownRow label="Must-Have Requirements" value={bd.mustHaveScore} max={40} accent="bg-indigo-500" />
                      <BreakdownRow label="Preferred Requirements" value={bd.preferredScore} max={15} accent="bg-violet-400" />
                      <BreakdownRow label="Experience Relevance" value={bd.experienceScore} max={20} accent="bg-blue-400" />
                      <BreakdownRow label="Evidence Strength" value={bd.evidenceScore} max={15} accent="bg-teal-400" />
                      <BreakdownRow label="Resume Quality" value={bd.resumeQualityScore} max={10} accent="bg-emerald-400" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requirement Coverage</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <p className="text-2xl font-bold text-emerald-600">{bd.matchedCount}</p>
                          <p className="text-xs text-emerald-600 font-medium">Matched</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                          <p className="text-2xl font-bold text-amber-600">{bd.partialCount}</p>
                          <p className="text-xs text-amber-600 font-medium">Partial</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                          <p className="text-2xl font-bold text-rose-600">{bd.missingCount}</p>
                          <p className="text-xs text-rose-600 font-medium">Missing</p>
                        </div>
                      </div>
                      {bd.penaltiesApplied > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Penalties</p>
                          <p className="text-sm font-semibold text-rose-600">−{bd.penaltiesApplied} pts applied</p>
                          {bd.missingCriticalCount > 0 && (
                            <p className="text-xs text-slate-500">{bd.missingCriticalCount} critical requirement{bd.missingCriticalCount > 1 ? "s" : ""} missing</p>
                          )}
                          {bd.scoreCapApplied !== null && (
                            <p className="text-xs text-slate-500">Score capped at {bd.scoreCapApplied}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Row 3: Why Not Higher ── */}
      {result.whyNotHigher && result.whyNotHigher.length > 0 && (
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-slate-800">Why this score isn't higher</h3>
          </div>
          <ul className="space-y-2">
            {result.whyNotHigher.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── Row 4: Skills grid ── */}
      <motion.div variants={itemVars} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Matched */}
        <div className="glass-card rounded-2xl p-5 border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-1.5" />
              Matched
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {result.matchedSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.matchedSkills.length > 0 ? (
              result.matchedSkills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {s}
                </span>
              ))
            ) : (
              <p className="text-slate-400 text-xs italic">None found</p>
            )}
          </div>
        </div>

        {/* Partial */}
        <div className="glass-card rounded-2xl p-5 border-t-4 border-t-amber-400">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center text-sm">
              <MinusCircle className="w-4 h-4 text-amber-500 mr-1.5" />
              Partial Match
            </h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {result.partialSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.partialSkills.length > 0 ? (
              result.partialSkills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  {s}
                </span>
              ))
            ) : (
              <p className="text-slate-400 text-xs italic">None found</p>
            )}
          </div>
        </div>

        {/* Missing */}
        <div className="glass-card rounded-2xl p-5 border-t-4 border-t-rose-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center text-sm">
              <XCircle className="w-4 h-4 text-rose-500 mr-1.5" />
              Missing
            </h3>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {result.missingSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.missingSkills.length > 0 ? (
              result.missingSkills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                  {s}
                </span>
              ))
            ) : (
              <p className="text-slate-400 text-xs italic">All skills present</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Row 5: Top Gaps ── */}
      {result.topGaps && result.topGaps.length > 0 && (
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-slate-800">Top Gaps to Address</h3>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.topGaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 bg-rose-50/50 border border-rose-100 rounded-xl px-3 py-2">
                <span className="text-rose-400 font-bold shrink-0 text-xs mt-0.5">{i + 1}.</span>
                {gap}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* ── Row 6: Suggestions ── */}
      {result.suggestions && result.suggestions.length > 0 && (
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center gap-2 mb-5">
            <div className="bg-amber-100 p-1.5 rounded-lg">
              <Lightbulb className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Improvement Suggestions</h3>
          </div>
          <div className="space-y-3">
            {result.suggestions.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                className="flex items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm"
              >
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs mr-3 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{s}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
