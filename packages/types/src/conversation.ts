import { z } from "zod";
import { paginationQuerySchema } from "./pagination.js";
import type { MessageItem } from "./message.js";

export const conversationStatusSchema = z.enum(["unassigned", "assigned", "resolved"]);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

// "open" is a list filter, not a state: everything that isn't resolved (the "All open" tab).
export const conversationListStatusSchema = z.enum([...conversationStatusSchema.options, "open"]);
export type ConversationListStatus = z.infer<typeof conversationListStatusSchema>;

export const listConversationsQuerySchema = paginationQuerySchema.extend({
  status: conversationListStatusSchema.optional(),
  mine: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export interface VisitorSummary {
  id: string;
  displayNo: number;
  name: string | null;
  email: string | null;
  lastPageUrl: string | null;
  firstSeenAt: string;
}

export interface AssigneeSummary {
  id: string;
  name: string;
}

export interface ConversationSummary {
  id: string;
  workspaceId: string;
  visitorId: string;
  status: ConversationStatus;
  assigneeId: string | null;
  lastAssigneeId?: string | null;
  lastSeq: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  visitorLastReadSeq: number;
  agentLastReadSeq: number;
  createdAt: string;
  updatedAt: string;
  visitor: VisitorSummary;
  // Only what the inbox shows (the name); a colleague's email is not an agent's business.
  assignee?: AssigneeSummary | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageItem[];
}
