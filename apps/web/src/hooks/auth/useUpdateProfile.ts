import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfileApi } from "@/api/auth";
import type { UpdateProfileSchema } from "@repo/types";
import type { ApiError } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { updateMember, type AuthMember } from "@/store/slices/authSlice";

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation<{ member: AuthMember }, ApiError, UpdateProfileSchema>({
    mutationFn: async (data: UpdateProfileSchema) => {
      const res = await updateProfileApi(data);
      return res.data;
    },
    onSuccess: (data) => {
      dispatch(updateMember(data.member));
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};
