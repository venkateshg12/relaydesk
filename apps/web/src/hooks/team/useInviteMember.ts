import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InviteMemberSchema, PendingInvitation } from "@repo/types";
import { inviteMemberApi } from "@/api/team";
import type { ApiError } from "@/lib/api";

export const useInviteMember = () => {
  const queryClient = useQueryClient();

  return useMutation<PendingInvitation, ApiError, InviteMemberSchema>({
    mutationFn: async (data) => (await inviteMemberApi(data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
};
