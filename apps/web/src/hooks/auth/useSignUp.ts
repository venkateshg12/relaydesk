import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { signUpApi, type SignUpPendingData } from "@/api/auth";
import type { SignUpSchema } from "@repo/types";
import type { ApiError } from "@/lib/api";

export const useSignUp = () => {
  const router = useRouter();

  return useMutation<SignUpPendingData, ApiError, SignUpSchema>({
    mutationFn: async (payload) => {
      const res = await signUpApi(payload);
      return res.data;
    },
    // Not signed in yet: the address has to be verified first, so the next stop is "check your email".
    onSuccess: ({ email }) => {
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    },
  });
};
