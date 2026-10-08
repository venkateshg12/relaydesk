import { JOB_NAMES } from "../../constants/queue.js";
import type { SendInvitationPayload, SendOfflineReplyPayload } from "../interfaces/jobPayload.js";
import { emailQueue } from "../queues/email.queue.js";
import { redisConnection } from "../redis/connection.js";

// Replies written within a minute of each other go out as one email, and a conversation is emailed at
// most once every ten minutes.
const OFFLINE_REPLY_BATCH_MS = 60 * 1000;
export const OFFLINE_REPLY_WINDOW_MS = 10 * 60 * 1000;
export const offlineReplySentKey = (conversationId: string) => `offline-reply:sent:${conversationId}`;

export class EmailProducer {
    static async addSendInvitationJob(payload: SendInvitationPayload) {
        return await emailQueue.add(JOB_NAMES.EMAIL.SEND_INVITATION, payload, {
            jobId: `invite-${payload.invitationId}`,
        });
    }

    /*
      A delayed job with one id per conversation: while it is waiting, further replies add nothing — they
      are collected from Postgres when it runs. If an email went out less than ten minutes ago, the job
      waits out the rest of that window. `removeOn…: true` frees the id for the next batch.
     */
    static async scheduleOfflineReplyJob(payload: SendOfflineReplyPayload) {
        const remainingWindowMs = await redisConnection.pttl(offlineReplySentKey(payload.conversationId));
        return await emailQueue.add(JOB_NAMES.EMAIL.SEND_OFFLINE_REPLY, payload, {
            jobId: `offline-reply-${payload.conversationId}`,
            delay: Math.max(OFFLINE_REPLY_BATCH_MS, remainingWindowMs),
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
}
