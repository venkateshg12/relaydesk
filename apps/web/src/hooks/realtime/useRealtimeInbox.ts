"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ConversationDetail,
  NoteItem,
  ServerConversationViewersPayload,
  ServerPresenceUpdatePayload,
  ServerToClientEvents,
} from "@repo/types";
import {
  connectSocket,
  flushOutbox,
  joinConversation,
  leaveConversation,
  syncConversations,
} from "@/lib/socket";
import {
  applyConversationUpdate,
  applyMessageToLists,
  applySeen,
  applyVisitorUpdate,
  mergeMessages,
} from "@/lib/conversationCache";
import { useAppSelector } from "@/store/hooks";
import { useConnectionState } from "./useConnectionState";

type Viewer = ServerConversationViewersPayload["viewers"][number];
type Presence = ServerPresenceUpdatePayload["status"];

const TYPING_TIMEOUT_MS = 3000;
const ARRIVAL_HIGHLIGHT_MS = 1500;

/*
  The inbox's socket: connects once, keeps the TanStack Query cache in step with what the server
  announces, and — after every reconnect — rejoins the open conversation, asks Postgres for what was
  missed (`sync`), and only then replays unsent replies. Postgres decides, sockets deliver: nothing
  here is the source of truth, so a missed event is repaired by the sync, never by guessing.
 */
export function useRealtimeInbox(activeConversationId: string | null) {
  const queryClient = useQueryClient();
  const currentMemberId = useAppSelector((state) => state.auth.member?.id);
  const connection = useConnectionState();

  const [typing, setTyping] = useState<Record<string, string>>({});
  const [viewersByConversation, setViewersByConversation] = useState<
    Record<string, Viewer[]>
  >({});
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [arrivalConvId, setArrivalConvId] = useState<string | null>(null);
  // Set each time a reconnect finished catching up; the connection bar reads the count from it.
  const [lastSync, setLastSync] = useState<{ count: number } | null>(null);

  // The handlers are registered once, so they read the latest values through refs.
  const activeIdRef = useRef(activeConversationId);
  activeIdRef.current = activeConversationId;
  const memberIdRef = useRef(currentMemberId);
  memberIdRef.current = currentMemberId;
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const hasConnectedBefore = useRef(false);

  // Join the open conversation (typing, read marks, "also viewing"). A reconnect is a brand-new
  // connection with no rooms, so this runs again whenever the connection comes back.
  useEffect(() => {
    if (!activeConversationId || connection !== "connected") return;

    let isCurrent = true;
    void joinConversation(activeConversationId).then((ack) => {
      if (ack.ok && isCurrent)
        setViewersByConversation((prev) => ({
          ...prev,
          [activeConversationId]: ack.viewers,
        }));
    });
    return () => {
      isCurrent = false;
      leaveConversation(activeConversationId);
    };
  }, [activeConversationId, connection]);

  // Everything the cache needs after a reconnect: refreshed lists, the messages of every open
  // conversation the server has beyond what we hold (paged until `hasMore` is false), then the outbox.
  const catchUp = useCallback(async () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["conversationCounts"] });

    const held = queryClient
      .getQueriesData<ConversationDetail>({ queryKey: ["conversation"] })
      .flatMap(([, detail]) =>
        detail ? [{ id: detail.id, lastSeq: detail.lastSeq }] : [],
      );

    let synced = 0;
    let pending = held;
    while (pending.length > 0) {
      const ack = await syncConversations({ conversations: pending });
      if (!ack.ok) break;

      pending = [];
      for (const [id, messages] of Object.entries(ack.messages)) {
        if (messages.length === 0) continue;
        synced += messages.length;
        mergeMessages(queryClient, id, messages);
        if (ack.hasMore[id])
          pending.push({ id, lastSeq: messages[messages.length - 1]!.seq });
      }
    }

    for (const ack of await flushOutbox()) {
      if (ack.ok)
        mergeMessages(queryClient, ack.message.conversationId, [ack.message]);
    }
    setLastSync({ count: synced });
  }, [queryClient]);

  useEffect(() => {
    const socket = connectSocket();

    const handleConnect = () => {
      if (hasConnectedBefore.current) void catchUp();
      else {
        // The first connection has no cached messages to sync. The lists were fetched before it was
        // up, though, so anything that arrived in between is picked up by refetching them.
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void queryClient.invalidateQueries({
          queryKey: ["conversationCounts"],
        });
        void flushOutbox();
      }
      hasConnectedBefore.current = true;
    };

    socket.on("connect", handleConnect);
    if (socket.connected) handleConnect();

    // Each listener is removed by reference, so another hook's listeners on the shared socket survive.
    const subscriptions: (() => void)[] = [];
    const listen = <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E],
    ) => {
      socket.on(event, handler as never);
      subscriptions.push(() => socket.off(event, handler as never));
    };

    listen("message:new", (message) => {
      mergeMessages(queryClient, message.conversationId, [message]);
      const isMissingFromAList = applyMessageToLists(
        queryClient,
        message,
        activeIdRef.current === message.conversationId,
      );
      if (isMissingFromAList)
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversationCounts"] });

      if (message.senderType === "visitor") {
        setArrivalConvId(message.conversationId);
        setTimeout(
          () =>
            setArrivalConvId((id) =>
              id === message.conversationId ? null : id,
            ),
          ARRIVAL_HIGHLIGHT_MS,
        );
      }
    });

    listen("conversation:updated", (payload) => {
      if (applyConversationUpdate(queryClient, payload, memberIdRef.current)) {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["conversationCounts"] });
    });

    listen("message:seen", (payload) => {
      applySeen(queryClient, payload);
      if (payload.by === "agent")
        void queryClient.invalidateQueries({
          queryKey: ["conversationCounts"],
        });
    });

    // Cleared by an explicit stop, or three seconds after the last event, whichever comes first.
    listen("typing", ({ conversationId, who, isTyping }) => {
      clearTimeout(typingTimers.current[conversationId]);
      const stop = () =>
        setTyping((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([id]) => id !== conversationId),
          ),
        );
      if (!isTyping) return stop();

      setTyping((prev) => ({ ...prev, [conversationId]: who }));
      typingTimers.current[conversationId] = setTimeout(
        stop,
        TYPING_TIMEOUT_MS,
      );
    });

    listen("conversation:viewers", ({ conversationId, viewers }) =>
      setViewersByConversation((prev) => ({
        ...prev,
        [conversationId]: viewers,
      })),
    );

    listen("visitor:updated", (visitor) =>
      applyVisitorUpdate(queryClient, visitor),
    );

    listen("note:new", ({ note }) =>
      queryClient.setQueryData<NoteItem[]>(
        ["conversationNotes", note.conversationId],
        (old) =>
          old && !old.some((existing) => existing.id === note.id)
            ? [...old, note]
            : old,
      ),
    );

    listen("presence:update", ({ memberId, status }) =>
      setPresence((prev) => ({ ...prev, [memberId]: status })),
    );
    listen("presence:snapshot", ({ members }) => setPresence(members));

    const timers = typingTimers.current;
    return () => {
      socket.off("connect", handleConnect);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [queryClient, catchUp]);

  return {
    typingWho: activeConversationId
      ? (typing[activeConversationId] ?? null)
      : null,
    // Other agents with this conversation open, not the signed-in agent's own tabs.
    viewers: (activeConversationId
      ? (viewersByConversation[activeConversationId] ?? [])
      : []
    ).filter((viewer) => viewer.memberId !== currentMemberId),
    presence,
    arrivalConvId,
    lastSync,
  };
}
