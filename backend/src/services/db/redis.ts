import Redis from "ioredis";
import { systemLogger } from "@/utils/system/system-logger";
import { REDIS_URL } from "@/utils/config/envUtil";

const REDIS_RETRY_BASE_DELAY = 50;
const REDIS_RETRY_MAX_DELAY = 2000;

let redis: Redis | null = null;

/**
 * Get or create Redis connection instance
 */
function getRedisConnection(): Redis {
  if (!redis) {
    redis = createRedisConnection();
  }

  return redis;
}

/**
 * Create new Redis connection with configuration
 */
function createRedisConnection(): Redis {
  if (!REDIS_URL) {
    throw new Error("Environment variable REDIS_URL is required but not set");
  }

  const connection = new Redis(`${REDIS_URL}?family=0`, {
    retryStrategy: (times: number) => {
      return Math.min(times * REDIS_RETRY_BASE_DELAY, REDIS_RETRY_MAX_DELAY);
    },
  });

  setupRedisEventHandlers(connection);

  return connection;
}

/**
 * Setup Redis connection event handlers
 */
function setupRedisEventHandlers(connection: Redis): void {
  connection.on("error", (err) => {
    systemLogger.redis("error", "Redis Client Error", "connection-error", err);
  });

  connection.on("connect", () => {
    systemLogger.redis("info", "Connected to Redis", "connection-established");
  });

  connection.on("reconnecting", () => {
    systemLogger.redis("warn", "Redis reconnecting", "reconnecting");
  });

  connection.on("close", () => {
    systemLogger.redis("warn", "Redis connection closed", "connection-closed");
  });
}

export default getRedisConnection;
