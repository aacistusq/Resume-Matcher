import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Lightbulb, FileSearch } from "lucide-react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { AnalysisResult } from "@workspace/api-client-react";

interface AnalysisResultViewProps {
  result: AnalysisResult;
}

export function AnalysisResultView({ result }: AnalysisResultViewProps) {
  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVars} 
      initial="hidden" 
      animate="show" 
      className="space-y-6 w-full"
    >
      {/* Top Section: Score & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-display text-slate-800 mb-6">Match Score</h3>
          <RadialProgress value={result.matchScore} size={140} strokeWidth={12} />
        </motion.div>
        
        <motion.div variants={itemVars} className="md:col-span-2 glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center space-x-2 mb-4">
            <FileSearch className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-display text-slate-800">Executive Summary</h3>
          </div>
          <div className="bg-slate-50/50 rounded-xl p-4 flex-1 border border-slate-100">
            <p className="text-slate-600 leading-relaxed text-sm">
              {result.summary}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Skills Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matched Skills */}
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-slate-800 font-semibold flex items-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" />
              Matched Skills
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
              {result.matchedSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.matchedSkills.length > 0 ? (
              result.matchedSkills.map((skill, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-slate-500 text-sm italic">No relevant skills found.</p>
            )}
          </div>
        </motion.div>

        {/* Missing Skills */}
        <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 border-t-4 border-t-rose-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-slate-800 font-semibold flex items-center">
              <XCircle className="w-5 h-5 text-rose-500 mr-2" />
              Missing Skills
            </h3>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-full">
              {result.missingSkills.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.missingSkills.length > 0 ? (
              result.missingSkills.map((skill, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-slate-500 text-sm italic">You have all the required skills!</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Suggestions Section */}
      <motion.div variants={itemVars} className="glass-card rounded-2xl p-6 bg-gradient-to-br from-white to-indigo-50/30">
        <div className="flex items-center mb-6">
          <div className="bg-amber-100 p-2 rounded-lg mr-3">
            <Lightbulb className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-display text-xl text-slate-800 font-semibold">Actionable Suggestions</h3>
        </div>
        
        <div className="space-y-4">
          {result.suggestions.map((suggestion, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="flex items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs mr-4 mt-0.5">
                {i + 1}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{suggestion}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
