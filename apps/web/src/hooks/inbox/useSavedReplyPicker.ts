import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { SavedReplyItem } from "@repo/types";

// Typing `/` in an empty reply opens the picker; what follows filters it (DESIGN_SYSTEM §8, composer).
// Picking inserts the reply's text for the agent to edit — it never sends.
export function useSavedReplyPicker(
  draft: string,
  isReplyMode: boolean,
  savedReplies: SavedReplyItem[],
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  const query = draft.slice(1).toLowerCase().trim();
  const matches = useMemo(
    () =>
      savedReplies.filter(
        (reply) =>
          reply.shortcut.toLowerCase().includes(query) ||
          reply.title.toLowerCase().includes(query) ||
          reply.body.toLowerCase().includes(query),
      ),
    [savedReplies, query],
  );
  const isOpen = isReplyMode && draft.startsWith("/") && !isDismissed;

  // Typing again after Esc brings it back; a new filter starts at the top.
  useEffect(() => {
    setActiveIndex(0);
    setIsDismissed(false);
  }, [query]);

  // Arrow keys move, Enter or Tab picks, Esc closes — all while focus stays in the text box.
  const handleKeyDown = (
    event: KeyboardEvent,
    pick: (reply: SavedReplyItem) => void,
  ) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setIsDismissed(true);
    } else if (
      matches.length > 0 &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (index) => (index + step + matches.length) % matches.length,
      );
    } else if (
      matches.length > 0 &&
      (event.key === "Enter" || event.key === "Tab") &&
      !event.shiftKey
    ) {
      event.preventDefault();
      pick(matches[activeIndex]!);
    }
  };

  return { isOpen, matches, activeIndex, handleKeyDown };
}
