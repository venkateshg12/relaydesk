import { redisConnection as redis } from "../jobs/redis/connection.js";

/*
  Presence lives in Redis only (the queue instance, which never evicts) and never touches assignment.

  presence:ws:<workspaceId>            hash   memberId → "online" | "away" (the member's chosen status)
  presence:sockets:<ws>:<memberId>     set    the member's socket ids
  presence:heartbeat:<socketId>        string expires 60 s after the socket's last ping

  A member counts only while one of their sockets has a live heartbeat. A clean disconnect removes the
  socket at once; a server that crashes never sends one, so dead sockets are pruned whenever presence
  is read — a member shows offline within a minute either way.
 */
const HEARTBEAT_TTL_SECONDS = 60;
const VIEWERS_TTL_SECONDS = 60 * 60;

const statusKey = (workspaceId: string) => `presence:ws:${workspaceId}`;
const socketsKey = (workspaceId: string, memberId: string) => `presence:sockets:${workspaceId}:${memberId}`;
const heartbeatKey = (socketId: string) => `presence:heartbeat:${socketId}`;
// memberId → number of open tabs, and memberId → name, for the same conversation.
const viewersKey = (conversationId: string) => `presence:viewers:${conversationId}`;
const viewerNamesKey = (conversationId: string) => `presence:viewer-names:${conversationId}`;

export type MemberStatus = "online" | "away";

// Drops sockets whose heartbeat expired; returns the members that still have a live socket.
const liveMembers = async (workspaceId: string): Promise<Record<string, MemberStatus>> => {
    const statuses = (await redis.hgetall(statusKey(workspaceId))) as Record<string, MemberStatus>;
    const live: Record<string, MemberStatus> = {};

    for (const [memberId, status] of Object.entries(statuses)) {
        const sockets = await redis.smembers(socketsKey(workspaceId, memberId));
        const alive = sockets.length ? await redis.mget(sockets.map(heartbeatKey)) : [];
        const dead = sockets.filter((_, i) => alive[i] === null);

        if (dead.length) await redis.srem(socketsKey(workspaceId, memberId), ...dead);
        if (dead.length === sockets.length) {
            await redis.hdel(statusKey(workspaceId), memberId);
        } else {
            live[memberId] = status;
        }
    }
    return live;
};

// The widget's "is anyone here?": at least one member online (away doesn't count).
const isOnline = (members: Record<string, MemberStatus>) => Object.values(members).includes("online");

export const presence = {
    async addSocket(workspaceId: string, memberId: string, socketId: string) {
        await redis
            .multi()
            .sadd(socketsKey(workspaceId, memberId), socketId)
            .set(heartbeatKey(socketId), "1", "EX", HEARTBEAT_TTL_SECONDS)
            // A second tab keeps the status the member already chose.
            .hsetnx(statusKey(workspaceId), memberId, "online")
            .exec();
        const members = await liveMembers(workspaceId);
        return { status: members[memberId] ?? "online", workspaceOnline: isOnline(members) };
    },

    async refreshHeartbeat(socketId: string) {
        await redis.set(heartbeatKey(socketId), "1", "EX", HEARTBEAT_TTL_SECONDS);
    },

    // Returns whether that was the member's last socket.
    async removeSocket(workspaceId: string, memberId: string, socketId: string) {
        const results = await redis
            .multi()
            .del(heartbeatKey(socketId))
            .srem(socketsKey(workspaceId, memberId), socketId)
            .scard(socketsKey(workspaceId, memberId))
            .exec();
        const remaining = Number(results?.[2]?.[1] ?? 0);
        if (remaining === 0) await redis.hdel(statusKey(workspaceId), memberId);

        const members = await liveMembers(workspaceId);
        return { isMemberOffline: remaining === 0, workspaceOnline: isOnline(members) };
    },

    async setMemberStatus(workspaceId: string, memberId: string, status: MemberStatus) {
        await redis.hset(statusKey(workspaceId), memberId, status);
        return { workspaceOnline: isOnline(await liveMembers(workspaceId)) };
    },

    async snapshot(workspaceId: string) {
        const members = await liveMembers(workspaceId);
        return { members, workspaceOnline: isOnline(members) };
    },

    async isWorkspaceOnline(workspaceId: string) {
        return isOnline(await liveMembers(workspaceId));
    },

    viewers: (conversationId: string) => listViewers(conversationId),

    // Viewers count tabs per member, so two tabs of one agent collapse into one viewer.
    async addViewer(conversationId: string, memberId: string, name: string) {
        await redis
            .multi()
            .hincrby(viewersKey(conversationId), memberId, 1)
            .hset(viewerNamesKey(conversationId), memberId, name)
            .expire(viewersKey(conversationId), VIEWERS_TTL_SECONDS)
            .expire(viewerNamesKey(conversationId), VIEWERS_TTL_SECONDS)
            .exec();
        return listViewers(conversationId);
    },

    async removeViewer(conversationId: string, memberId: string) {
        const count = await redis.hincrby(viewersKey(conversationId), memberId, -1);
        if (count <= 0) await redis.multi().hdel(viewersKey(conversationId), memberId).hdel(viewerNamesKey(conversationId), memberId).exec();
        return listViewers(conversationId);
    },
};

const listViewers = async (conversationId: string) => {
    const names = await redis.hgetall(viewerNamesKey(conversationId));
    return Object.entries(names).map(([memberId, name]) => ({ memberId, name }));
};
