import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMemberApi } from "@/api/team";
import type { ApiError } from "@/lib/api";

export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) => removeMemberApi(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
};
