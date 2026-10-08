import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ConversationDetail,
  ConversationSummary,
  CreateNoteSchema,
  NoteItem,
} from "@repo/types";
import {
  addConversationNoteApi,
  assignConversationApi,
  reopenConversationApi,
  resolveConversationApi,
  unassignConversationApi,
} from "@/api/conversations";
import type { ApiError } from "@/lib/api";

/*
  The agent's actions on a conversation. Each one is a single guarded UPDATE on the server, so the answer
  is either the new state or a 409 saying who got there first ("Already taken by Priya"). Whatever the
  answer, the cache is brought back in line with the server: the new row on success, a refetch on failure.
 */
export const useInboxMutations = () => {
  const queryClient = useQueryClient();

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["conversationCounts"] });
  };

  const useConversationAction = <TVariables>(
    action: (
      variables: TVariables,
    ) => Promise<{ data: { conversation: ConversationSummary } }>,
    idOf: (variables: TVariables) => string,
    successMessage: string,
  ) =>
    useMutation<ConversationSummary, ApiError, TVariables>({
      mutationFn: async (variables) =>
        (await action(variables)).data.conversation,
      onSuccess: (updated) => {
        queryClient.setQueryData<ConversationDetail>(
          ["conversation", updated.id],
          (old) => (old ? { ...old, ...updated } : old),
        );
        refreshLists();
        toast.success(successMessage);
      },
      onError: (error, variables) => {
        toast.error(error.message);
        // Someone else changed it first: show what it looks like now.
        void queryClient.invalidateQueries({
          queryKey: ["conversation", idOf(variables)],
        });
        refreshLists();
      },
    });

  const assignMutation = useConversationAction(
    ({ id, memberId }: { id: string; memberId?: string }) =>
      assignConversationApi(id, memberId),
    ({ id }) => id,
    "Conversation assigned",
  );
  const unassignMutation = useConversationAction(
    unassignConversationApi,
    (id: string) => id,
    "Moved back to Unassigned",
  );
  const resolveMutation = useConversationAction(
    resolveConversationApi,
    (id: string) => id,
    "Conversation resolved",
  );
  const reopenMutation = useConversationAction(
    reopenConversationApi,
    (id: string) => id,
    "Conversation reopened",
  );

  const addNoteMutation = useMutation<
    NoteItem,
    ApiError,
    { id: string; data: CreateNoteSchema }
  >({
    mutationFn: async ({ id, data }) =>
      (await addConversationNoteApi(id, data)).data.note,
    onSuccess: (note, { id }) => {
      // The `note:new` event can arrive first; the id keeps it from being added twice.
      queryClient.setQueryData<NoteItem[]>(
        ["conversationNotes", id],
        (old = []) =>
          old.some((existing) => existing.id === note.id)
            ? old
            : [...old, note],
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    assignMutation,
    unassignMutation,
    resolveMutation,
    reopenMutation,
    addNoteMutation,
  };
};
