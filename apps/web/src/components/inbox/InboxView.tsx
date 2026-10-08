"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useConversations } from "@/hooks/conversations/useConversations";
import { useConversationDetails } from "@/hooks/conversations/useConversationDetails";
import { useRealtimeInbox } from "@/hooks/realtime/useRealtimeInbox";
import { useConnectionState } from "@/hooks/realtime/useConnectionState";
import { useOutbox } from "@/hooks/realtime/useOutbox";
import { useConversationCounts } from "@/hooks/inbox/useConversationCounts";
import { useConversationNotes } from "@/hooks/inbox/useConversationNotes";
import { useInboxMutations } from "@/hooks/inbox/useInboxMutations";
import { useReplyComposer } from "@/hooks/inbox/useReplyComposer";
import { useMembers } from "@/hooks/team/useMembers";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { emitSeen } from "@/lib/socket";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectConversation,
  setActiveTab,
  type InboxTab,
} from "@/store/slices/inboxUiSlice";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConnectionBar } from "@/components/realtime/ConnectionBar";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { Timeline } from "./Timeline";
import { Composer } from "./Composer";
import { VisitorDetails } from "./VisitorDetails";
import { SavedReplyPicker } from "./SavedReplyPicker";
import { visitorLabel } from "./format";

export interface InboxViewProps {
  // The homepage demo renders the inbox inside a fixed-height panel.
  isEmbedded?: boolean;
}

// Each tab is one server-side filter; "open" is everything not resolved.
const TAB_FILTERS: Record<
  InboxTab,
  { status?: "unassigned" | "resolved" | "open"; mine?: true }
> = {
  unassigned: { status: "unassigned" },
  mine: { mine: true },
  open: { status: "open" },
  resolved: { status: "resolved" },
};

/*
  The inbox frame (DESIGN_SYSTEM §7): lists 320px | conversation | visitor details 300px. Below 1280px
  the details open as a sheet; below 768px one column shows at a time, with a back button.
 */
