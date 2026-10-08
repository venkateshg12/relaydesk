"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Pin } from "lucide-react";
import type { MessageItem, NoteItem } from "@repo/types";
import type { OutboxItem } from "@/lib/socket";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DeliveryMark } from "./DeliveryMark";
import { dayLabel } from "./format";

const GROUP_WINDOW_MS = 2 * 60 * 1000;

type Entry =
  | { kind: "day"; key: string; label: string }
  | { kind: "note"; key: string; note: NoteItem }
  | {
      kind: "message";
      key: string;
      message: MessageItem;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

const senderKey = (m: MessageItem) =>
  `${m.senderType}:${m.senderMemberId ?? ""}`;
const time = (iso: string) => new Date(iso).getTime();

/*
  Messages keep their seq order — never re-sorted by time — and notes are merged in by when they were
  written. Consecutive messages from one sender within two minutes form a group: the name shows on
  the first, the time on the last (DESIGN_SYSTEM §8, grouping).
 */
const buildEntries = (messages: MessageItem[], notes: NoteItem[]): Entry[] => {
  const ordered = [...messages].sort((a, b) => a.seq - b.seq);
  const orderedNotes = [...notes].sort(
    (a, b) => time(a.createdAt) - time(b.createdAt),
  );

  const merged: (MessageItem | NoteItem)[] = [];
  let n = 0;
  for (const message of ordered) {
    while (
      n < orderedNotes.length &&
      time(orderedNotes[n]!.createdAt) < time(message.createdAt)
    ) {
      merged.push(orderedNotes[n++]!);
    }
    merged.push(message);
  }
  merged.push(...orderedNotes.slice(n));

  const isMessage = (
    item: MessageItem | NoteItem | undefined,
  ): item is MessageItem => Boolean(item && "seq" in item);
  const sameGroup = (
    a: MessageItem | NoteItem | undefined,
    b: MessageItem | NoteItem | undefined,
  ) =>
    isMessage(a) &&
    isMessage(b) &&
    senderKey(a) === senderKey(b) &&
    Math.abs(time(b.createdAt) - time(a.createdAt)) < GROUP_WINDOW_MS &&
    dayLabel(new Date(a.createdAt)) === dayLabel(new Date(b.createdAt));

  const entries: Entry[] = [];
  let currentDay = "";
  merged.forEach((item, index) => {
    const day = dayLabel(new Date(item.createdAt));
    if (day !== currentDay) {
      currentDay = day;
      entries.push({ kind: "day", key: `day-${item.createdAt}`, label: day });
    }
    if (isMessage(item)) {
      entries.push({
        kind: "message",
        key: `m-${item.id}`,
        message: item,
        isFirstInGroup: !sameGroup(merged[index - 1], item),
        isLastInGroup: !sameGroup(item, merged[index + 1]),
      });
    } else {
      entries.push({ kind: "note", key: `n-${item.id}`, note: item });
    }
  });
  return entries;
};

interface TimelineProps {
  messages: MessageItem[];
  notes: NoteItem[];
  // Replies the server hasn't confirmed yet: shown at once as "sending", or "Not sent. Retry".
  pending?: OutboxItem[];
  visitorName: string;
  // Messages up to this seq are seen by the visitor (the signal double check).
  visitorLastReadSeq?: number;
  currentMemberId?: string;
  isLoading: boolean;
  onRetry?: (clientMessageId: string) => void;
}

export function Timeline({
  messages,
  notes,
  pending = [],
  visitorName,
  visitorLastReadSeq = 0,
  currentMemberId,
  isLoading,
  onRetry,
}: TimelineProps) {
  const entries = useMemo(
    () => buildEntries(messages, notes),
    [messages, notes],
  );

  // Follow new messages only when the agent is already at the bottom — or just sent something. Never
  // yank them away from history they scrolled up to read: a "1 new message" pill appears instead
  // (DESIGN_SYSTEM §10.3). No smooth scrolling under reduced motion.
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const previousCountRef = useRef<number | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  const scrollToBottom = (isInstant: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: isInstant || reduceMotion ? "auto" : "smooth",
    });
    setUnseenCount(0);
  };

  useEffect(() => {
    const isFirstRender = previousCountRef.current === null;
    const added = isFirstRender
      ? 0
      : messages.length - previousCountRef.current!;
    previousCountRef.current = messages.length;

    const newest = messages[messages.length - 1];
    const isMine =
      newest?.senderMemberId != null &&
      newest.senderMemberId === currentMemberId;

    if (isFirstRender || isAtBottomRef.current || (added > 0 && isMine))
      scrollToBottom(isFirstRender);
    else if (added > 0) setUnseenCount((count) => count + added);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrolling is the point; it runs when content changes
  }, [entries, messages.length, pending.length]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 bg-background p-6" aria-busy="true">
        <Skeleton className="h-12 w-2/3 rounded-3xl" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-3xl" />
        <Skeleton className="h-16 w-3/5 rounded-3xl" />
      </div>
    );
  }

  // The server's own copy can arrive a moment before the ack that clears the outbox.
  const unconfirmed = pending.filter(
    (item) => !messages.some((m) => m.clientMessageId === item.clientMessageId),
  );
  const isEmpty = entries.length === 0 && unconfirmed.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          isAtBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          if (isAtBottomRef.current) setUnseenCount(0);
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-6 sm:px-6"
        aria-live="polite"
      >
        {isEmpty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <>
            {entries.map((entry) => (
              <Fragment key={entry.key}>
                {entry.kind === "day" && (
                  <p className="my-4 text-center text-xs font-medium text-muted-foreground">
                    {entry.label}
                  </p>
                )}
                {entry.kind === "note" && <NoteCard note={entry.note} />}
                {entry.kind === "message" && (
                  <MessageBubble
                    message={entry.message}
                    visitorName={visitorName}
                    isFirstInGroup={entry.isFirstInGroup}
                    isLastInGroup={entry.isLastInGroup}
                    isSeen={entry.message.seq <= visitorLastReadSeq}
                  />
                )}
              </Fragment>
            ))}
            {unconfirmed.map((item) => (
              <PendingBubble
                key={item.clientMessageId}
                item={item}
                onRetry={onRetry}
              />
            ))}
          </>
        )}
      </div>

      {unseenCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(false)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-white shadow-float animate-pop focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:animate-none"
        >
          {unseenCount === 1 ? "1 new message" : `${unseenCount} new messages`}
        </button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  visitorName,
  isFirstInGroup,
  isLastInGroup,
  isSeen,
}: {
  message: MessageItem;
  visitorName: string;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isSeen: boolean;
}) {
  // In the inbox the team's messages are on the right; the visitor's on the left.
  const isTeam = message.senderType === "agent";

  return (
    <div
      className={cn(
        "flex flex-col",
        isTeam ? "items-end" : "items-start",
        isFirstInGroup ? "mt-4" : "mt-0.5",
      )}
    >
      {isFirstInGroup && (
        <span className="mb-1 px-1 text-xs font-medium text-muted-foreground">
          {isTeam ? (message.senderName ?? "Team") : visitorName}
        </span>
      )}
      <div
        className={cn(
          "max-w-[min(65ch,75%)] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-sm leading-normal text-foreground",
          isTeam
            ? [
                "bg-signal-soft",
                !isFirstInGroup && "rounded-tr-md",
                !isLastInGroup && "rounded-br-md",
              ]
            : [
                "border border-border bg-card",
                !isFirstInGroup && "rounded-tl-md",
                !isLastInGroup && "rounded-bl-md",
              ],
        )}
      >
        {message.body}
      </div>
      {isLastInGroup && (
        <div className="mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground">
          <time className="tabular-nums" dateTime={message.createdAt}>
            {format(new Date(message.createdAt), "HH:mm")}
          </time>
          {isTeam && <DeliveryMark status={isSeen ? "seen" : "sent"} />}
        </div>
      )}
    </div>
  );
}

