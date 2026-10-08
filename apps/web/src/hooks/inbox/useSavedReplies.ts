import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateSavedReplySchema, SavedReplyItem, UpdateSavedReplySchema } from "@repo/types";
import {
  createSavedReplyApi,
  deleteSavedReplyApi,
  getSavedRepliesApi,
  updateSavedReplyApi,
} from "@/api/savedReplies";
import type { ApiError } from "@/lib/api";

// Everyone reads the saved replies (the inbox picker); only admins write them (the admin screen).
export const useSavedReplies = () => {
  const queryClient = useQueryClient();

  const query = useQuery<SavedReplyItem[], ApiError>({
    queryKey: ["savedReplies"],
    queryFn: async () => (await getSavedRepliesApi()).data.savedReplies,
  });

  // After any change the list is simply re-read: the server keeps it sorted by shortcut.
  const refresh = (message: string) => () => {
    void queryClient.invalidateQueries({ queryKey: ["savedReplies"] });
    toast.success(message);
  };

  const create = useMutation<SavedReplyItem, ApiError, CreateSavedReplySchema>({
    mutationFn: async (data) => (await createSavedReplyApi(data)).data.savedReply,
    // Errors (a taken shortcut) stay in the dialog, next to the fields — never in a toast.
    onSuccess: refresh("Saved reply created"),
  });
  const update = useMutation<SavedReplyItem, ApiError, { id: string; data: UpdateSavedReplySchema }>({
    mutationFn: async ({ id, data }) => (await updateSavedReplyApi(id, data)).data.savedReply,
    onSuccess: refresh("Saved reply updated"),
  });
  const remove = useMutation<unknown, ApiError, string>({
    mutationFn: (id) => deleteSavedReplyApi(id),
    onSuccess: refresh("Saved reply deleted"),
    onError: (error) => toast.error(error.message),
  });

  return { savedReplies: query.data ?? [], isLoading: query.isLoading, create, update, remove };
};
