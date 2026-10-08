import { RedisOptions } from "ioredis";
import {
    CACHE_REDIS_HOST,
    CACHE_REDIS_PASSWORD,
    CACHE_REDIS_PORT,
    CACHE_REDIS_USERNAME,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    REDIS_USERNAME
} from "../constants/env.js";

export const getRedisConfig = (): RedisOptions => ({
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    username: REDIS_USERNAME || undefined,
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

export const getRateLimiterRedisConfig = (): RedisOptions => ({
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    username: REDIS_USERNAME || undefined,
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1, // Fail fast so circuit breaker trips to memory store
    connectTimeout: 2000, // max time to wait for a Redis connection
    commandTimeout: 1000, // max time to wait for a Redis command response (1 second)
    enableReadyCheck: false
});

/*
  The cache sits on the request path of every cached read, and a miss only costs a database query, so it
  gives up much sooner than the rate limiter: 200ms per command, and no offline queue — while
  disconnected, commands fail at once instead of piling up until Redis returns.
 */
export const getCacheRedisConfig = (): RedisOptions => ({
    host: CACHE_REDIS_HOST,
    port: Number(CACHE_REDIS_PORT),
    username: CACHE_REDIS_USERNAME || undefined,
    password: CACHE_REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 300,
    enableOfflineQueue: false,
    enableReadyCheck: false
});
