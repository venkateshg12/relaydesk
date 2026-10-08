import http from "http";
import type { AddressInfo } from "net";
import { io as connect, type Socket } from "socket.io-client";
import { createApp } from "../../index.js";
import { initSocketServer, closeSocketServer } from "../../realtime/socket.js";

// The real Express + Socket.IO app, listening on a random port — no mocks of Postgres or Redis, because the
// rules under test are database and Redis behaviour.
export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const server = http.createServer(createApp());
  initSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      await closeSocketServer();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// A connected socket that records every event it receives, so a test can assert on what did (and did not) arrive.
export interface RecordingSocket extends Socket {
  received: Array<{ event: string; payload: unknown }>;
  eventsOf: <T = unknown>(event: string) => T[];
}

export async function connectSocket(url: string, options: { token?: string; cookie?: string }): Promise<RecordingSocket> {
  const socket = connect(url, {
    transports: ["websocket"],
    auth: options.token ? { token: options.token } : undefined,
    extraHeaders: options.cookie ? { cookie: options.cookie } : undefined,
    forceNew: true,
  }) as RecordingSocket;
  socket.received = [];
  socket.eventsOf = <T = unknown>(event: string) => socket.received.filter((entry) => entry.event === event).map((entry) => entry.payload as T);
  socket.onAny((event, payload) => socket.received.push({ event, payload }));

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

// Acks are loosely shaped JSON; each test asserts the fields it cares about.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const emitAck = <T = any>(socket: Socket, event: string, payload: unknown): Promise<T> =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

export const waitFor = async (condition: () => boolean, timeoutMs = 5000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};
