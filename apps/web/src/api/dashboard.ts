import API from "@/lib/api";
import type { DashboardStats } from "@repo/types";
import type { ApiResponse } from "./auth";

// "Today" starts at midnight in the admin's own timezone, which only the browser knows.
export const getDashboardStatsApi = async (): Promise<
  ApiResponse<{ stats: DashboardStats }>
> => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const res = await API.get<ApiResponse<{ stats: DashboardStats }>>(
    "/dashboard",
    { params: { tz } },
  );
  return res.data;
};
