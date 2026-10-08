import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { clearAuth } from "./authSlice";

// "open" is everything not resolved — the "All open" tab.
export type InboxTab = "open" | "unassigned" | "mine" | "resolved";

// What the agent is looking at in the inbox. UI state only: the conversations themselves live in
// TanStack Query. Here (not in the page) so it survives a visit to /account, and so the sound and the
// "assigned to you" toast know which conversation is already open.
export interface InboxUiState {
  activeTab: InboxTab;
  selectedConversationId: string | null;
}

const initialState: InboxUiState = {
  activeTab: "open",
  selectedConversationId: null,
};

export const inboxUiSlice = createSlice({
  name: "inboxUi",
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<InboxTab>) => {
      state.activeTab = action.payload;
    },
    selectConversation: (state, action: PayloadAction<string | null>) => {
      state.selectedConversationId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(clearAuth, () => initialState);
  },
});

export const { setActiveTab, selectConversation } = inboxUiSlice.actions;
export default inboxUiSlice.reducer;
