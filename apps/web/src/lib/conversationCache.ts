import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import type {
  ConversationDetail,
  ConversationSummary,
  MemberOption,
  MessageItem,
  PaginatedResult,
  ServerConversationUpdatedPayload,
  ServerMessageSeenPayload,
  VisitorSummary,
} from "@repo/types";
import type { GetConversationsParams } from "@/api/conversations";

/*
  Socket events patch the TanStack Query cache instead of refetching (the same idea as the e-commerce
  mutation hooks seeding the cache). Two kinds of entry exist:
    ["conversation", id]            the open conversation, with its messages
    ["conversations", filters]      one inbox list per tab, a page at a time
  Every function here is a pure patch; the hook decides when to call them.
 */
type ConversationList = InfiniteData<PaginatedResult<ConversationSummary>>;

const PREVIEW_LENGTH = 120;

// A row belongs in a tab if it matches that tab's filter — the same rule the server applies.
const belongsTo = (
  filters: Omit<GetConversationsParams, "page">,
  row: Pick<ConversationSummary, "status" | "assigneeId">,
  currentMemberId: string | undefined,
) =>
  (!filters.status ||
    filters.status === row.status ||
    (filters.status === "open" && row.status !== "resolved")) &&
  (!filters.mine || row.assigneeId === currentMemberId);

const mapRows = (
  list: ConversationList,
  change: (row: ConversationSummary) => ConversationSummary,
): ConversationList => ({
  ...list,
  pages: list.pages.map((page) => ({ ...page, items: page.items.map(change) })),
});

const hasRow = (list: ConversationList, id: string) =>
  list.pages.some((page) => page.items.some((row) => row.id === id));

// Adds a message to an open conversation once, whichever way it arrives (event, ack, sync).
export const mergeMessages = (
  queryClient: QueryClient,
  conversationId: string,
  incoming: MessageItem[],
) => {
  queryClient.setQueryData<ConversationDetail>(
    ["conversation", conversationId],
    (old) => {
      if (!old) return old;
      const known = new Set(old.messages.map((message) => message.id));
      const fresh = incoming.filter((message) => !known.has(message.id));
      if (fresh.length === 0) return old;

      const messages = [...old.messages, ...fresh].sort(
        (a, b) => a.seq - b.seq,
      );
      const last = messages[messages.length - 1]!;
      return {
        ...old,
        messages,
        lastSeq: Math.max(old.lastSeq, last.seq),
        lastMessageAt: last.createdAt,
        lastMessagePreview: last.body.slice(0, PREVIEW_LENGTH),
      };
    },
  );
};

/*
  A message arrived: bump its row to the top of every list that already has it, with the new preview
  and `lastSeq` (which is what makes the unread count grow). Returns whether any list was missing the
  row — a brand-new conversation, or one that just moved into a tab — so the caller can refetch those.
 */
export const applyMessageToLists = (
  queryClient: QueryClient,
  message: MessageItem,
  isOpen: boolean,
): boolean => {
  let missing = false;

  queryClient.setQueriesData<ConversationList>(
    { queryKey: ["conversations"] },
    (list) => {
      if (!list) return list;
      if (!hasRow(list, message.conversationId)) {
        missing = true;
        return list;
      }

      let moved: ConversationSummary | undefined;
      const pages = list.pages.map((page) => ({
        ...page,
        items: page.items.filter((row) => {
          if (row.id !== message.conversationId) return true;
          moved = {
            ...row,
            lastSeq: Math.max(row.lastSeq, message.seq),
            lastMessageAt: message.createdAt,
            lastMessagePreview: message.body.slice(0, PREVIEW_LENGTH),
            // The agent is looking at it right now, so it is read on arrival.
            agentLastReadSeq:
              isOpen || message.senderType === "agent"
                ? message.seq
                : row.agentLastReadSeq,
          };
          return false;
        }),
      }));
      pages[0] = { ...pages[0]!, items: [moved!, ...pages[0]!.items] };
      return { ...list, pages };
    },
  );

  return missing;
};

