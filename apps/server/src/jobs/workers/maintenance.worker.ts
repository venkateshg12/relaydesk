import { Job, Worker } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../../constants/queue.js";
import { processDeleteDemoWorkspaces, processSweepExpired } from "../processors/maintenance.processor.js";
import { redisConnection } from "../redis/connection.js";

export const maintenanceWorker = new Worker(
    QUEUE_NAMES.MAINTENANCE,
    async (job: Job) => {
        switch (job.name) {
            case JOB_NAMES.MAINTENANCE.SWEEP_EXPIRED:
                return await processSweepExpired(job);
            case JOB_NAMES.MAINTENANCE.DELETE_DEMO_WORKSPACES:
                return await processDeleteDemoWorkspaces(job);
            default:
                throw new Error(`Unknown maintenance job name: ${job.name}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Maintenance tasks run sequentially
        lockDuration: 60000,
    }
);

maintenanceWorker.on("completed", (job) => {
    console.log(`[Worker:Maintenance] Job ${job.id} (${job.name}) completed successfully.`);
});

maintenanceWorker.on("failed", (job, err) => {
    console.error(`[Worker:Maintenance] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

maintenanceWorker.on("error", (err) => {
    console.error(`[Worker:Maintenance Error] ${err.message}`);
});
