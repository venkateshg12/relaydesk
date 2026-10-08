import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateWidgetSettingsSchema } from "@repo/types";
import {
  getWorkspaceSettingsApi,
  updateWorkspaceWidgetApi,
  type WorkspaceSettings,
} from "@/api/workspace";
import type { ApiError } from "@/lib/api";

export const useWorkspaceSettings = () => {
  const queryClient = useQueryClient();

  const query = useQuery<WorkspaceSettings, ApiError>({
    queryKey: ["workspace", "settings"],
    queryFn: async () => (await getWorkspaceSettingsApi()).data.settings,
  });

  const update = useMutation<
    Omit<WorkspaceSettings, "createdAt">,
    ApiError,
    UpdateWidgetSettingsSchema
  >({
    mutationFn: async (data) =>
      (await updateWorkspaceWidgetApi(data)).data.workspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData<WorkspaceSettings>(
        ["workspace", "settings"],
        (old) => old && { ...old, ...workspace },
      );
      toast.success("Widget settings saved");
    },
    onError: (error) => toast.error(error.message),
  });

  return { settings: query.data, isLoading: query.isLoading, update };
};
