import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { verifyEmailApi, type AuthSuccessData } from "@/api/auth";
import { useAppDispatch } from "@/store/hooks";
import { setUser } from "@/store/slices/authSlice";
import type { ApiError } from "@/lib/api";

// Opening the emailed link proves the address is theirs, so the server also signs them in.
export const useVerifyEmail = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<AuthSuccessData, ApiError, string>({
    mutationFn: async (token) => {
      const res = await verifyEmailApi(token);
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
