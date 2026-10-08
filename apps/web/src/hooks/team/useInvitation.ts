import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { AcceptInvitationSchema, InvitationDetails } from "@repo/types";
import { acceptInvitationApi, getInvitationDetailsApi } from "@/api/team";
import type { AuthSuccessData } from "@/api/auth";
import type { ApiError } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";

export const useInvitationDetails = (token: string) =>
  useQuery<InvitationDetails, ApiError>({
    queryKey: ["invitation", token],
    queryFn: async () => (await getInvitationDetailsApi(token)).data,
    retry: false,
    enabled: Boolean(token),
  });

export const useAcceptInvitation = (token: string) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthSuccessData, ApiError, AcceptInvitationSchema>({
    mutationFn: async (data) => (await acceptInvitationApi(token, data)).data,
    onSuccess: (data) => {
      // Seed /auth/me so AuthLoader doesn't act on an earlier "not logged in" result.
      queryClient.setQueryData(["auth", "me"], data);
      dispatch(setUser({ member: data.member, workspace: data.workspace }));
      router.push("/inbox");
    },
  });
};
