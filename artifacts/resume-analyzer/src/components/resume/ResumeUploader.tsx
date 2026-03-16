import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractTextFromPDF } from "@/lib/pdf-parser";
import { useCreateResumeMutation } from "@/hooks/use-resumes";

interface ResumeUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (id: number) => void;
}

export function ResumeUploader({ open, onOpenChange, onSuccess }: ResumeUploaderProps) {
  const [activeTab, setActiveTab] = useState("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: createResume, isPending } = useCreateResumeMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!resumeName) {
        setResumeName(selected.name.replace(/\.[^/.]+$/, "")); // Strip extension
      }
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      let contentToSave = "";
      let finalFileName = "pasted-resume.txt";

      if (activeTab === "file" && file) {
        finalFileName = file.name;
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          contentToSave = await extractTextFromPDF(file);
        } else {
          // Assume text file
          contentToSave = await file.text();
        }
      } else if (activeTab === "paste") {
        contentToSave = pastedText;
      }

      if (!contentToSave.trim()) {
        throw new Error("Resume content is empty. Please upload a valid file or paste text.");
      }

      const result = await createResume({
        data: {
          name: resumeName || "My Resume",
          content: contentToSave,
          fileName: finalFileName,
        }
      });

      onOpenChange(false);
      
      // Reset state
      setFile(null);
      setPastedText("");
      setResumeName("");
      
      if (onSuccess && result.id) {
        onSuccess(result.id);
      }
      
    } catch (error) {
      console.error(error);
      // Toast is handled by the hook
    } finally {
      setIsProcessing(false);
    }
  };

  const isSaveDisabled = isProcessing || isPending || (activeTab === "file" ? !file : !pastedText.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-b from-indigo-50/50 to-white px-6 py-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-display text-indigo-950">Add Resume</DialogTitle>
            <DialogDescription className="text-slate-500">
              Upload your resume as a PDF/TXT or paste the content directly.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100/80 p-1 mb-6 rounded-xl">
              <TabsTrigger value="file" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Upload File</TabsTrigger>
              <TabsTrigger value="paste" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Paste Text</TabsTrigger>
            </TabsList>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resume-name" className="text-slate-700 font-semibold text-sm">Resume Name</Label>
                <Input 
                  id="resume-name" 
                  placeholder="e.g. Senior Frontend Engineer 2024"
                  value={resumeName}
                  onChange={(e) => setResumeName(e.target.value)}
                  className="bg-white border-slate-200 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 rounded-xl"
                />
              </div>

              <TabsContent value="file" className="mt-0">
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center",
                    file ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                  )}
                >
                  {file ? (
                    <div className="w-full flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="bg-indigo-100 p-2 rounded-md shrink-0">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="font-medium text-slate-700 truncate">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleClearFile} className="text-slate-400 hover:text-rose-500 shrink-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                        <Upload className="w-6 h-6 text-indigo-500" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-1">Click to upload document</h4>
                      <p className="text-xs text-slate-500 mb-4">PDF or TXT up to 5MB</p>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-white rounded-lg">
                        Select File
                      </Button>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                  />
                </div>
              </TabsContent>

              <TabsContent value="paste" className="mt-0">
                <Textarea 
                  placeholder="Paste your full resume text here..."
                  className="min-h-[200px] resize-none border-slate-200 bg-white focus-visible:ring-indigo-500/20 rounded-xl"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </TabsContent>
            </div>
          </Tabs>

          <div className="mt-8 flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaveDisabled}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 min-w-[120px]"
            >
              {isProcessing || isPending ? "Saving..." : "Save Resume"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
