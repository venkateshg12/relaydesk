import { z } from "zod";
import type { AssigneeSummary } from "./conversation.js";

export const createSavedReplySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title is too long"),
  shortcut: z
    .string()
    .trim()
    .min(1, "Shortcut is required")
    .max(50, "Shortcut is too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Shortcut may only contain letters, numbers, hyphens and underscores"),
  body: z.string().trim().min(1, "Reply body is required").max(4000, "Body cannot exceed 4000 characters"),
});

export type CreateSavedReplySchema = z.infer<typeof createSavedReplySchema>;

export const updateSavedReplySchema = createSavedReplySchema.partial();
export type UpdateSavedReplySchema = z.infer<typeof updateSavedReplySchema>;

export interface SavedReplyItem {
  id: string;
  workspaceId: string;
  title: string;
  shortcut: string;
  body: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  // Just the name, for the table; a colleague's email is not an agent's business.
  createdBy?: AssigneeSummary | null;
}

export type SavedReply = SavedReplyItem;
