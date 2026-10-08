import type { ConversationSummary } from "@repo/types";
import { cn } from "@/lib/utils";

// One fixed colour per status (DESIGN_SYSTEM §4.1): apricot needs someone, blue is yours,
// grey is handled by a colleague, green is done.
export function StatusPill({
  conversation,
  currentMemberId,
  className,
}: {
  conversation: Pick<ConversationSummary, "status" | "assigneeId" | "assignee">;
  currentMemberId?: string;
  className?: string;
}) {
  const { status, assigneeId, assignee } = conversation;
  const isMine = status === "assigned" && assigneeId === currentMemberId;

  const label =
    status === "unassigned"
      ? "Unassigned"
      : status === "resolved"
        ? "Resolved"
        : isMine
          ? "Mine"
          : (assignee?.name ?? "Assigned");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-[12rem] truncate",
        status === "unassigned" &&
          "bg-status-unassigned-soft text-status-unassigned",
        status === "resolved" && "bg-status-resolved-soft text-status-resolved",
        status === "assigned" &&
          isMine &&
          "bg-status-mine-soft text-status-mine",
        status === "assigned" &&
          !isMine &&
          "bg-status-others-soft text-status-others",
        className,
      )}
    >
      {label}
    </span>
  );
}
