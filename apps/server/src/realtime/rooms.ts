export const wsRoom = (workspaceId: string): string => `ws:${workspaceId}`;
export const wsVisitorsRoom = (workspaceId: string): string => `ws:${workspaceId}:visitors`;
export const convRoom = (conversationId: string): string => `conv:${conversationId}`;
export const visitorRoom = (visitorId: string): string => `visitor:${visitorId}`;
export const memberRoom = (memberId: string): string => `member:${memberId}`;
