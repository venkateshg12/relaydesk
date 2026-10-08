import API from "@/lib/api";
import type { UpdateWidgetSettingsSchema } from "@repo/types";
import type { ApiResponse } from "./auth";

export interface WorkspaceSettings {
  id: string;
  name: string;
  publicKey: string;
  widgetColor: string;
  greeting: string;
  awayMessage: string;
  createdAt: string;
}

export const getWorkspaceSettingsApi = async (): Promise<
  ApiResponse<{ settings: WorkspaceSettings }>
> => {
  const res = await API.get<ApiResponse<{ settings: WorkspaceSettings }>>(
    "/workspace/settings",
  );
  return res.data;
};

export const updateWorkspaceWidgetApi = async (
  data: UpdateWidgetSettingsSchema,
): Promise<
  ApiResponse<{ workspace: Omit<WorkspaceSettings, "createdAt"> }>
> => {
  const res = await API.patch<
    ApiResponse<{ workspace: Omit<WorkspaceSettings, "createdAt"> }>
  >("/workspace/widget", data);
  return res.data;
};
