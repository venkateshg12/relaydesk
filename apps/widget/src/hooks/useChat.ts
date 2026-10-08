import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MessageItem,
  SendMessageAck,
  VisitorSummary,
  WidgetConfig,
} from "@repo/types";
import { createSession, getMessages, updateProfile } from "@/lib/api";
import {
  openSocket,
  type ConnectionState,
  type WidgetSocket,
} from "@/lib/socket";
import { store } from "@/lib/storage";

export interface OutboxItem {
  clientMessageId: string;
  body: string;
  status: "sending" | "failed";
}

const HISTORY_SIZE = 50;
const ACK_TIMEOUT_MS = 10_000;
const TYPING_TIMEOUT_MS = 3000;
const DEFAULT_COOLDOWN_SECONDS = 20;

const lastSeqOf = (messages: MessageItem[]) =>
  messages.reduce((max, m) => Math.max(max, m.seq), 0);

// Adds messages once, whichever way they arrive (event, ack, history, sync), in `seq` order.
const merge = (current: MessageItem[], incoming: MessageItem[]) => {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  return fresh.length
    ? [...current, ...fresh].sort((a, b) => a.seq - b.seq)
    : current;
};

// Only real web addresses are accepted by the server; anything else (file://, about:blank) is left out.
const reportablePageUrl = (url: string) =>
  /^https?:\/\//i.test(url) && url.length <= 2000 ? url : undefined;

interface Options {
  publicKey: string;
  // Where the visitor is now, reported with each message and whenever it changes.
  pageUrl: string;
  isOpen: boolean;
  // Told the moment a reply leaves for the server (the homepage demo measures delivery from it).
  onSent?: (clientMessageId: string) => void;
}

/*
  Everything the chat needs from the server, in one place. The shape follows the inbox:
  Postgres decides, the socket delivers — history comes over HTTP when the frame loads, the socket
  adds what happens next, and after every reconnect `sync` fetches what was missed *before* the
  outbox is replayed. A reply is kept in the outbox (and in localStorage) until the server confirms
  it, so a page change or a dropped connection never loses it; the server de-duplicates retries.
 */
