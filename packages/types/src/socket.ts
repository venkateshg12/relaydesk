import { z } from "zod";
import { clientMessageIdField, messageBodyField, pageUrlField, type MessageItem } from "./message.js";
import type { AssigneeSummary, VisitorSummary } from "./conversation.js";
import type { NoteItem } from "./note.js";
import type { WidgetConfig } from "./widget.js";

// Client -> Server schemas
export const clientSendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  clientMessageId: clientMessageIdField,
  body: messageBodyField,
  pageUrl: pageUrlField.optional(),
});
export type ClientSendMessageSchema = z.infer<typeof clientSendMessageSchema>;

export const clientTypingSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation id"),
  isTyping: z.boolean(),
});
export type ClientTypingSchema = z.infer<typeof clientTypingSchema>;

export const clientMessageSeenSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation id"),
  seq: z.number().int().positive("seq must be positive"),
});
export type ClientMessageSeenSchema = z.infer<typeof clientMessageSeenSchema>;

export const clientConversationJoinSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation id"),
});
export type ClientConversationJoinSchema = z.infer<typeof clientConversationJoinSchema>;

export const clientConversationLeaveSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation id"),
});
export type ClientConversationLeaveSchema = z.infer<typeof clientConversationLeaveSchema>;

// A client names at most this many conversations per sync; each answer is capped at SYNC_PAGE_SIZE.
export const SYNC_MAX_CONVERSATIONS = 50;
export const SYNC_PAGE_SIZE = 100;

export const clientSyncSchema = z.object({
  conversations: z.array(
    z.object({
      id: z.string().uuid("Invalid conversation id"),
      lastSeq: z.number().int().nonnegative("lastSeq must be non-negative"),
    })
  ).max(SYNC_MAX_CONVERSATIONS),
});
export type ClientSyncSchema = z.infer<typeof clientSyncSchema>;

export const clientPresenceSetSchema = z.object({
  status: z.enum(["online", "away"]),
});
export type ClientPresenceSetSchema = z.infer<typeof clientPresenceSetSchema>;

// Server -> Client event payloads
export type ServerMessageNewPayload = MessageItem;

export interface ServerTypingPayload {
  conversationId: string;
  who: string;
  isTyping: boolean;
}

export interface ServerMessageSeenPayload {
  conversationId: string;
  by: "visitor" | "agent";
  seq: number;
}

// The list row fields that change; clients patch their cached row by `id`.
export interface ServerConversationUpdatedPayload {
  id: string;
  status: "unassigned" | "assigned" | "resolved";
  assigneeId: string | null;
  // The assignee's name when the sender knows it (assign, hand over, unassign); absent when the update comes
  // from a message, where the assignee usually hasn't changed — clients then keep what they have.
  assignee?: AssigneeSummary | null;
  lastMessageAt: string | null;
  preview: string | null;
}

// `workspaceOnline` is what the widget needs ("the team is away" → offline mode).
export interface ServerPresenceUpdatePayload {
  memberId: string;
  status: "online" | "away" | "offline";
  workspaceOnline: boolean;
}

export interface ServerPresenceSnapshotPayload {
  members: Record<string, "online" | "away">;
  workspaceOnline: boolean;
}

// Names travel with ids: agents can't read the admin-only team list to look them up.
export interface ServerConversationViewersPayload {
  conversationId: string;
  viewers: { memberId: string; name: string }[];
}

export interface ServerConversationAssignedPayload {
  conversationId: string;
  assignedBy: string;
}

// Acks
export type SendMessageAck =
  | { ok: true; duplicate: boolean; message: MessageItem }
  | { ok: false; error: "VALIDATION_ERROR" | "RATE_LIMITED" | "NOT_FOUND" | "INTERNAL_ERROR"; retryAfter?: number };

export type SyncAck =
  | { ok: true; messages: Record<string, MessageItem[]>; hasMore: Record<string, boolean> }
  | { ok: false; error: string };

export type JoinAck = { ok: true; viewers: ServerConversationViewersPayload["viewers"] } | { ok: false; error: string };

// The full event contract, so both ends are type-checked against one definition.
export interface ClientToServerEvents {
  "message:send": (payload: ClientSendMessageSchema, ack: (res: SendMessageAck) => void) => void;
  typing: (payload: ClientTypingSchema) => void;
  "message:seen": (payload: ClientMessageSeenSchema) => void;
  sync: (payload: ClientSyncSchema, ack: (res: SyncAck) => void) => void;
  "presence:set": (payload: ClientPresenceSetSchema) => void;
  "conversation:join": (payload: ClientConversationJoinSchema, ack?: (res: JoinAck) => void) => void;
  "conversation:leave": (payload: ClientConversationLeaveSchema) => void;
}

export interface ServerToClientEvents {
  "message:new": (payload: ServerMessageNewPayload) => void;
  typing: (payload: ServerTypingPayload) => void;
  "message:seen": (payload: ServerMessageSeenPayload) => void;
  "conversation:updated": (payload: ServerConversationUpdatedPayload) => void;
  "conversation:assigned": (payload: ServerConversationAssignedPayload) => void;
  "conversation:viewers": (payload: ServerConversationViewersPayload) => void;
  "note:new": (payload: { note: NoteItem }) => void;
  // A visitor gave their name or email, or moved to another page: agents patch what they show.
  "visitor:updated": (payload: VisitorSummary) => void;
  "presence:update": (payload: ServerPresenceUpdatePayload) => void;
  "presence:snapshot": (payload: ServerPresenceSnapshotPayload) => void;
  // Phase 11 (demo): live numbers on the homepage.
  "stats:update": (payload: { messagesDelivered: number; onlineNow: number }) => void;
  // Phase 10 (admin): widget settings changed → open widgets re-theme.
  "workspace:updated": (payload: { widget: WidgetConfig }) => void;
}
