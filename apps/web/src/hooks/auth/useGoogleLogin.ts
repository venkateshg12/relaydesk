import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { GoogleAuthSchema } from "@repo/types";
import { googleLoginApi, type AuthSuccessData } from "@/api/auth";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";
import type { ApiError } from "@/lib/api";

// "Continue with Google": log in, sign up (with `businessName`) or accept an invitation (with `invitationToken`).
export const useGoogleLogin = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthSuccessData, ApiError, GoogleAuthSchema>({
    mutationFn: async (payload) => (await googleLoginApi(payload)).data,
    onSuccess: (data) => {
      // Seed /auth/me so AuthLoader doesn't act on an earlier "not logged in" result.
      queryClient.setQueryData(["auth", "me"], data);
      dispatch(setUser({ member: data.member, workspace: data.workspace }));
      router.push("/inbox");
    },
  });
};
