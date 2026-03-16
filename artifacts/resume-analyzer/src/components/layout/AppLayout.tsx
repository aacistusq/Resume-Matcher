import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Briefcase, Menu, FileText, Plus, X, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResumesQuery, useDeleteResumeMutation } from "@/hooks/use-resumes";
import { ResumeUploader } from "@/components/resume/ResumeUploader";
import { format } from "date-fns";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const { data: resumes, isLoading } = useResumesQuery();
  const { mutate: deleteResume } = useDeleteResumeMutation();

  const handleCreateSuccess = (newId: number) => {
    setLocation(`/?resume=${newId}`);
  };

  const currentResumeId = new URLSearchParams(window.location.search).get("resume");

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-display font-bold text-slate-900 tracking-tight text-gradient">
            ResuMatch AI
          </h1>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-slate-500" />
          </Button>
        </div>

        <div className="p-4">
          <Button 
            className="w-full justify-start rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 shadow-sm transition-all"
            onClick={() => setUploaderOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Resume
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Resumes
          </div>
          
          {isLoading ? (
            <div className="px-3 py-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : resumes?.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No resumes yet</p>
            </div>
          ) : (
            resumes?.map(resume => {
              const isActive = currentResumeId === String(resume.id);
              return (
                <div 
                  key={resume.id}
                  className={cn(
                    "group flex items-center w-full p-3 rounded-xl transition-all cursor-pointer",
                    isActive 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                  onClick={() => {
                    setLocation(`/?resume=${resume.id}`);
                    setSidebarOpen(false);
                  }}
                >
                  <FileText className={cn("w-4 h-4 mr-3 shrink-0", isActive ? "text-indigo-200" : "text-slate-400 group-hover:text-indigo-500")} />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">{resume.name}</p>
                    <p className={cn("text-xs truncate", isActive ? "text-indigo-200" : "text-slate-400")}>
                      {format(new Date(resume.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "opacity-0 group-hover:opacity-100 shrink-0 w-8 h-8 ml-2 rounded-lg transition-opacity",
                      isActive ? "hover:bg-indigo-700 text-white" : "hover:bg-rose-100 text-slate-400 hover:text-rose-600"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this resume?")) deleteResume({ id: resume.id });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Abstract Background Image */}
        <div 
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-multiply bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-bg.png)` }}
        />

        <header className="h-16 flex items-center px-4 sm:px-6 lg:px-8 border-b border-slate-200/50 bg-white/50 backdrop-blur-md z-10 sticky top-0">
          <Button variant="ghost" size="icon" className="mr-4 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-slate-700" />
          </Button>
          <div className="flex-1" />
          {/* Could add user profile here if auth was present */}
        </header>
        
        <div className="flex-1 overflow-y-auto z-10 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <ResumeUploader 
        open={uploaderOpen} 
        onOpenChange={setUploaderOpen} 
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
