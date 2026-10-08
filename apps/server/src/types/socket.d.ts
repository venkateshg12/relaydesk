import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@repo/types";

// `socket.data`, set once by the handshake. `name` is resolved there so typing events never query.
export interface AgentSocketData {
    kind: "agent";
    memberId: string;
    workspaceId: string;
    role: "admin" | "agent";
    sessionId: string;
    isDemo: boolean;
    name: string;
    // Conversations this socket is viewing, so a dropped connection can leave them.
    viewing: Set<string>;
}

export interface VisitorSocketData {
    kind: "visitor";
    visitorId: string;
    workspaceId: string;
    isDemo: boolean;
    name: string;
}

export type AppSocketData = AgentSocketData | VisitorSocketData;

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, AppSocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, AppSocketData>;
