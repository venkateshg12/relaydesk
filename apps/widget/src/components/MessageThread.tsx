import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MessageItem } from "@repo/types";
import type { OutboxItem } from "@/hooks/useChat";
import { ArrowDownIcon } from "./icons";
import { DeliveryMark } from "./DeliveryMark";

const GROUP_WINDOW_MS = 2 * 60 * 1000;

const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

const dayLabel = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.format(date);
};

type Entry =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: MessageItem; isFirstInGroup: boolean; isLastInGroup: boolean };

// Consecutive messages from one sender within two minutes stack: the name on the first, the time and
// mark on the last (DESIGN_SYSTEM §8, grouping). Order is `seq`, never the clock.
const buildEntries = (messages: MessageItem[]): Entry[] => {
  const sameGroup = (a?: MessageItem, b?: MessageItem) =>
    Boolean(a && b) &&
    a!.senderType === b!.senderType &&
    a!.senderMemberId === b!.senderMemberId &&
    Math.abs(new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime()) < GROUP_WINDOW_MS &&
    dayLabel(new Date(a!.createdAt)) === dayLabel(new Date(b!.createdAt));

  const entries: Entry[] = [];
  let currentDay = "";
  messages.forEach((message, index) => {
    const label = dayLabel(new Date(message.createdAt));
    if (label !== currentDay) {
      currentDay = label;
      entries.push({ kind: "day", key: `day-${message.id}`, label });
    }
    entries.push({
      kind: "message",
      key: message.id,
      message,
      isFirstInGroup: !sameGroup(messages[index - 1], message),
      isLastInGroup: !sameGroup(message, messages[index + 1]),
    });
  });
  return entries;
};

interface MessageThreadProps {
  messages: MessageItem[];
  outbox: OutboxItem[];
  // Messages up to this seq have been read by the team (the signal double check).
  agentReadSeq: number;
  typingWho: string | null;
  greeting: string;
  awayMessage: string;
  workspaceName: string;
  isTeamOnline: boolean | null;
  onRetry: (clientMessageId: string) => void;
  children?: React.ReactNode;
}

export function MessageThread({
  messages,
  outbox,
  agentReadSeq,
  typingWho,
  greeting,
  awayMessage,
  workspaceName,
  isTeamOnline,
  onRetry,
  children,
}: MessageThreadProps) {
  const entries = useMemo(() => buildEntries(messages), [messages]);
  // The server's own copy can arrive a moment before the ack that clears the outbox.
  const pending = outbox.filter((item) => !messages.some((m) => m.clientMessageId === item.clientMessageId));

  // Follow new messages when the visitor is at the bottom (or just sent one); otherwise leave them
  // reading and show a "New message" pill instead.
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const previousCount = useRef<number | null>(null);
  const [hasUnseen, setHasUnseen] = useState(false);

  const scrollToBottom = (isInstant: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: isInstant || reduceMotion ? "auto" : "smooth" });
    setHasUnseen(false);
  };

  useEffect(() => {
    const isFirst = previousCount.current === null;
    const added = isFirst ? 0 : messages.length - previousCount.current!;
    previousCount.current = messages.length;
    const newest = messages[messages.length - 1];

    if (isFirst || isAtBottom.current || newest?.senderType === "visitor") scrollToBottom(isFirst);
    else if (added > 0) setHasUnseen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrolling is the point; it runs when content changes
  }, [messages.length, pending.length, typingWho]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (isAtBottom.current) setHasUnseen(false);
        }}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="min-h-0 flex-1 overflow-y-auto bg-panel px-4 py-4 text-ink"
      >
        {/* The greeting is shown, never stored: it is not a message anyone sent. */}
        <div className="flex max-w-[85%] flex-col items-start gap-1">
          <span className="px-1 text-xs font-medium text-ink-muted">{workspaceName}</span>
          <p className="rounded-[18px] bg-bubble px-3.5 py-2.5 text-[15px] leading-normal">{greeting}</p>
          {isTeamOnline === false && (
            <p className="rounded-[18px] bg-bubble px-3.5 py-2.5 text-[15px] leading-normal text-ink-muted">{awayMessage}</p>
          )}
        </div>

        {entries.map((entry) => (
          <Fragment key={entry.key}>
            {entry.kind === "day" ? (
              <p className="my-4 text-center text-xs font-medium text-ink-muted">{entry.label}</p>
            ) : (
              <Bubble
                message={entry.message}
                workspaceName={workspaceName}
                isFirstInGroup={entry.isFirstInGroup}
                isLastInGroup={entry.isLastInGroup}
                isSeen={entry.message.seq <= agentReadSeq}
              />
            )}
          </Fragment>
        ))}

        {pending.map((item) => (
          <div key={item.clientMessageId} className="mt-4 flex flex-col items-end">
            <p
              className={`max-w-[min(65ch,85%)] break-words whitespace-pre-wrap rounded-[18px] bg-brand px-3.5 py-2.5 text-[15px] leading-normal text-brand-foreground ${item.status === "sending" ? "opacity-70" : ""}`}
            >
              {item.body}
            </p>
            <div className="mt-1 px-1 text-ink-muted">
              <DeliveryMark status={item.status} onRetry={() => onRetry(item.clientMessageId)} />
            </div>
          </div>
        ))}

        {typingWho && (
          <div className="mt-4 flex flex-col items-start gap-1" role="status">
            <span className="px-1 text-xs font-medium text-ink-muted">{typingWho} is typing…</span>
            {/* Reduced motion: the words above are the indicator; the dots are decoration. */}
            <div className="flex items-center gap-1.5 rounded-[18px] bg-bubble px-3.5 py-3 motion-reduce:hidden" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-1.5 animate-typing-dot rounded-full bg-ink-muted" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        )}

        {children}
      </div>

      {hasUnseen && (
        <button
          type="button"
          onClick={() => scrollToBottom(false)}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 animate-pop cursor-pointer items-center gap-1.5 rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-white shadow-widget focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          <ArrowDownIcon className="size-3.5" />
          New message
        </button>
      )}
    </div>
  );
}

function Bubble({
  message,
  workspaceName,
  isFirstInGroup,
  isLastInGroup,
  isSeen,
}: {
  message: MessageItem;
  workspaceName: string;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isSeen: boolean;
}) {
  // The visitor's own messages are on the right in the brand colour; the team's on the left.
  const isMine = message.senderType === "visitor";

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-4" : "mt-0.5"}`}>
      {!isMine && isFirstInGroup && (
        <span className="mb-1 px-1 text-xs font-medium text-ink-muted">{message.senderName ?? workspaceName}</span>
      )}
      <p
        className={`max-w-[min(65ch,85%)] break-words whitespace-pre-wrap rounded-[18px] px-3.5 py-2.5 text-[15px] leading-normal ${
          isMine
            ? `bg-brand text-brand-foreground ${isFirstInGroup ? "" : "rounded-tr-md"} ${isLastInGroup ? "" : "rounded-br-md"}`
            : `bg-bubble text-ink ${isFirstInGroup ? "" : "rounded-tl-md"} ${isLastInGroup ? "" : "rounded-bl-md"}`
        }`}
      >
        {message.body}
      </p>
      {isLastInGroup && (
        <div className="mt-1 flex items-center gap-1 px-1 text-xs text-ink-muted">
          <time className="tabular-nums" dateTime={message.createdAt}>
            {time.format(new Date(message.createdAt))}
          </time>
          {isMine && <DeliveryMark status={isSeen ? "seen" : "sent"} />}
        </div>
      )}
    </div>
  );
}
