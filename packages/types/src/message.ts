import { z } from "zod";

// Shared by the REST and socket send paths, so both validate a message the same way.
// Clients generate the id with `crypto.randomUUID()`; it is the idempotency key for "sent twice".
export const clientMessageIdField = z.string().uuid("clientMessageId must be a uuid");
export const messageBodyField = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(4000, "Message cannot exceed 4000 characters");
// Shown to agents as a link, so only real web addresses are accepted (never `javascript:` or `data:`).
export const pageUrlField = z
  .string()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: "pageUrl must be an http(s) address" });

export const sendVisitorMessageSchema = z.object({
  clientMessageId: clientMessageIdField,
  body: messageBodyField,
  pageUrl: pageUrlField.optional(),
});
export type SendVisitorMessageSchema = z.infer<typeof sendVisitorMessageSchema>;

export const sendAgentMessageSchema = z.object({
  clientMessageId: clientMessageIdField,
  body: messageBodyField,
});
export type SendAgentMessageSchema = z.infer<typeof sendAgentMessageSchema>;

// `?beforeSeq=` pages back through history, `?afterSeq=` catches up; neither → the latest messages.
export const messageHistoryQuerySchema = z.object({
  beforeSeq: z.coerce.number().int().positive().optional(),
  afterSeq: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;

export interface MessageItem {
  id: string;
  workspaceId: string;
  conversationId: string;
  seq: number;
  clientMessageId: string;
  senderType: "visitor" | "agent";
  senderMemberId: string | null;
  // The agent's name on agent messages; null on visitor messages.
  senderName: string | null;
  body: string;
  createdAt: string;
}

export type MessageSummary = MessageItem;