export function InboxView({ isEmbedded = false }: InboxViewProps) {
  const dispatch = useAppDispatch();
  const currentMemberId = useAppSelector((state) => state.auth.member?.id);
  const { activeTab, selectedConversationId: selectedId } = useAppSelector(
    (state) => state.inboxUi,
  );
  const isWide = useMediaQuery("(min-width: 1280px)");
  const connection = useConnectionState();

  const [detailsOpen, setDetailsOpen] = useState(true);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  const { data: counts } = useConversationCounts();
  const { data: members = [] } = useMembers();
  const {
    assignMutation,
    unassignMutation,
    resolveMutation,
    reopenMutation,
    addNoteMutation,
  } = useInboxMutations();
  const { typingWho, viewers, presence, arrivalConvId, lastSync } =
    useRealtimeInbox(selectedId);

  const list = useConversations(TAB_FILTERS[activeTab]);
  const conversations = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );
  const loadMore = useCallback(() => void list.fetchNextPage(), [list]);

  // On wide screens open the newest conversation straight away.
  useEffect(() => {
    if (
      !selectedId &&
      conversations[0] &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      dispatch(selectConversation(conversations[0].id));
    }
  }, [conversations, selectedId, dispatch]);

  const { data: conversation, isLoading: isConversationLoading } =
    useConversationDetails(selectedId);
  const { data: notes = [] } = useConversationNotes(selectedId);
  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);
  const pending = useOutbox(selectedId);

  const composer = useReplyComposer({
    conversationId: selectedId,
    addNote: (body) =>
      selectedId && addNoteMutation.mutate({ id: selectedId, data: { body } }),
  });

  // Reading is a mark the visitor sees ("Seen"): the open conversation counts as read up to its last
  // message while the tab is visible. Repeats are free — the server only moves the mark forward.
  const openId = conversation?.id;
  const openLastSeq = conversation?.lastSeq ?? 0;
  const openReadSeq = conversation?.agentLastReadSeq ?? 0;
  useEffect(() => {
    if (
      !openId ||
      openLastSeq <= openReadSeq ||
      document.visibilityState !== "visible"
    )
      return;
    emitSeen(openId, openLastSeq);
  }, [openId, openLastSeq, openReadSeq, connection]);

  const toggleDetails = () =>
    isWide && !isEmbedded
      ? setDetailsOpen((open) => !open)
      : setDetailsSheetOpen(true);

  return (
    <div
      className={cn(
        "flex w-full min-h-0 flex-col overflow-hidden bg-background",
        isEmbedded
          ? "h-[580px] rounded-xl border border-border"
          : "h-[calc(100vh-3.5rem)]",
      )}
    >
      {/* Above all three columns, so it reads as the state of the whole thread, not of the list. */}
      <ConnectionBar lastSync={lastSync} />
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex w-full flex-col border-r border-border bg-card md:shrink-0",
            isEmbedded ? "md:w-[250px]" : "md:w-[320px]",
            selectedId && "hidden md:flex",
          )}
          aria-label="Conversations"
        >
          <ConversationList
            activeTab={activeTab}
            onTabChange={(tab) => dispatch(setActiveTab(tab))}
            counts={{
              unassigned: counts?.unassigned,
              mine: counts?.mine,
              open: counts?.allOpen,
              resolved: counts?.resolved,
            }}
            conversations={conversations}
            isLoading={list.isLoading}
            hasNextPage={Boolean(list.hasNextPage)}
            isFetchingNextPage={list.isFetchingNextPage}
            onLoadMore={loadMore}
            selectedId={selectedId}
            arrivalId={arrivalConvId}
            currentMemberId={currentMemberId}
            onSelect={(id) => dispatch(selectConversation(id))}
          />
        </aside>

        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            !selectedId && "hidden md:flex",
          )}
          aria-label="Conversation"
        >
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <MessageSquare
                className="size-8 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                Pick a conversation to read and reply.
              </p>
            </div>
          ) : !conversation ? (
            <Timeline
              messages={[]}
              notes={[]}
              visitorName=""
              isLoading={isConversationLoading}
            />
          ) : (
            <>
              <ConversationHeader
                conversation={conversation}
                currentMemberId={currentMemberId}
                members={members}
                presence={presence}
                typingWho={typingWho}
                viewers={viewers}
                onBack={
                  isEmbedded
                    ? undefined
                    : () => dispatch(selectConversation(null))
                }
                onToggleDetails={toggleDetails}
                onAssignToMe={() =>
                  assignMutation.mutate({ id: conversation.id })
                }
                onHandOver={(memberId) =>
                  assignMutation.mutate({ id: conversation.id, memberId })
                }
                onUnassign={() => unassignMutation.mutate(conversation.id)}
                onResolve={() => resolveMutation.mutate(conversation.id)}
                onReopen={() => reopenMutation.mutate(conversation.id)}
                isBusy={
                  assignMutation.isPending ||
                  unassignMutation.isPending ||
                  resolveMutation.isPending ||
                  reopenMutation.isPending
                }
              />
              <Timeline
                key={conversation.id}
                messages={messages}
                notes={notes}
                pending={pending}
                visitorName={visitorLabel(conversation.visitor)}
                visitorLastReadSeq={conversation.visitorLastReadSeq}
                currentMemberId={currentMemberId}
                isLoading={false}
                onRetry={(clientMessageId) =>
                  void composer.retry(clientMessageId)
                }
              />
              <Composer
                ref={composer.textareaRef}
                mode={composer.mode}
                onModeChange={composer.setMode}
                value={composer.draft}
                onChange={composer.handleChange}
                onSend={composer.submit}
                onKeyDown={composer.onKeyDown}
                activeOptionId={composer.activeOptionId}
                isSending={addNoteMutation.isPending}
              >
                {composer.picker.isOpen && (
                  <SavedReplyPicker
                    matches={composer.picker.matches}
                    activeIndex={composer.picker.activeIndex}
                    onSelect={composer.picker.pick}
                  />
                )}
              </Composer>
            </>
          )}
        </section>

        {conversation && isWide && !isEmbedded && detailsOpen && (
          <aside
            className="w-[300px] shrink-0 overflow-y-auto border-l border-border bg-card"
            aria-label="Visitor details"
          >
            <VisitorDetails visitor={conversation.visitor} />
          </aside>
        )}

        {conversation && (!isWide || isEmbedded) && (
          <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
            <SheetContent
              side="right"
              className="w-[300px] p-0 sm:max-w-[300px]"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Visitor details</SheetTitle>
              </SheetHeader>
              <VisitorDetails visitor={conversation.visitor} />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
