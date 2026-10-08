import API from "@/lib/api";
import type {
  CreateSavedReplySchema,
  SavedReplyItem,
  UpdateSavedReplySchema,
} from "@repo/types";
import type { ApiResponse } from "./auth";

export const getSavedRepliesApi = async (): Promise<
  ApiResponse<{ savedReplies: SavedReplyItem[] }>
> => {
  const res =
    await API.get<ApiResponse<{ savedReplies: SavedReplyItem[] }>>(
      "/saved-replies",
    );
  return res.data;
};

export const createSavedReplyApi = async (
  data: CreateSavedReplySchema,
): Promise<ApiResponse<{ savedReply: SavedReplyItem }>> => {
  const res = await API.post<ApiResponse<{ savedReply: SavedReplyItem }>>(
    "/saved-replies",
    data,
  );
  return res.data;
};

export const updateSavedReplyApi = async (
  id: string,
  data: UpdateSavedReplySchema,
): Promise<ApiResponse<{ savedReply: SavedReplyItem }>> => {
  const res = await API.patch<ApiResponse<{ savedReply: SavedReplyItem }>>(
    `/saved-replies/${id}`,
    data,
  );
  return res.data;
};

export const deleteSavedReplyApi = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.delete<ApiResponse<{ message: string }>>(
    `/saved-replies/${id}`,
  );
  return res.data;
};
