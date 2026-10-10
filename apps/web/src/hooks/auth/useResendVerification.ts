import { useMutation } from "@tanstack/react-query";
import { resendVerificationApi } from "@/api/auth";
import type { ApiError } from "@/lib/api";

// The answer is the same whether or not the address exists, so the page can say "if it exists" and mean it.
export const useResendVerification = () =>
  useMutation<string, ApiError, string>({
    mutationFn: async (email) => (await resendVerificationApi(email)).data.message,
  });
