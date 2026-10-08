import { useQuery } from "@tanstack/react-query";
import { getSessionsApi, type SessionItem } from "@/api/auth";
import type { ApiError } from "@/lib/api";

export const useSessions = () => {
  return useQuery<SessionItem[], ApiError>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await getSessionsApi();
      return res.data;
    },
  });
};
