export interface SendInvitationPayload {
    invitationId: string;
    email: string;
    workspaceName: string;
    inviterName: string;
    token: string;
}

// The raw token travels in the job because it exists nowhere else (only its hash is in Postgres). The processor
// re-reads the member and skips if they are already verified or the link was replaced.
export interface SendVerificationPayload {
    memberId: string;
    workspaceId: string;
    email: string;
    name: string;
    token: string;
}

// Only ids: the processor re-reads the conversation, so it mails what is true when it runs
// (which replies are still unread, whether the visitor has an email now), not what was true when queued.
export interface SendOfflineReplyPayload {
    workspaceId: string;
    conversationId: string;
}
