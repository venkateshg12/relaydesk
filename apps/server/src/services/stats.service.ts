import { redisConnection as redis } from "../jobs/redis/connection.js";
import { getIo } from "../realtime/emit.js";

/*
  The homepage's two live numbers, both real:
  - messages delivered: one Redis counter, `INCR`ed after each message commits (`sendMessageService`);
  - people online: the sockets in the demo room, counted across every API instance by the Redis adapter.
    Nothing is stored per socket, so a crashed server can't leave phantom people behind.
  Only demo workspaces' sockets join `DEMO_ROOM` (see realtime/socket.ts), so this counts people on the demo.
 */
export const DEMO_ROOM = "demo:public";
const MESSAGES_KEY = "relaydesk:stats:messages-delivered";

export interface LiveStats {
    messagesDelivered: number;
    onlineNow: number;
}

export const incrementDeliveredMessagesCount = async () => {
    try {
        await redis.incr(MESSAGES_KEY);
    } catch {
        // A counter on a homepage must never fail a message.
    }
};

export const getLiveStats = async (): Promise<LiveStats> => {
    const io = getIo();
    const [delivered, online] = await Promise.all([
        redis.get(MESSAGES_KEY).catch(() => null),
        io ? io.of("/").adapter.sockets(new Set([DEMO_ROOM])).catch(() => new Set()) : new Set(),
    ]);
    return { messagesDelivered: Number(delivered ?? 0), onlineNow: online.size };
};

const BROADCAST_EVERY_MS = 5000;

// Pushes the numbers to everyone on the demo every few seconds — and only when they changed.
export const startStatsBroadcast = () => {
    let last = "";
    const timer = setInterval(() => {
        void getLiveStats().then((stats) => {
            const serialized = JSON.stringify(stats);
            if (serialized === last) return;
            last = serialized;
            getIo()?.to(DEMO_ROOM).emit("stats:update", stats);
        });
    }, BROADCAST_EVERY_MS);
    timer.unref();
    return () => clearInterval(timer);
};
