import { 
  useListResumes, 
  useCreateResume, 
  useGetResume, 
  useDeleteResume,
  getListResumesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useResumesQuery() {
  return useListResumes();
}

export function useResumeQuery(id: number) {
  return useGetResume(id, { query: { enabled: !!id } });
}

export function useCreateResumeMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useCreateResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({
          title: "Resume uploaded",
          description: "Your resume has been saved successfully.",
        });
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Failed to upload resume.",
        });
      }
    }
  });
}

export function useDeleteResumeMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useDeleteResume({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
        toast({
          title: "Resume deleted",
          description: "The resume has been removed.",
        });
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "Failed to delete the resume.",
        });
      }
    }
  });
}
