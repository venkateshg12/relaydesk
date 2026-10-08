import { io, type Socket } from "socket.io-client";
import type {
  ClientSendMessageSchema,
  ClientSyncSchema,
  ClientToServerEvents,
  JoinAck,
  SendMessageAck,
  ServerToClientEvents,
  SyncAck,
} from "@repo/types";
import { getMeApi } from "@/api/auth";
import type { ApiError } from "@/lib/api";

export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// A reply that hasn't been acknowledged yet. It stays here — and is replayed on reconnect — until the
// server confirms it, so a message typed while offline is never lost. The server de-duplicates on
// `clientMessageId`, which makes every replay and every Retry safe.
export interface OutboxItem {
  clientMessageId: string;
  conversationId: string;
  body: string;
  status: "sending" | "failed";
}

const ACK_TIMEOUT_MS = 10_000;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let socket: AppSocket | null = null;

// Both stores are tiny external stores: components read them with `useSyncExternalStore`, so the
// snapshot must stay referentially stable until something changes.
let connectionState: ConnectionState = "disconnected";
let outbox: OutboxItem[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const setConnectionState = (state: ConnectionState) => {
  if (state === connectionState) return;
  connectionState = state;
  notify();
};

const setOutbox = (next: OutboxItem[]) => {
  outbox = next;
  notify();
};

const updateOutboxItem = (
  clientMessageId: string,
  patch: Partial<OutboxItem>,
) =>
  setOutbox(
    outbox.map((item) =>
      item.clientMessageId === clientMessageId ? { ...item, ...patch } : item,
    ),
  );

export const connectionStore = {
  subscribe,
  getSnapshot: () => connectionState,
};
export const outboxStore = { subscribe, getSnapshot: () => outbox };

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      // WebSocket only: with the Redis adapter that needs no sticky sessions on the host.
      transports: ["websocket"],
      autoConnect: false,
      reconnectionDelayMax: 3000,
    });

    // State for the connection bar. What to do after (re)connecting — rejoin the open conversation,
    // sync, replay the outbox — belongs to `useRealtimeInbox`, in that order.
    socket.on("connect", () => setConnectionState("connected"));
    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect")
        return setConnectionState("disconnected");
      setConnectionState("reconnecting");
      // Socket.IO does not retry after the server itself closed the connection (a deploy or restart).
      if (reason === "io server disconnect") reconnectLater();
    });
    socket.on("connect_error", (error) => {
      setConnectionState("reconnecting");
      // A handshake rejected by the server is not retried by Socket.IO either.
      if (error.message === "UNAUTHORIZED") void renewSessionAndReconnect();
    });
  }
  return socket;
}

const RETRY_DELAY_MS = 2000;

const reconnectLater = () => {
  setTimeout(() => {
    if (socket && !socket.connected && !socket.active) socket.connect();
  }, RETRY_DELAY_MS);
};

// The handshake checks the access cookie, which lasts 15 minutes and may have lapsed while the tab sat
// open. Any authenticated request renews it (the HTTP client's silent refresh), so ask for the
// profile, then connect again. If the session is truly gone, that request signs the agent out.
let isRenewing = false;
const renewSessionAndReconnect = async () => {
  if (isRenewing) return;
  isRenewing = true;
  try {
    await getMeApi();
    socket?.connect();
  } catch (error) {
    // 401 means the session itself is gone and the HTTP client is already signing the agent out.
    if ((error as ApiError).status === 401) disconnectSocket();
    else reconnectLater();
  } finally {
    isRenewing = false;
  }
};

export function connectSocket(): AppSocket {
  const instance = getSocket();
  if (!instance.connected && !instance.active) {
    setConnectionState("reconnecting");
    instance.connect();
  }
  return instance;
}

// On sign-out: close the connection and forget anything unsent.
export function disconnectSocket(): void {
  socket?.disconnect();
  setOutbox([]);
}

const transmit = (item: OutboxItem): Promise<SendMessageAck> => {
  const payload: ClientSendMessageSchema = {
    conversationId: item.conversationId,
    clientMessageId: item.clientMessageId,
    body: item.body,
  };

  return new Promise((resolve) => {
    getSocket()
      .timeout(ACK_TIMEOUT_MS)
      .emit("message:send", payload, (timedOut, ack) => {
        if (timedOut || !ack)
          return resolve({ ok: false, error: "INTERNAL_ERROR" });
        resolve(ack);
      });
  });
};

// Sends one outbox item. Offline, it simply stays queued ("sending") for `flushOutbox`.
async function deliver(item: OutboxItem): Promise<SendMessageAck | null> {
  if (!getSocket().connected) return null;

  const ack = await transmit(item);
  if (ack.ok)
    setOutbox(
      outbox.filter((entry) => entry.clientMessageId !== item.clientMessageId),
    );
  else updateOutboxItem(item.clientMessageId, { status: "failed" });
  return ack;
}

export function sendRealtimeMessage(
  payload: Omit<OutboxItem, "status">,
): Promise<SendMessageAck | null> {
  const item: OutboxItem = { ...payload, status: "sending" };
  setOutbox([...outbox, item]);
  return deliver(item);
}

// "Not sent. Retry": the same clientMessageId, so a message that did arrive is not duplicated.
export function retryMessage(
  clientMessageId: string,
): Promise<SendMessageAck | null> {
  const item = outbox.find(
    (entry) => entry.clientMessageId === clientMessageId,
  );
  if (!item) return Promise.resolve(null);
  updateOutboxItem(clientMessageId, { status: "sending" });
  return deliver({ ...item, status: "sending" });
}

// Replays everything still queued. Called after a reconnect has synced, never before: the replay
// then lands on a conversation that already shows what it missed.
export async function flushOutbox(): Promise<SendMessageAck[]> {
  const queued = outbox.filter((item) => item.status === "sending");
  const acks = await Promise.all(queued.map(deliver));
  return acks.filter((ack): ack is SendMessageAck => ack !== null);
}

export function emitTyping(conversationId: string, isTyping: boolean): void {
  if (socket?.connected) socket.emit("typing", { conversationId, isTyping });
}

export function emitSeen(conversationId: string, seq: number): void {
  if (socket?.connected) socket.emit("message:seen", { conversationId, seq });
}

export function joinConversation(conversationId: string): Promise<JoinAck> {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: "OFFLINE" });
    socket.emit("conversation:join", { conversationId }, resolve);
  });
}

export function leaveConversation(conversationId: string): void {
  if (socket?.connected) socket.emit("conversation:leave", { conversationId });
}

export function setPresenceStatus(status: "online" | "away"): void {
  if (socket?.connected) socket.emit("presence:set", { status });
}

export function syncConversations(payload: ClientSyncSchema): Promise<SyncAck> {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: "OFFLINE" });
    socket.timeout(ACK_TIMEOUT_MS).emit("sync", payload, (timedOut, ack) => {
      resolve(timedOut || !ack ? { ok: false, error: "TIMEOUT" } : ack);
    });
  });
}
