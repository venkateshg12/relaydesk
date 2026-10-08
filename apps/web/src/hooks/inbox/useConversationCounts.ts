import { useQuery } from "@tanstack/react-query";
import {
  getConversationCountsApi,
  type ConversationCounts,
} from "@/api/conversations";
import type { ApiError } from "@/lib/api";

// Own key, not under ["conversations"], so a list invalidation doesn't also refetch the counts.
export const useConversationCounts = () =>
  useQuery<ConversationCounts, ApiError>({
    queryKey: ["conversationCounts"],
    queryFn: async () => (await getConversationCountsApi()).data,
    refetchInterval: 10000,
  });
