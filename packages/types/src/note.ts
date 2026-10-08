import { z } from "zod";

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(4000, "Note cannot exceed 4000 characters"),
});

export type CreateNoteSchema = z.infer<typeof createNoteSchema>;

export interface NoteItem {
  id: string;
  workspaceId: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
}
