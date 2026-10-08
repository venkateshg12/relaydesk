import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeInvitationApi } from "@/api/team";
import type { ApiError } from "@/lib/api";

export const useRevokeInvitation = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, ApiError, string>({
    mutationFn: (id) => revokeInvitationApi(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
};
