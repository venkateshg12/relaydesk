import { useQuery } from "@tanstack/react-query";
import type { NoteItem } from "@repo/types";
import { getConversationNotesApi } from "@/api/conversations";
import type { ApiError } from "@/lib/api";

// Own key, not under ["conversations"], so a list invalidation doesn't also refetch every note.
export const useConversationNotes = (conversationId: string | null) =>
  useQuery<NoteItem[], ApiError>({
    queryKey: ["conversationNotes", conversationId],
    queryFn: async () =>
      (await getConversationNotesApi(conversationId!)).data.notes,
    enabled: Boolean(conversationId),
  });
