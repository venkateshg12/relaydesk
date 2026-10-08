import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { getRedisConfig } from "../config/redis.js";
import { orm } from "../config/db.js";
import { CORS_ORIGIN, WEB_ORIGIN, WIDGET_ORIGIN } from "../constants/env.js";
import { authSocketMiddleware } from "./auth.js";
import { emitPresence, getIo, setIo } from "./emit.js";
import { convRoom, memberRoom, visitorRoom, wsRoom, wsVisitorsRoom } from "./rooms.js";
import { presence } from "./presence.js";
import { handleSendMessage } from "./handlers/message.handler.js";
import { handleTyping } from "./handlers/typing.handler.js";
import { handleMessageSeen } from "./handlers/seen.handler.js";
import { handleSync } from "./handlers/sync.handler.js";
import { handlePresenceSet } from "./handlers/presence.handler.js";
import { handleConversationJoin, handleConversationLeave, leaveConversation } from "./handlers/conversation.handler.js";
import { DEMO_ROOM, startStatsBroadcast } from "../services/stats.service.js";
import { WORKSPACE_DELETED_CHANNEL } from "./control.js";
import type { AppServer, AppSocket } from "../types/socket.d.js";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let controlClient: Redis | null = null;
let stopStatsBroadcast: (() => void) | null = null;

// Rooms and presence for one agent connection. Handlers are attached before this runs, so an event
// that arrives right after the handshake is never dropped.
const connectAgent = async (socket: AppSocket) => {
    if (socket.data.kind !== "agent") return;
    const { workspaceId, memberId } = socket.data;

    void socket.join([wsRoom(workspaceId), memberRoom(memberId)]);

    const { status, workspaceOnline } = await presence.addSocket(workspaceId, memberId, socket.id);
    emitPresence(workspaceId, { memberId, status, workspaceOnline });
    socket.emit("presence:snapshot", await presence.snapshot(workspaceId));
};

const connectVisitor = async (socket: AppSocket) => {
    if (socket.data.kind !== "visitor") return;
    const { workspaceId, visitorId } = socket.data;

    void socket.join([visitorRoom(visitorId), wsVisitorsRoom(workspaceId)]);

    // Every tab of a visitor sits in their one conversation's room (once it exists).
    const conversation = await orm.Conversation.where({ workspaceId, visitorId }).select("id").first();
    if (conversation) void socket.join(convRoom(conversation.id));

    const workspaceOnline = await presence.isWorkspaceOnline(workspaceId);
    socket.emit("presence:update", {
        memberId: "workspace",
        status: workspaceOnline ? "online" : "offline",
        workspaceOnline
    });
};

const disconnectAgent = async (socket: AppSocket) => {
    if (socket.data.kind !== "agent") return;
    const { workspaceId, memberId } = socket.data;

    // A dropped tab stops being a viewer of whatever it had open.
    await Promise.all([...socket.data.viewing].map((conversationId) => leaveConversation(socket, conversationId)));

    const { isMemberOffline, workspaceOnline } = await presence.removeSocket(workspaceId, memberId, socket.id);
    if (isMemberOffline) emitPresence(workspaceId, { memberId, status: "offline", workspaceOnline });
};

export function initSocketServer(httpServer: HttpServer): AppServer {
    const allowedOrigins = Array.from(
        new Set([...CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean), WEB_ORIGIN, WIDGET_ORIGIN].filter(Boolean))
    );

    const io: AppServer = new Server(httpServer, {
        cors: { origin: allowedOrigins, credentials: true },
        transports: ["websocket"], // no polling fallback: nothing needs sticky sessions
        pingInterval: 25000,
        pingTimeout: 20000
    });
    setIo(io);

    // The Redis adapter makes rooms and emits work across API instances.
    pubClient = new Redis(getRedisConfig());
    subClient = pubClient.duplicate();
    pubClient.on("error", (err) => console.error("[Socket.IO Redis Pub] error:", err.message));
    subClient.on("error", (err) => console.error("[Socket.IO Redis Sub] error:", err.message));
    io.adapter(createAdapter(pubClient, subClient));

    // A deleted workspace (an expired demo) is announced on a Redis channel by whichever process deleted it —
    // the worker has no sockets — and every API instance drops that workspace's connections, so a stale tab
    // reconnects (and is refused) instead of sitting on a workspace that no longer exists.
    controlClient = pubClient.duplicate();
    void controlClient.subscribe(WORKSPACE_DELETED_CHANNEL);
    controlClient.on("message", (_channel, workspaceId) => {
        io.in([wsRoom(workspaceId), wsVisitorsRoom(workspaceId)]).disconnectSockets(true);
    });
    controlClient.on("error", (err) => console.error("[Socket.IO Redis Control] error:", err.message));

    stopStatsBroadcast = startStatsBroadcast();

    io.use(authSocketMiddleware);

    io.on("connection", (socket) => {
        socket.on("message:send", (data, ack) => void handleSendMessage(socket, data, ack));
        socket.on("typing", (data) => handleTyping(socket, data));
        socket.on("message:seen", (data) => void handleMessageSeen(socket, data));
        socket.on("sync", (data, ack) => void handleSync(socket, data, ack));
        socket.on("presence:set", (data) => void handlePresenceSet(socket, data));
        socket.on("conversation:join", (data, ack) => void handleConversationJoin(socket, data, ack));
        socket.on("conversation:leave", (data) => void handleConversationLeave(socket, data));

        // Every answered ping (Socket.IO sends one every 25 s) renews the presence heartbeat, so a
        // connection that silently dies stops counting as online within a minute.
        socket.conn.on("heartbeat", () => void presence.refreshHeartbeat(socket.id));

        // The homepage's live numbers go to demo workspaces only.
        if (socket.data.isDemo) void socket.join(DEMO_ROOM);

        socket.on("disconnect", () => {
            void disconnectAgent(socket).catch((error) => console.error("[Socket] disconnect cleanup failed:", error));
        });

        void (socket.data.kind === "agent" ? connectAgent(socket) : connectVisitor(socket)).catch((error) =>
            console.error("[Socket] connect setup failed:", error)
        );
    });

    return io;
}

export { getIo };

export async function closeSocketServer(): Promise<void> {
    const io = getIo();
    if (io) {
        await new Promise<void>((resolve) => void io.close(() => resolve()));
        setIo(null);
    }
    stopStatsBroadcast?.();
    await controlClient?.quit().catch(() => {});
    await pubClient?.quit().catch(() => {});
    await subClient?.quit().catch(() => {});
    pubClient = subClient = controlClient = null;
}
