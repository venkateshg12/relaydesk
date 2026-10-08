"use client";

import { forwardRef } from "react";
import { Loader2, Pin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ComposerMode = "reply" | "note";

interface ComposerProps {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  // Runs before Enter-sends: the saved-reply picker uses it for arrows, Enter, Tab and Esc.
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  // Set while the picker is open, so a screen reader hears the highlighted option.
  activeOptionId?: string;
  // The saved-reply picker, positioned above the box.
  children?: React.ReactNode;
}

/*
  Note mode turns the whole composer yellow and the button into "Add note": the product rule is that
  a note never reaches the visitor, so the mode must be impossible to miss (DESIGN_SYSTEM §8).
 */
export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer(
    {
      mode,
      onModeChange,
      value,
      onChange,
      onSend,
      isSending,
      onKeyDown,
      activeOptionId,
      children,
    },
    ref,
  ) {
    const isNote = mode === "note";

    return (
      <div
        className={cn(
          "relative border-t border-border p-3 transition-colors duration-150",
          isNote ? "bg-note" : "bg-card",
        )}
      >
        {children}

        {/* One rounded box holds the text and its controls, so the mode switch sits next to what it changes. */}
        <div
          className={cn(
            "rounded-2xl border bg-card transition-colors duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            isNote ? "border-note-border" : "border-input",
          )}
        >
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              onKeyDown?.(e);
              if (e.defaultPrevented) return;
              // Enter sends; Shift+Enter is a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={3}
            aria-label={isNote ? "Internal note" : "Reply to visitor"}
            aria-controls={activeOptionId ? "saved-reply-listbox" : undefined}
            aria-activedescendant={activeOptionId}
            placeholder={
              isNote ? "Write a note for your team" : "Write a reply"
            }
            className="min-h-[72px] resize-none rounded-2xl border-0 bg-transparent px-4 pt-3 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-3">
              <Tabs
                value={mode}
                onValueChange={(next) => onModeChange(next as ComposerMode)}
              >
                <TabsList className="rounded-lg">
                  <TabsTrigger value="reply" className="px-3 text-xs">
                    Reply
                  </TabsTrigger>
                  <TabsTrigger value="note" className="gap-1 px-3 text-xs">
                    <Pin className="size-3" aria-hidden />
                    Note
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p
                className={cn(
                  "text-xs",
                  isNote ? "text-note-foreground" : "text-muted-foreground",
                )}
              >
                {isNote
                  ? "Only your team sees notes"
                  : "Type / for saved replies"}
              </p>
            </div>
            <Button onClick={onSend} disabled={!value.trim() || isSending}>
              {isSending ? (
                <Loader2 className="animate-spin" />
              ) : isNote ? (
                <Pin />
              ) : (
                <Send />
              )}
              {isNote ? "Add note" : "Send reply"}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