export function useChat({ publicKey, pageUrl, isOpen, onSent }: Options) {
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [token, setToken] = useState<string | null>(null);
  const [widget, setWidget] = useState<WidgetConfig | null>(null);
  const [visitor, setVisitor] = useState<VisitorSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>(() =>
    store
      .getOutbox(publicKey)
      .map((item) => ({ ...item, status: "sending" as const })),
  );
  const [agentReadSeq, setAgentReadSeq] = useState(0);
  // `null` until the server says: the header shows nothing rather than guessing "online".
  const [isTeamOnline, setIsTeamOnline] = useState<boolean | null>(null);
  const [typingWho, setTypingWho] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("reconnecting");
  const [lastSync, setLastSync] = useState<{ count: number } | null>(null);
  const [unread, setUnread] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [hasDismissedPrompt, setHasDismissedPrompt] = useState(() =>
    store.hasDismissedPrompt(publicKey),
  );

  // Handlers are registered once per connection, so they read the latest values through refs.
  const socketRef = useRef<WidgetSocket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const outboxRef = useRef(outbox);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const pageUrlRef = useRef(pageUrl);
  pageUrlRef.current = pageUrl;
  const lastSeenSentRef = useRef(0);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addMessages = useCallback(
    (incoming: MessageItem[]) =>
      setMessages((current) => merge(current, incoming)),
    [],
  );

  const updateOutbox = useCallback(
    (next: OutboxItem[]) => {
      outboxRef.current = next;
      setOutbox(next);
      store.setOutbox(
        publicKey,
        next.map(({ clientMessageId, body }) => ({ clientMessageId, body })),
      );
    },
    [publicKey],
  );

  // --- Session: token → visitor, widget settings, conversation, recent history -------------------------------
  const start = useCallback(
    async (cachedToken: string | null) => {
      try {
        const session = await createSession(publicKey, cachedToken);
        store.setToken(publicKey, session.token);
        setWidget(session.widget);
        setVisitor(session.visitor);

        const conversation = session.conversation;
        conversationIdRef.current = conversation?.id ?? null;
        setAgentReadSeq(conversation?.agentLastReadSeq ?? 0);

        const history = conversation
          ? await getMessages(
              session.token,
              Math.max(0, conversation.lastSeq - HISTORY_SIZE),
            )
          : [];
        setMessages(history);
        // Agent replies that arrived while the visitor was away.
        setUnread(
          history.filter(
            (m) =>
              m.senderType === "agent" &&
              m.seq > (conversation?.visitorLastReadSeq ?? 0),
          ).length,
        );

        setToken(session.token);
        setPhase("ready");
      } catch {
        setPhase("failed");
      }
    },
    [publicKey],
  );

  // Once per mount: React's dev double-run would otherwise create two visitors from an empty storage.
  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    void start(store.getToken(publicKey));
  }, [publicKey, start]);

  // --- Sending ------------------------------------------------------------------------------------------------
  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    const timer = setInterval(
      () =>
        setCooldown((left) =>
          left <= 1 ? (clearInterval(timer), 0) : left - 1,
        ),
      1000,
    );
  }, []);

  const deliver = useCallback(
    async (item: OutboxItem) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;

      onSentRef.current?.(item.clientMessageId);
      const ack = await new Promise<SendMessageAck>((resolve) =>
        socket.timeout(ACK_TIMEOUT_MS).emit(
          "message:send",
          {
            conversationId: conversationIdRef.current ?? undefined,
            clientMessageId: item.clientMessageId,
            body: item.body,
            pageUrl: reportablePageUrl(pageUrlRef.current),
          },
          (timedOut, response) =>
            resolve(
              timedOut || !response
                ? { ok: false, error: "INTERNAL_ERROR" }
                : response,
            ),
        ),
      );

      if (ack.ok) {
        conversationIdRef.current = ack.message.conversationId;
        addMessages([ack.message]);
        updateOutbox(
          outboxRef.current.filter(
            (entry) => entry.clientMessageId !== item.clientMessageId,
          ),
        );
        return;
      }
      updateOutbox(
        outboxRef.current.map((entry) =>
          entry.clientMessageId === item.clientMessageId
            ? { ...entry, status: "failed" }
            : entry,
        ),
      );
      if (ack.error === "RATE_LIMITED")
        startCooldown(ack.retryAfter ?? DEFAULT_COOLDOWN_SECONDS);
    },
    [addMessages, startCooldown, updateOutbox],
  );

  const flushOutbox = useCallback(async () => {
    for (const item of outboxRef.current.filter(
      (entry) => entry.status === "sending",
    ))
      await deliver(item);
  }, [deliver]);

  const send = useCallback(
    (body: string) => {
      const item: OutboxItem = {
        clientMessageId: crypto.randomUUID(),
        body,
        status: "sending",
      };
      updateOutbox([...outboxRef.current, item]);
      return deliver(item);
    },
    [deliver, updateOutbox],
  );

  // "Not sent. Retry": the same clientMessageId, so a message that did arrive is not duplicated.
  const retry = useCallback(
    (clientMessageId: string) => {
      const item = outboxRef.current.find(
        (entry) => entry.clientMessageId === clientMessageId,
      );
      if (!item) return;
      const sending = { ...item, status: "sending" as const };
      updateOutbox(
        outboxRef.current.map((entry) => (entry === item ? sending : entry)),
      );
      return deliver(sending);
    },
    [deliver, updateOutbox],
  );

  // --- Realtime ------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    const socket = openSocket(token);
    socketRef.current = socket;

    // After every (re)connect — the first one too, since a message may have arrived after the history
    // was fetched: what was missed (paged until `hasMore` is false), then the outbox. Returns how many.
    const catchUp = async () => {
      const id = conversationIdRef.current;
      let synced = 0;
      if (id) {
        let lastSeq = lastSeqOf(messagesRef.current);
        for (;;) {
          const ack = await new Promise<{
            ok: boolean;
            messages?: MessageItem[];
            more?: boolean;
          }>((resolve) =>
            socket
              .timeout(ACK_TIMEOUT_MS)
              .emit(
                "sync",
                { conversations: [{ id, lastSeq }] },
                (timedOut, response) =>
                  resolve(
                    timedOut || !response?.ok
                      ? { ok: false }
                      : {
                          ok: true,
                          messages: response.messages[id] ?? [],
                          more: response.hasMore[id],
                        },
                  ),
              ),
          );
          if (!ack.ok || !ack.messages?.length) break;
          synced += ack.messages.length;
          addMessages(ack.messages);
          if (!ack.more) break;
          lastSeq = lastSeqOf(ack.messages);
        }
      }
      await flushOutbox();
      return synced;
    };

    let hasConnectedBefore = false;
    socket.on("connect", () => {
      setConnection("connected");
      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;
      void catchUp().then(
        (synced) => isReconnect && setLastSync({ count: synced }),
      );
    });
    socket.on("disconnect", (reason) => {
      setConnection("reconnecting");
      // Socket.IO doesn't retry after the server itself closed the connection (a deploy or restart).
      if (reason === "io server disconnect")
        setTimeout(() => socket.connect(), 2000);
    });
    socket.on("connect_error", (error) => {
      setConnection("reconnecting");
      // The token is no longer valid (the visitor was removed): start over as a new visitor.
      if (error.message === "UNAUTHORIZED") {
        store.setToken(publicKey, null);
        void start(null);
      }
    });

    socket.on("message:new", (message) => {
      conversationIdRef.current = message.conversationId;
      addMessages([message]);
      if (message.senderType === "agent" && !isOpenRef.current)
        setUnread((count) => count + 1);
    });
    socket.on("message:seen", ({ by, seq }) => {
      if (by === "agent") setAgentReadSeq((current) => Math.max(current, seq));
    });
    socket.on("typing", ({ who, isTyping }) => {
      clearTimeout(typingTimer.current);
      setTypingWho(isTyping ? who : null);
      if (isTyping)
        typingTimer.current = setTimeout(
          () => setTypingWho(null),
          TYPING_TIMEOUT_MS,
        );
    });
    socket.on("presence:update", ({ workspaceOnline }) =>
      setIsTeamOnline(workspaceOnline),
    );
    socket.on("workspace:updated", ({ widget: next }) => setWidget(next));

    return () => {
      clearTimeout(typingTimer.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, publicKey, addMessages, flushOutbox, start]);

  // Opening the window clears the badge; while it is open, everything the team wrote counts as read.
  useEffect(() => {
    if (!isOpen) return;
    setUnread(0);
    const id = conversationIdRef.current;
    const latest = lastSeqOf(messages);
    if (id && connection === "connected" && latest > lastSeenSentRef.current) {
      lastSeenSentRef.current = latest;
      socketRef.current?.emit("message:seen", {
        conversationId: id,
        seq: latest,
      });
    }
  }, [isOpen, messages, connection]);

  // The page the visitor is on, even before they write: agents see it change.
  useEffect(() => {
    const url = reportablePageUrl(pageUrl);
    if (!token || !url) return;
    const timer = setTimeout(
      () => void updateProfile(token, { pageUrl: url }).catch(() => undefined),
      500,
    );
    return () => clearTimeout(timer);
  }, [token, pageUrl]);

  const setTyping = useCallback((isTyping: boolean) => {
    const id = conversationIdRef.current;
    if (id) socketRef.current?.emit("typing", { conversationId: id, isTyping });
  }, []);

  const saveProfile = useCallback(
    async (profile: { name?: string; email?: string }) => {
      if (token) setVisitor(await updateProfile(token, profile));
    },
    [token],
  );

  // For the homepage demo's "Go offline": drop the connection on purpose, and bring it back.
  const setNetwork = useCallback((isOnline: boolean) => {
    if (isOnline) socketRef.current?.connect();
    else socketRef.current?.disconnect();
  }, []);

  const dismissPrompt = useCallback(() => {
    store.dismissPrompt(publicKey);
    setHasDismissedPrompt(true);
  }, [publicKey]);

  return {
    phase,
    widget,
    visitor,
    messages,
    outbox,
    agentReadSeq,
    isTeamOnline,
    typingWho,
    connection,
    lastSync,
    unread,
    cooldown,
    hasDismissedPrompt,
    send,
    retry,
    setTyping,
    saveProfile,
    setNetwork,
    dismissPrompt,
  };
}
