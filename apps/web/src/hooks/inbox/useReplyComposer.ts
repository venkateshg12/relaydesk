import { useRef, useState } from "react";
import type { SavedReplyItem } from "@repo/types";
import { emitTyping } from "@/lib/socket";
import { useSendReply } from "@/hooks/conversations/useSendReply";
import { useSavedReplies } from "./useSavedReplies";
import { useSavedReplyPicker } from "./useSavedReplyPicker";
import { savedReplyOptionId } from "@/components/inbox/SavedReplyPicker";

export type ComposerMode = "reply" | "note";

const TYPING_REPEAT_MS = 2000;

interface Options {
  conversationId: string | null;
  addNote: (body: string) => void;
}

// Everything the box under the thread does: reply or note, a draft per conversation (so text typed for one
// visitor can never be sent to another), typing signals, and the `/` saved-reply picker.
export function useReplyComposer({ conversationId, addNote }: Options) {
  const { send, retry } = useSendReply(conversationId);
  const { savedReplies } = useSavedReplies();

  const [mode, setMode] = useState<ComposerMode>("reply");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentAt = useRef(0);

  const draft = (conversationId && drafts[conversationId]) || "";
  const setDraft = (value: string) =>
    conversationId && setDrafts((all) => ({ ...all, [conversationId]: value }));

  const picker = useSavedReplyPicker(draft, mode === "reply", savedReplies);

  const handleChange = (value: string) => {
    setDraft(value);
    if (
      conversationId &&
      mode === "reply" &&
      Date.now() - lastTypingSentAt.current > TYPING_REPEAT_MS
    ) {
      lastTypingSentAt.current = Date.now();
      emitTyping(conversationId, true);
    }
  };

  // Inserts the text for the agent to edit; never sends it.
  const pick = (reply: SavedReplyItem) => {
    setDraft(reply.body);
    textareaRef.current?.focus();
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || !conversationId) return;
    setDraft("");

    if (mode === "note") return addNote(body);
    emitTyping(conversationId, false);
    await send(body);
  };

  const activeReply = picker.isOpen
    ? picker.matches[picker.activeIndex]
    : undefined;

  return {
    mode,
    setMode,
    draft,
    textareaRef,
    handleChange,
    submit,
    retry,
    picker: { ...picker, pick },
    onKeyDown: (event: React.KeyboardEvent) =>
      picker.handleKeyDown(event, pick),
    activeOptionId: activeReply && savedReplyOptionId(activeReply.id),
  };
}
