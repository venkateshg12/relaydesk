import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSessionApi } from "@/api/auth";
import type { ApiError } from "@/lib/api";

export const useRevokeSession = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: async (sessionId: string) => {
      const res = await deleteSessionApi(sessionId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
};
