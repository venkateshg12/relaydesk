import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@repo/types";

export type WidgetSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnectionState = "connected" | "reconnecting";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// The visitor identifies itself with its token at the handshake; the server joins it to its rooms.
export const openSocket = (token: string): WidgetSocket =>
  io(SOCKET_URL, {
    auth: { token },
    // WebSocket only: with the Redis adapter that needs no sticky sessions on the host.
    transports: ["websocket"],
    reconnectionDelayMax: 3000,
  });
