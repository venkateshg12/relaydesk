import type { AssigneeSummary, VisitorSummary, ConversationStatus, MessageItem, ServerConversationUpdatedPayload, ServerConversationViewersPayload, ServerMessageSeenPayload } from "@repo/types";
import type { SendMessageResult } from "../services/message.service.js";
import type { AppServer } from "../types/socket.d.js";
import { convRoom, memberRoom, visitorRoom, wsRoom, wsVisitorsRoom } from "./rooms.js";

/*
  The one place services emit from. It holds the Socket.IO server (set by `initSocketServer`), so a
  service imports this file instead of the socket server — and every event has exactly one shape.
  Callers emit only after their transaction has committed: Postgres decides, sockets deliver.
 */
let io: AppServer | null = null;

export const setIo = (server: AppServer | null) => {
    io = server;
};

export const getIo = () => io;

// One emit to several rooms: Socket.IO sends it once per socket even when a socket is in more than one.
export const emitMessageNew = (workspaceId: string, visitorId: string, message: MessageItem) => {
    io?.to([convRoom(message.conversationId), visitorRoom(visitorId), wsRoom(workspaceId)]).emit("message:new", message);
};

export interface ConversationState {
    id: string;
    visitorId: string;
    status: ConversationStatus;
    assigneeId: string | null;
    assignee?: AssigneeSummary | null;
    lastMessageAt: string | null;
    preview: string | null;
}

// Agents patch their list rows with it; the visitor's widget reacts to status changes.
export const emitConversationUpdated = (workspaceId: string, conversation: ConversationState) => {
    const payload: ServerConversationUpdatedPayload = {
        id: conversation.id,
        status: conversation.status,
        assigneeId: conversation.assigneeId,
        assignee: conversation.assignee,
        lastMessageAt: conversation.lastMessageAt,
        preview: conversation.preview,
    };
    io?.to([wsRoom(workspaceId), visitorRoom(conversation.visitorId)]).emit("conversation:updated", payload);
};

export const emitConversationAssigned = (memberId: string, conversationId: string, assignedBy: string) => {
    io?.to(memberRoom(memberId)).emit("conversation:assigned", { conversationId, assignedBy });
};

// Removing an agent ends their live connections too, not just their sessions.
export const disconnectMember = (memberId: string) => {
    io?.in(memberRoom(memberId)).disconnectSockets(true);
};

// One emit for a read mark: the open conversation, the visitor's tabs, and every agent's list.
export const emitMessageSeen = (workspaceId: string, visitorId: string, payload: ServerMessageSeenPayload) => {
    io?.to([convRoom(payload.conversationId), visitorRoom(visitorId), wsRoom(workspaceId)]).emit("message:seen", payload);
};

// Agents learn who is online; visitors only learn whether anyone is ("the team is away"), so they
// never receive member ids.
export const emitPresence = (
    workspaceId: string,
    update: { memberId: string; status: "online" | "away" | "offline"; workspaceOnline: boolean }
) => {
    io?.to(wsRoom(workspaceId)).emit("presence:update", update);
    io?.to(wsVisitorsRoom(workspaceId)).emit("presence:update", {
        memberId: "workspace",
        status: update.workspaceOnline ? "online" : "offline",
        workspaceOnline: update.workspaceOnline,
    });
};

export const emitViewers = (workspaceId: string, payload: ServerConversationViewersPayload) => {
    io?.to(wsRoom(workspaceId)).emit("conversation:viewers", payload);
};

export const emitVisitorUpdated = (workspaceId: string, visitor: VisitorSummary) => {
    io?.to(wsRoom(workspaceId)).emit("visitor:updated", visitor);
};

// Everything a stored message sets in motion, in one place so no way of sending can forget a part of it:
// the message to the conversation, the visitor and every agent; the list row's new preview and status;
// and the sender's read mark (writing means having read everything before it).
export const announceMessage = (workspaceId: string, { message, conversation, duplicate }: SendMessageResult) => {
    if (duplicate) return;
    emitMessageNew(workspaceId, conversation.visitorId, message);
    emitConversationUpdated(workspaceId, conversation);
    emitMessageSeen(workspaceId, conversation.visitorId, {
        conversationId: message.conversationId,
        by: message.senderType,
        seq: message.seq,
    });
};

// Whether any tab of the visitor is connected, on any API instance (the Redis adapter answers for all of
// them). Without a socket server there is nothing to ask, so the visitor counts as connected.
export const isVisitorConnected = async (visitorId: string) => {
    if (!io) return true;
    return (await io.in(visitorRoom(visitorId)).fetchSockets()).length > 0;
};
