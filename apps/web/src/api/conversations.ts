import API from "@/lib/api";
import type {
  ConversationDetail,
  ConversationListStatus,
  ConversationSummary,
  MessageItem,
  CreateNoteSchema,
  NoteItem,
  PaginatedResult,
} from "@repo/types";
import type { ApiResponse } from "./auth";

export interface GetConversationsParams {
  status?: ConversationListStatus;
  mine?: boolean;
  page?: number;
  limit?: number;
}

export interface ConversationCounts {
  unassigned: number;
  mine: number;
  allOpen: number;
  resolved: number;
  unreadMine: number;
  unreadUnassigned: number;
}

// Like every api/* module (the e-commerce convention), these return the response envelope;
// the hooks pick `.data` out of it.

export const getConversationsApi = async (
  params: GetConversationsParams = {},
): Promise<ApiResponse<PaginatedResult<ConversationSummary>>> => {
  const res = await API.get<ApiResponse<PaginatedResult<ConversationSummary>>>(
    "/conversations",
    { params },
  );
  return res.data;
};

export const getConversationCountsApi = async (): Promise<
  ApiResponse<ConversationCounts>
> => {
  const res = await API.get<ApiResponse<ConversationCounts>>(
    "/conversations/counts",
  );
  return res.data;
};

export const getConversationDetailsApi = async (
  id: string,
): Promise<ApiResponse<ConversationDetail>> => {
  const res = await API.get<ApiResponse<ConversationDetail>>(
    `/conversations/${id}`,
  );
  return res.data;
};

export const getConversationMessagesApi = async (
  id: string,
  params: { beforeSeq?: number; afterSeq?: number; limit?: number } = {},
): Promise<ApiResponse<{ messages: MessageItem[] }>> => {
  const res = await API.get<ApiResponse<{ messages: MessageItem[] }>>(
    `/conversations/${id}/messages`,
    { params },
  );
  return res.data;
};

type ConversationResponse = ApiResponse<{ conversation: ConversationSummary }>;

export const assignConversationApi = async (
  id: string,
  memberId?: string,
): Promise<ConversationResponse> => {
  const res = await API.post<ConversationResponse>(
    `/conversations/${id}/assign`,
    { memberId },
  );
  return res.data;
};

export const unassignConversationApi = async (
  id: string,
): Promise<ConversationResponse> => {
  const res = await API.post<ConversationResponse>(
    `/conversations/${id}/unassign`,
  );
  return res.data;
};

export const resolveConversationApi = async (
  id: string,
): Promise<ConversationResponse> => {
  const res = await API.post<ConversationResponse>(
    `/conversations/${id}/resolve`,
  );
  return res.data;
};

export const reopenConversationApi = async (
  id: string,
): Promise<ConversationResponse> => {
  const res = await API.post<ConversationResponse>(
    `/conversations/${id}/reopen`,
  );
  return res.data;
};

export const getConversationNotesApi = async (
  id: string,
): Promise<ApiResponse<{ notes: NoteItem[] }>> => {
  const res = await API.get<ApiResponse<{ notes: NoteItem[] }>>(
    `/conversations/${id}/notes`,
  );
  return res.data;
};

export const addConversationNoteApi = async (
  id: string,
  data: CreateNoteSchema,
): Promise<ApiResponse<{ note: NoteItem }>> => {
  const res = await API.post<ApiResponse<{ note: NoteItem }>>(
    `/conversations/${id}/notes`,
    data,
  );
  return res.data;
};
