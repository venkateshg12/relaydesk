export interface SendInvitationPayload {
    invitationId: string;
    email: string;
    workspaceName: string;
    inviterName: string;
    token: string;
}

// Only ids: the processor re-reads the conversation, so it mails what is true when it runs
// (which replies are still unread, whether the visitor has an email now), not what was true when queued.
export interface SendOfflineReplyPayload {
    workspaceId: string;
    conversationId: string;
}
