import { z } from "zod";
import type { ConversationSummary, VisitorSummary } from "./conversation.js";
import { pageUrlField } from "./message.js";

export const createWidgetSessionSchema = z.object({
  publicKey: z.string().min(1, "Public key is required"),
  visitorToken: z.string().optional(),
});

export type CreateWidgetSessionSchema = z.infer<typeof createWidgetSessionSchema>;

export const updateVisitorProfileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(255).optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  // The page the visitor is on now; the widget reports it as they navigate, even without a message.
  pageUrl: pageUrlField.optional(),
});

export type UpdateVisitorProfileSchema = z.infer<typeof updateVisitorProfileSchema>;

export interface WidgetConfig {
  workspaceName: string;
  widgetColor: string;
  greeting: string;
  awayMessage: string;
}

export interface WidgetSessionData {
  token: string;
  visitor: VisitorSummary;
  conversation: ConversationSummary | null;
  widget: WidgetConfig;
}
