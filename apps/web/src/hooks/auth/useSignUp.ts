import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { signUpApi, type AuthSuccessData } from "@/api/auth";
import type { SignUpSchema } from "@repo/types";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";
import type { ApiError } from "@/lib/api";

export const useSignUp = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthSuccessData, ApiError, SignUpSchema>({
    mutationFn: async (payload) => {
      const res = await signUpApi(payload);
      return res.data;
    },
    onSuccess: (data) => {
      // Seed /auth/me so AuthLoader doesn't act on an earlier "not logged in" result.
      queryClient.setQueryData(["auth", "me"], data);
      dispatch(setUser({ member: data.member, workspace: data.workspace }));
      router.push("/inbox");
    },
  });
};
