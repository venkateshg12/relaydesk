import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardStats } from "@repo/types";
import { getDashboardStatsApi } from "@/api/dashboard";
import { getSocket } from "@/lib/socket";
import type { ApiError } from "@/lib/api";

const REFRESH_MS = 30_000;

// The numbers are cached on the server for 30 s, so asking more often gains nothing; who is online is read
// fresh each time, so a presence change refetches at once.
export const useDashboardStats = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const refresh = () =>
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    socket.on("presence:update", refresh);
    return () => void socket.off("presence:update", refresh);
  }, [queryClient]);

  return useQuery<DashboardStats, ApiError>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => (await getDashboardStatsApi()).data.stats,
    refetchInterval: REFRESH_MS,
  });
};
