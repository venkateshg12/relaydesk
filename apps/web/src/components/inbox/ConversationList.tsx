"use client";

import { useEffect, useRef } from "react";
import type { ConversationSummary } from "@repo/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InboxTab } from "@/store/slices/inboxUiSlice";
import { ConversationRow } from "./ConversationRow";

const TABS: { id: InboxTab; label: string }[] = [
  { id: "unassigned", label: "Unassigned" },
  { id: "mine", label: "Mine" },
  { id: "open", label: "All open" },
  { id: "resolved", label: "Resolved" },
];

// One sentence saying what will appear here (DESIGN_SYSTEM §8, empty states).
const EMPTY_STATE: Record<InboxTab, string> = {
  open: "No open conversations. They appear here as soon as a visitor writes.",
  unassigned: "No unassigned conversations. New chats land here first.",
  mine: "Nothing assigned to you. Take one from Unassigned.",
  resolved: "No resolved conversations yet.",
};

interface ConversationListProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts: Partial<Record<InboxTab, number>>;
  conversations: ConversationSummary[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  selectedId: string | null;
  arrivalId: string | null;
  currentMemberId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({
  activeTab,
  onTabChange,
  counts,
  conversations,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  selectedId,
  arrivalId,
  currentMemberId,
  onSelect,
}: ConversationListProps) {
  // Loads the next page when the bottom of the list scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) onLoadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as InboxTab)}
        >
          {/* Two by two, so all four lists and their counts fit even in the demo's narrow column. */}
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl p-1 group-data-horizontal/tabs:h-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-8 justify-between gap-1 rounded-lg px-2.5 text-[13px]"
              >
                {tab.label}
                {counts[tab.id] !== undefined && (
                  <span className="rounded-full bg-background px-1.5 text-[11px] leading-[18px] text-muted-foreground tabular-nums">
                    {counts[tab.id]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-1" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex min-h-[72px] items-center gap-3 px-3"
              >
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {EMPTY_STATE[activeTab]}
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                currentMemberId={currentMemberId}
                isSelected={conversation.id === selectedId}
                isArrival={conversation.id === arrivalId}
                showStatus={activeTab === "open"}
                onSelect={onSelect}
              />
            ))}
            <div ref={sentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <Skeleton className="mx-3 my-2 h-14 rounded-lg" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
