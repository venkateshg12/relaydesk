import API from "@/lib/api";
import type {
  AcceptInvitationSchema,
  InvitationDetails,
  InviteMemberSchema,
  MemberOption,
  PendingInvitation,
  TeamData,
} from "@repo/types";
import type { ApiResponse, AuthSuccessData } from "./auth";

export const getTeamApi = async (): Promise<ApiResponse<TeamData>> => {
  const res = await API.get<ApiResponse<TeamData>>("/team");
  return res.data;
};

export const getMemberOptionsApi = async (): Promise<
  ApiResponse<{ members: MemberOption[] }>
> => {
  const res =
    await API.get<ApiResponse<{ members: MemberOption[] }>>("/team/members");
  return res.data;
};

export const inviteMemberApi = async (
  data: InviteMemberSchema,
): Promise<ApiResponse<PendingInvitation>> => {
  const res = await API.post<ApiResponse<PendingInvitation>>(
    "/team/invitations",
    data,
  );
  return res.data;
};

export const revokeInvitationApi = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.delete<ApiResponse<{ message: string }>>(
    `/team/invitations/${id}`,
  );
  return res.data;
};

export const removeMemberApi = async (
  id: string,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.delete<ApiResponse<{ message: string }>>(
    `/team/members/${id}`,
  );
  return res.data;
};

export const getInvitationDetailsApi = async (
  token: string,
): Promise<ApiResponse<InvitationDetails>> => {
  const res = await API.get<ApiResponse<InvitationDetails>>(
    `/invitations/${token}`,
  );
  return res.data;
};

export const acceptInvitationApi = async (
  token: string,
  data: AcceptInvitationSchema,
): Promise<ApiResponse<AuthSuccessData>> => {
  const res = await API.post<ApiResponse<AuthSuccessData>>(
    `/invitations/${token}/accept`,
    data,
  );
  return res.data;
};
