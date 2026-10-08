import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../../constants/queue.js";
import { redisConnection } from "../redis/connection.js";

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
});
