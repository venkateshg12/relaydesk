import API from "@/lib/api";
import type { AuthMember, AuthWorkspace } from "@/store/slices/authSlice";
import type { ApiResponse } from "./auth";

export interface DemoSessionData {
  workspace: AuthWorkspace & { isDemo: true };
  member: Pick<AuthMember, "id" | "name" | "role">;
  expiresAt: string;
}

export interface DemoLiveStats {
  messagesDelivered: number;
  onlineNow: number;
}

// Creates the visitor's private workspace and signs them in as its admin (the response sets the cookies).
export const createDemoSessionApi = async (): Promise<
  ApiResponse<DemoSessionData>
> => {
  const res = await API.post<ApiResponse<DemoSessionData>>("/demo/session");
  return res.data;
};

export const getDemoStatsApi = async (): Promise<
  ApiResponse<DemoLiveStats>
> => {
  const res = await API.get<ApiResponse<DemoLiveStats>>("/demo/stats");
  return res.data;
};
