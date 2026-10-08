import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AuthMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  status: "active" | "removed";
  // "google" accounts have no password.
  authProvider?: "local" | "google";
  avatar?: string | null;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  publicKey: string;
  widgetColor: string;
  // Only the homepage's private demo workspaces; absent (falsy) for every real account.
  isDemo?: boolean;
}

// Who is logged in. Server data (team, conversations, …) lives in TanStack Query, not here.
export interface AuthState {
  member: AuthMember | null;
  workspace: AuthWorkspace | null;
  isBootstrapped: boolean;
}

const initialState: AuthState = {
  member: null,
  workspace: null,
  isBootstrapped: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (
      state,
      action: PayloadAction<{ member: AuthMember; workspace: AuthWorkspace }>,
    ) => {
      state.member = action.payload.member;
      state.workspace = action.payload.workspace;
      state.isBootstrapped = true;
    },
    updateMember: (state, action: PayloadAction<AuthMember>) => {
      if (state.member) state.member = { ...state.member, ...action.payload };
    },
    clearAuth: (state) => {
      state.member = null;
      state.workspace = null;
      state.isBootstrapped = true;
    },
  },
});

export const { setUser, updateMember, clearAuth } = authSlice.actions;
export default authSlice.reducer;
