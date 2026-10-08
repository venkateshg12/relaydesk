import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changePasswordApi } from "@/api/auth";
import type { ChangePasswordSchema } from "@repo/types";
import type { ApiError } from "@/lib/api";

export const useChangePassword = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiError, ChangePasswordSchema>({
    mutationFn: async (data: ChangePasswordSchema) => {
      const res = await changePasswordApi(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
};
