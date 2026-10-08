import { Job } from "bullmq";
import { orm } from "../../prisma/db.js";
import { redisConnection } from "../redis/connection.js";
import { WORKSPACE_DELETED_CHANNEL } from "../../realtime/control.js";
import { cache, sessionCacheKey } from "../../utils/cache/index.js";

// Repeatable: removes rows that can never be used again. Idempotent, so a retried run is harmless.
export async function processSweepExpired(job: Job) {
    const nowIso = new Date().toISOString();

    const sessions = await orm.Session.where((s) => s.expiresAt.lt(nowIso)).deleteAll();
    await cache.del(...sessions.map((s) => sessionCacheKey(s.id)));

    const invitations = await orm.Invitation
        .where((i) => i.expiresAt.lt(nowIso))
        .where((i) => i.acceptedAt.isNull())
        .deleteAll();

    job.log(`[Sweep] Deleted ${sessions.length} expired sessions and ${invitations.length} expired invitations`);
    return { deletedSessions: sessions.length, deletedInvitations: invitations.length };
}

// Repeatable: every table cascades from `workspace` and the member references are deferred to commit,
// so one delete per expired demo workspace removes all of its data (see phase 01).
export async function processDeleteDemoWorkspaces(job: Job) {
    const deleted = await orm.Workspace
        .where({ isDemo: true })
        .where((w) => w.demoExpiresAt.lt(new Date().toISOString()))
        .deleteAll();

    // Whoever still has one of them open is disconnected (see realtime/socket.ts).
    await Promise.all(deleted.map((workspace) => redisConnection.publish(WORKSPACE_DELETED_CHANNEL, workspace.id)));

    job.log(`[Maintenance] Deleted ${deleted.length} expired demo workspaces`);
    return { deletedDemoWorkspaces: deleted.length };
}