// A reply on its way (or stuck): same shape as a team bubble, with the clock or the Retry link.
function PendingBubble({
  item,
  onRetry,
}: {
  item: OutboxItem;
  onRetry?: (clientMessageId: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-end">
      <div
        className={cn(
          "max-w-[min(65ch,75%)] whitespace-pre-wrap break-words rounded-3xl bg-signal-soft px-4 py-2.5 text-sm leading-normal text-foreground",
          item.status === "sending" && "opacity-70",
        )}
      >
        {item.body}
      </div>
      <div className="mt-1 px-1">
        <DeliveryMark
          status={item.status}
          onRetry={() => onRetry?.(item.clientMessageId)}
        />
      </div>
    </div>
  );
}

// A note is a full-width yellow card, never a bubble, so it can't be mistaken for a message to the
// visitor (DESIGN_SYSTEM §3, §8).
function NoteCard({ note }: { note: NoteItem }) {
  return (
    <div className="my-4 rounded-xl border border-note-border bg-note px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <Pin className="size-3.5 text-note-foreground" aria-hidden />
        <span className="font-medium text-note-foreground">Note</span>
        <span className="text-muted-foreground">
          {note.author?.name ?? "Team"}
        </span>
        <time
          className="ml-auto text-muted-foreground tabular-nums"
          dateTime={note.createdAt}
        >
          {format(new Date(note.createdAt), "HH:mm")}
        </time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">
        {note.body}
      </p>
    </div>
  );
}
