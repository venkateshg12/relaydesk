import API from "@/lib/api";
import type {
  LoginInSchema,
  SignUpSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
  GoogleAuthSchema,
} from "@repo/types";
import type { AuthMember, AuthWorkspace } from "@/store/slices/authSlice";

export interface ApiResponse<T> {
  status: "success" | "error";
  data: T;
  meta?: Record<string, unknown>;
  errors?: Array<{ message: string; code?: string; path?: string }>;
}

export interface AuthSuccessData {
  member: AuthMember;
  workspace: AuthWorkspace;
  message?: string;
}

// Sign-up signs nobody in: it answers that a verification link was emailed (see `verifyEmailApi`).
export interface SignUpPendingData {
  email: string;
  requiresVerification: true;
  message?: string;
}

export interface SessionItem {
  id: string;
  userAgent?: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export const signUpApi = async (
  data: SignUpSchema,
): Promise<ApiResponse<SignUpPendingData>> => {
  const res = await API.post<ApiResponse<SignUpPendingData>>(
    "/auth/signup",
    data,
  );
  return res.data;
};

// POST, not GET: mail scanners open the links in an email, and a GET would let them use up the single-use token.
// Success also signs the person in (the server sets the cookies).
export const verifyEmailApi = async (
  token: string,
): Promise<ApiResponse<AuthSuccessData>> => {
  const res = await API.post<ApiResponse<AuthSuccessData>>(
    "/auth/verify-email",
    { token },
  );
  return res.data;
};

export const resendVerificationApi = async (
  email: string,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.post<ApiResponse<{ message: string }>>(
    "/auth/verify-email/resend",
    { email },
  );
  return res.data;
};

export const googleLoginApi = async (
  data: GoogleAuthSchema,
): Promise<ApiResponse<AuthSuccessData>> => {
  const res = await API.post<ApiResponse<AuthSuccessData>>("/auth/google", data);
  return res.data;
};

export const loginApi = async (
  data: LoginInSchema,
): Promise<ApiResponse<AuthSuccessData>> => {
  const res = await API.post<ApiResponse<AuthSuccessData>>("/auth/login", data);
  return res.data;
};

export const logoutApi = async (): Promise<
  ApiResponse<{ message: string }>
> => {
  const res = await API.get<ApiResponse<{ message: string }>>("/auth/logout");
  return res.data;
};

export const getMeApi = async (): Promise<ApiResponse<AuthSuccessData>> => {
  const res = await API.get<ApiResponse<AuthSuccessData>>("/auth/me");
  return res.data;
};

export const updateProfileApi = async (
  data: UpdateProfileSchema,
): Promise<ApiResponse<{ member: AuthMember }>> => {
  const res = await API.patch<ApiResponse<{ member: AuthMember }>>(
    "/auth/me",
    data,
  );
  return res.data;
};

export const changePasswordApi = async (
  data: ChangePasswordSchema,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.post<ApiResponse<{ message: string }>>(
    "/auth/me/password",
    data,
  );
  return res.data;
};

export const getSessionsApi = async (): Promise<ApiResponse<SessionItem[]>> => {
  const res = await API.get<ApiResponse<SessionItem[]>>("/session");
  return res.data;
};

export const deleteSessionApi = async (
  sessionId: string,
): Promise<ApiResponse<{ message: string }>> => {
  const res = await API.delete<ApiResponse<{ message: string }>>(
    `/session/${sessionId}`,
  );
  return res.data;
};
