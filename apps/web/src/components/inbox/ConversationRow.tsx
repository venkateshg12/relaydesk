import { formatDistanceToNowStrict } from "date-fns";
import type { ConversationSummary } from "@repo/types";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./PersonAvatar";
import { StatusPill } from "./StatusPill";
import { visitorLabel } from "./format";

interface ConversationRowProps {
  conversation: ConversationSummary;
  currentMemberId?: string;
  isSelected: boolean;
  // A message just arrived: the row gets the signal tint that fades back (DESIGN_SYSTEM §10.3).
  isArrival: boolean;
  showStatus: boolean;
  onSelect: (id: string) => void;
}

export function ConversationRow({
  conversation,
  currentMemberId,
  isSelected,
  isArrival,
  showStatus,
  onSelect,
}: ConversationRowProps) {
  const label = visitorLabel(conversation.visitor);
  const unread = Math.max(
    0,
    conversation.lastSeq - conversation.agentLastReadSeq,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "flex w-full min-h-[72px] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isSelected ? "bg-signal-soft" : "hover:bg-muted",
        isArrival && !isSelected && "animate-arrival",
      )}
    >
      <PersonAvatar id={conversation.visitorId} label={label} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm text-foreground",
              unread > 0 ? "font-semibold" : "font-medium",
            )}
          >
            {label}
          </span>
          {conversation.lastMessageAt && (
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={conversation.lastMessageAt}
            >
              {formatDistanceToNowStrict(new Date(conversation.lastMessageAt))}
            </time>
          )}
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-[13px]",
              unread > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {conversation.lastMessagePreview ?? "No messages yet"}
          </p>
          {unread > 0 && (
            <span className="shrink-0 rounded-full bg-signal px-1.5 text-xs font-medium leading-5 text-white tabular-nums animate-pop">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>

        {showStatus && (
          <div className="mt-1.5">
            <StatusPill
              conversation={conversation}
              currentMemberId={currentMemberId}
            />
          </div>
        )}
      </div>
    </button>
  );
}
