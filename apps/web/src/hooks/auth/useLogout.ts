import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logoutApi } from "@/api/auth";
import { useAppDispatch } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { clearUserQueries } from "@/lib/queryClient";
import { disconnectSocket } from "@/lib/socket";

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await logoutApi();
      return res.data;
    },
    onSettled: () => {
      // The session is gone, so end the live connection too, along with anything unsent.
      disconnectSocket();
      dispatch(clearAuth());
      clearUserQueries();
      queryClient.clear();
      router.push("/login");
    },
  });
};
