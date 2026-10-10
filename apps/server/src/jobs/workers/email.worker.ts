import { Job, Worker } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../../constants/queue.js";
import { processSendInvitation, processSendOfflineReply, processSendVerification } from "../processors/email.processor.js";
import type { SendInvitationPayload, SendOfflineReplyPayload, SendVerificationPayload } from "../interfaces/jobPayload.js";
import { redisConnection } from "../redis/connection.js";

export const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job) => {
        switch (job.name) {
            case JOB_NAMES.EMAIL.SEND_INVITATION:
                return await processSendInvitation(job as Job<SendInvitationPayload>);
            case JOB_NAMES.EMAIL.SEND_VERIFICATION:
                return await processSendVerification(job as Job<SendVerificationPayload>);
            case JOB_NAMES.EMAIL.SEND_OFFLINE_REPLY:
                return await processSendOfflineReply(job as Job<SendOfflineReplyPayload>);
            default:
                throw new Error(`Unknown job name: ${job.name}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 5,
        lockDuration: 30000,
        limiter: {
            max: 2,         // Gmail's per-user limit is about 2 sends per second (100 of 250 quota units each)
            duration: 1000,
        }
    }
);

emailWorker.on("completed", (job) => {
    console.log(`[Worker:Email] Job ${job.id} (${job.name}) completed successfully.`);
});

emailWorker.on("failed", (job, err) => {
    console.error(`[Worker:Email] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

emailWorker.on("stalled", (jobId) => {
    console.warn(`[Worker:Email Alert] Job ${jobId} stalled! Check CPU load.`);
});

emailWorker.on("error", (err) => {
    console.error(`[Worker:Email Error] ${err.message}`);
});
