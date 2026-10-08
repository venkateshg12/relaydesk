import { useInfiniteQuery } from "@tanstack/react-query";
import type { ConversationSummary, PaginatedResult } from "@repo/types";
import { getConversationsApi, type GetConversationsParams } from "@/api/conversations";
import type { ApiError } from "@/lib/api";

// One inbox list (Unassigned, Mine, …), loaded a page at a time as the agent scrolls.
export const useConversations = (params: Omit<GetConversationsParams, "page"> = {}) =>
  useInfiniteQuery<PaginatedResult<ConversationSummary>, ApiError>({
    queryKey: ["conversations", params],
    queryFn: async ({ pageParam }) => (await getConversationsApi({ ...params, page: pageParam as number })).data,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined),
  });
