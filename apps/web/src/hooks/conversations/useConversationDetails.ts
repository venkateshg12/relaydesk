import { useQuery } from "@tanstack/react-query";
import type { ConversationDetail } from "@repo/types";
import { getConversationDetailsApi } from "@/api/conversations";
import type { ApiError } from "@/lib/api";

export const useConversationDetails = (id: string | null) =>
  useQuery<ConversationDetail, ApiError>({
    queryKey: ["conversation", id],
    queryFn: async () => (await getConversationDetailsApi(id!)).data,
    enabled: Boolean(id),
  });
