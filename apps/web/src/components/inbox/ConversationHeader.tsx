"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  PanelRight,
  RotateCcw,
} from "lucide-react";
import type {
  ConversationDetail,
  MemberOption,
  ServerConversationViewersPayload,
  ServerPresenceUpdatePayload,
} from "@repo/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./PersonAvatar";
import { StatusPill } from "./StatusPill";
import { visitorLabel } from "./format";

type Presence = ServerPresenceUpdatePayload["status"];

interface ConversationHeaderProps {
  conversation: ConversationDetail;
  currentMemberId?: string;
  members: MemberOption[];
  presence: Record<string, Presence>;
  typingWho: string | null;
  // Other agents with this conversation open right now.
  viewers?: ServerConversationViewersPayload["viewers"];
  onBack?: () => void;
  onToggleDetails: () => void;
  onAssignToMe: () => void;
  onHandOver: (memberId: string) => void;
  onUnassign: () => void;
  onResolve: () => void;
  onReopen: () => void;
  // One of assign / hand over / resolve / reopen is in flight: the buttons wait, so a double click can't send it twice.
  isBusy?: boolean;
}

// Colour is never the only cue: the dot always comes with the word (DESIGN_SYSTEM §12).
const PRESENCE_DOT: Record<Presence, string> = {
  online: "bg-status-resolved",
  away: "bg-status-unassigned",
  offline: "bg-border",
};
const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
};

/*
  One primary action that depends on state (DESIGN_SYSTEM §11, Phase 09): Unassigned → "Assign to me",
  mine → "Resolve", someone else's → "Assign to me" (take over), resolved → "Reopen" (outline).
  "Assign to…" is always the quieter outline button with the list of agents and whether they are around.
 */
export function ConversationHeader({
  conversation,
  currentMemberId,
  members,
  presence,
  typingWho,
  viewers = [],
  onBack,
  onToggleDetails,
  onAssignToMe,
  onHandOver,
  onUnassign,
  onResolve,
  onReopen,
  isBusy = false,
}: ConversationHeaderProps) {
  const isResolved = conversation.status === "resolved";
  const isMine =
    conversation.status === "assigned" &&
    conversation.assigneeId === currentMemberId;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            aria-label="Back to conversations"
            className="md:hidden"
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-[17px] font-bold tracking-[-0.01em] text-foreground">
              {visitorLabel(conversation.visitor)}
            </h2>
            {/* On phones the name needs the room; the list row already shows the status. */}
            <StatusPill
              conversation={conversation}
              currentMemberId={currentMemberId}
              className="hidden sm:inline-flex"
            />
          </div>
          {typingWho && (
            <p className="text-xs text-signal" role="status">
              {typingWho} is typing…
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {viewers.length > 0 && (
          <TooltipProvider>
            <div
              className="mr-1 flex -space-x-2"
              role="group"
              aria-label={`Also viewing: ${viewers.map((v) => v.name).join(", ")}`}
            >
              {viewers.slice(0, 3).map((viewer) => (
                <Tooltip key={viewer.memberId}>
                  <TooltipTrigger asChild>
                    <span>
                      <PersonAvatar
                        id={viewer.memberId}
                        label={viewer.name}
                        className="size-7 ring-2 ring-card"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{viewer.name} is viewing</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}

        {isResolved ? (
          <Button variant="outline" size="sm" onClick={onReopen} disabled={isBusy}>
            <RotateCcw />
            Reopen
          </Button>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isBusy}>
                  {isMine
                    ? "Assign to…"
                    : (conversation.assignee?.name ?? "Assign to…")}
                  <ChevronDown className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {members.map((member) => {
                  const status = presence[member.id] ?? "offline";
                  return (
                    <DropdownMenuItem
                      key={member.id}
                      onSelect={() => onHandOver(member.id)}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          PRESENCE_DOT[status],
                        )}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">
                        {member.name}
                        {member.id === currentMemberId && (
                          <span className="text-muted-foreground"> (you)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {PRESENCE_LABEL[status]}
                      </span>
                      {member.id === conversation.assigneeId && (
                        <Check className="text-foreground" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {conversation.assigneeId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onUnassign}>
                      Move back to Unassigned
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {isMine ? (
              <Button size="sm" onClick={onResolve} disabled={isBusy}>
                Resolve
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={
                  conversation.status === "unassigned"
                    ? onAssignToMe
                    : () => onHandOver(currentMemberId!)
                }
              >
                Assign to me
              </Button>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleDetails}
          aria-label="Visitor details"
        >
          <PanelRight />
        </Button>
      </div>
    </header>
  );
}
