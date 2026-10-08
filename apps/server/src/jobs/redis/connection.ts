import Redis from "ioredis";
import { getRedisConfig } from "../../config/redis.js";

export const redisConnection = new Redis(getRedisConfig());

redisConnection.on("connect", () => {
    console.log("[BullMQ] Connected to Redis successfully");
});

redisConnection.on("error", (err) => {
    console.error("[BullMQ] Redis connection error:", err.message);
});
