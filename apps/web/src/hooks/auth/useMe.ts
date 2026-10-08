import { useQuery } from "@tanstack/react-query";
import { getMeApi, type AuthSuccessData } from "@/api/auth";
import type { ApiError } from "@/lib/api";

export const useMe = () => {
  return useQuery<AuthSuccessData, ApiError>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await getMeApi();
      return res.data;
    },
    staleTime: 60 * 1000,
    retry: false,
  });
};
