import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { loginApi, type AuthSuccessData } from "@/api/auth";
import type { LoginInSchema } from "@repo/types";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";
import type { ApiError } from "@/lib/api";

export const useLogin = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthSuccessData, ApiError, LoginInSchema>({
    mutationFn: async (credentials) => {
      const res = await loginApi(credentials);
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