/*
  A conversation changed state (assigned, resolved, reopened, a visitor reopened it by writing). Patch
  the row where it is, drop it from lists it no longer belongs to, and report whether some list that
  should now contain it doesn't — that one needs a refetch.
 */
export const applyConversationUpdate = (
  queryClient: QueryClient,
  payload: ServerConversationUpdatedPayload,
  currentMemberId: string | undefined,
): boolean => {
  let needsRefetch = false;

  // Who has it now: named in the event when the sender knew; otherwise unchanged, or — when it did change,
  // as when a visitor's message reopens a conversation — looked up among the members we already hold.
  const assigneeOf = (current: ConversationSummary["assignee"]) => {
    if (payload.assignee !== undefined) return payload.assignee;
    if (payload.assigneeId === (current?.id ?? null)) return current ?? null;
    const name = queryClient
      .getQueryData<MemberOption[]>(["members"])
      ?.find((member) => member.id === payload.assigneeId)?.name;
    return payload.assigneeId && name ? { id: payload.assigneeId, name } : null;
  };

  for (const [key, list] of queryClient.getQueriesData<ConversationList>({
    queryKey: ["conversations"],
  })) {
    if (!list) continue;
    const filters = (key[1] ?? {}) as Omit<GetConversationsParams, "page">;
    const fits = belongsTo(filters, payload, currentMemberId);
    const present = hasRow(list, payload.id);

    if (fits && !present) needsRefetch = true;
    queryClient.setQueryData<ConversationList>(key, {
      ...list,
      pages: list.pages.map((page) => ({
        ...page,
        items: page.items
          .map((row) =>
            row.id !== payload.id
              ? row
              : {
                  ...row,
                  status: payload.status,
                  assigneeId: payload.assigneeId,
                  assignee: assigneeOf(row.assignee),
                  lastMessageAt: payload.lastMessageAt ?? row.lastMessageAt,
                  lastMessagePreview: payload.preview ?? row.lastMessagePreview,
                },
          )
          .filter((row) => row.id !== payload.id || fits),
      })),
    });
  }

  queryClient.setQueryData<ConversationDetail>(
    ["conversation", payload.id],
    (old) =>
      old
        ? {
            ...old,
            status: payload.status,
            assigneeId: payload.assigneeId,
            assignee: assigneeOf(old.assignee),
          }
        : old,
  );
  return needsRefetch;
};

// A read mark moved forward: the open conversation (for the delivery marks) and the list row (for the unread count).
export const applySeen = (
  queryClient: QueryClient,
  payload: ServerMessageSeenPayload,
) => {
  const field =
    payload.by === "agent" ? "agentLastReadSeq" : "visitorLastReadSeq";

  queryClient.setQueryData<ConversationDetail>(
    ["conversation", payload.conversationId],
    (old) =>
      old ? { ...old, [field]: Math.max(old[field], payload.seq) } : old,
  );
  queryClient.setQueriesData<ConversationList>(
    { queryKey: ["conversations"] },
    (list) =>
      list
        ? mapRows(list, (row) =>
            row.id === payload.conversationId
              ? { ...row, [field]: Math.max(row[field], payload.seq) }
              : row,
          )
        : list,
  );
};

// A visitor gave their name or email, or moved to another page: every row and open conversation about them.
export const applyVisitorUpdate = (
  queryClient: QueryClient,
  visitor: VisitorSummary,
) => {
  queryClient.setQueriesData<ConversationList>(
    { queryKey: ["conversations"] },
    (list) =>
      list
        ? mapRows(list, (row) =>
            row.visitorId === visitor.id ? { ...row, visitor } : row,
          )
        : list,
  );
  for (const [key, detail] of queryClient.getQueriesData<ConversationDetail>({
    queryKey: ["conversation"],
  })) {
    if (detail?.visitorId === visitor.id)
      queryClient.setQueryData<ConversationDetail>(key, { ...detail, visitor });
  }
};
