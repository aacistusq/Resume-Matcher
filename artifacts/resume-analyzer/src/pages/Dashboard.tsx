import React, { useState, useEffect } from "react";
import { Sparkles, Briefcase, FileSearch, ArrowRight, History, ChevronLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnalysisResultView } from "@/components/analysis/AnalysisResultView";
import { useResumeQuery } from "@/hooks/use-resumes";
import { useAnalyzeResumeMutation, useAnalysisHistoryQuery } from "@/hooks/use-analysis";
import { AnalysisResult } from "@workspace/api-client-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [jobDescription, setJobDescription] = useState("");
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Get active resume from URL
  const resumeIdParam = new URLSearchParams(window.location.search).get("resume");
  const resumeId = resumeIdParam ? parseInt(resumeIdParam, 10) : null;

  const { data: resume, isLoading: isLoadingResume } = useResumeQuery(resumeId || 0);
  const { data: history } = useAnalysisHistoryQuery(resumeId || 0);
  const { mutateAsync: analyze, isPending: isAnalyzing } = useAnalyzeResumeMutation();

  // Reset result when resume changes
  useEffect(() => {
    setCurrentResult(null);
    setJobDescription("");
    setShowHistory(false);
  }, [resumeId]);

  const handleAnalyze = async () => {
    if (!resumeId || !jobDescription.trim()) return;
    
    try {
      const result = await analyze({
        data: {
          resumeId,
          jobDescription
        }
      });
      setCurrentResult(result);
      setShowHistory(false);
    } catch (e) {
      // Error handled by hook toast
    }
  };

  // Render empty state if no resume selected
  if (!resumeId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
          {/* using empty-state.png declared in requirements */}
          <img 
            src={`${import.meta.env.BASE_URL}images/empty-state.png`} 
            alt="Empty state" 
            className="w-48 h-48 mb-8 object-contain animate-float drop-shadow-2xl opacity-90"
          />
          <h2 className="text-3xl font-display font-bold text-slate-800 mb-4">Ready to find your match?</h2>
          <p className="text-slate-500 text-lg leading-relaxed mb-8">
            Upload a resume from the sidebar to start comparing it against job descriptions and get actionable AI suggestions.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingResume) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-40 bg-slate-200/50 rounded-2xl w-full" />
          <div className="h-64 bg-slate-200/50 rounded-2xl w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
            Analyze Resume
          </h1>
          <p className="text-slate-500 mt-1 flex items-center">
            Targeting <span className="font-semibold text-indigo-600 ml-1 bg-indigo-50 px-2 py-0.5 rounded-md">{resume?.name}</span>
          </p>
        </div>
        
        {history && history.length > 0 && (
          <Button 
            variant="outline" 
            className="bg-white rounded-xl shadow-sm hover:bg-slate-50 shrink-0"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? <ChevronLeft className="w-4 h-4 mr-2" /> : <History className="w-4 h-4 mr-2" />}
            {showHistory ? "Back to Analysis" : "View Past Analyses"}
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-display font-bold text-slate-800">Analysis History</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {history?.map((record) => (
                <div key={record.id} className="glass-card p-5 rounded-2xl cursor-pointer hover:border-indigo-300 transition-all group"
                  onClick={() => {
                    setCurrentResult({
                      matchScore: record.matchScore,
                      matchedSkills: record.matchedSkills,
                      missingSkills: record.missingSkills,
                      suggestions: record.suggestions,
                      summary: record.summary,
                      analysisId: record.id
                    });
                    setShowHistory(false);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-700 font-bold font-display border border-indigo-100">
                        {record.matchScore}%
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 line-clamp-1">{record.jobDescription.substring(0, 40)}...</p>
                        <p className="text-xs text-slate-500">{format(new Date(record.createdAt), "MMM d, yyyy • h:mm a")}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-4 h-4 text-indigo-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analyzer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {!currentResult && (
              <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                
                <div className="relative z-10">
                  <label className="flex items-center text-lg font-display font-semibold text-slate-800 mb-4">
                    <Briefcase className="w-5 h-5 mr-2 text-indigo-600" />
                    Paste Job Description
                  </label>
                  <Textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the target role's job description here. We'll extract the required skills and compare them against your resume..."
                    className="min-h-[240px] resize-none bg-white/60 border-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl shadow-inner text-base p-5 transition-all"
                  />
                  
                  <div className="mt-6 flex justify-end">
                    <Button 
                      size="lg" 
                      onClick={handleAnalyze}
                      disabled={!jobDescription.trim() || isAnalyzing}
                      className="rounded-xl px-8 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all duration-300 font-semibold text-base"
                    >
                      {isAnalyzing ? (
                        <>
                          <Sparkles className="w-5 h-5 mr-2 animate-pulse text-indigo-200" />
                          Analyzing Match...
                        </>
                      ) : (
                        <>
                          <FileSearch className="w-5 h-5 mr-2" />
                          Analyze Resume
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isAnalyzing && !currentResult && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-display font-semibold text-slate-800 animate-pulse">
                  AI is reviewing your resume...
                </h3>
              </div>
            )}

            {currentResult && !isAnalyzing && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 font-medium">
                    Analysis complete. Want to try another job description?
                  </p>
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={() => {
                      setCurrentResult(null);
                      setJobDescription("");
                    }}
                  >
                    Start New Analysis
                  </Button>
                </div>
                
                <AnalysisResultView result={currentResult} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
