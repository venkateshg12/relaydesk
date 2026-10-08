import type { SavedReplyItem } from "@repo/types";
import { cn } from "@/lib/utils";

export const SAVED_REPLY_LISTBOX_ID = "saved-reply-listbox";
export const savedReplyOptionId = (id: string) => `saved-reply-${id}`;

interface SavedReplyPickerProps {
  matches: SavedReplyItem[];
  activeIndex: number;
  onSelect: (reply: SavedReplyItem) => void;
}

// A list above the composer, driven from the text box's keys (`useSavedReplyPicker`): the text box keeps
// focus, so the options are marked up as a listbox it points at with `aria-activedescendant`.
export function SavedReplyPicker({
  matches,
  activeIndex,
  onSelect,
}: SavedReplyPickerProps) {
  return (
    <div
      id={SAVED_REPLY_LISTBOX_ID}
      role="listbox"
      aria-label="Saved replies"
      className="absolute bottom-full left-3 z-20 mb-2 max-h-64 w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-float animate-in fade-in slide-in-from-bottom-1 duration-200"
    >
      {matches.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          No saved reply matches that.
        </p>
      ) : (
        matches.map((reply, index) => (
          <div
            key={reply.id}
            id={savedReplyOptionId(reply.id)}
            role="option"
            aria-selected={index === activeIndex}
            // `mousedown`, not `click`: the text box must not lose focus before the text is inserted.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(reply);
            }}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-2",
              index === activeIndex ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {reply.title}
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                /{reply.shortcut}
              </span>
            </div>
            <p className="truncate text-[13px] text-muted-foreground">
              {reply.body}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
