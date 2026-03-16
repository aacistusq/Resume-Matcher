import { 
  useAnalyzeResume, 
  useGetAnalysisHistory,
  getGetAnalysisHistoryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useAnalysisHistoryQuery(resumeId: number) {
  return useGetAnalysisHistory(resumeId, { 
    query: { enabled: !!resumeId } 
  });
}

export function useAnalyzeResumeMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useAnalyzeResume({
    mutation: {
      onSuccess: (data, variables) => {
        // Invalidate the history for the analyzed resume
        const resumeId = variables.data.resumeId;
        queryClient.invalidateQueries({ 
          queryKey: getGetAnalysisHistoryQueryKey(resumeId) 
        });
        toast({
          title: "Analysis Complete",
          description: "We've matched your resume to the job description.",
        });
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Analysis failed",
          description: err instanceof Error ? err.message : "Failed to analyze resume. Please try again.",
        });
      }
    }
  });
}
