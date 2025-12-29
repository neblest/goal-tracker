/**
 * Rate Limiter for API endpoints
 *
 * Implements a sliding window rate limiter to prevent abuse and control costs
 * for expensive operations like AI summary generation.
 *
 * Current implementation uses in-memory storage (Map) which is suitable for:
 * - MVP / single-server deployments
 * - Development and testing
 *
 * For production with multiple servers, consider:
 * - Redis-based rate limiter (shared state across servers)
 * - Upstash Rate Limit (serverless-friendly)
 * - Cloudflare Rate Limiting
 */

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional custom identifier for different rate limit policies */
  identifier?: string;
}

/**
 * Storage for request timestamps per user
 * Key: userId (or custom identifier)
 * Value: array of timestamps (milliseconds since epoch)
 */
const requestTimestamps = new Map<string, number[]>();

/**
 * Cleanup interval (run every 5 minutes to remove old data)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Starts the cleanup interval to periodically remove old timestamps
 * This prevents memory leaks in long-running processes
 */
function startCleanupInterval(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Remove timestamps older than 1 hour
    for (const [key, timestamps] of requestTimestamps.entries()) {
      const filtered = timestamps.filter((ts) => now - ts < maxAge);
      if (filtered.length === 0) {
        requestTimestamps.delete(key);
      } else {
        requestTimestamps.set(key, filtered);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

// Start cleanup interval on module load
if (typeof global !== "undefined") {
  startCleanupInterval();
}

/**
 * Checks if a request should be rate limited
 *
 * Uses sliding window algorithm:
 * 1. Get all timestamps for the user within the current window
 * 2. If count >= maxRequests, reject (rate limited)
 * 3. Otherwise, add current timestamp and allow request
 *
 * @param userId - User identifier (typically user ID from auth)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and metadata
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
} {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = config.identifier ? `${userId}:${config.identifier}` : userId;

  // Get existing timestamps for this user
  const timestamps = requestTimestamps.get(key) || [];

  // Filter to only include timestamps within the current window
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  // Check if limit exceeded
  if (recentTimestamps.length >= config.maxRequests) {
    // Find the oldest timestamp in the window
    const oldestTimestamp = Math.min(...recentTimestamps);
    const resetAt = new Date(oldestTimestamp + config.windowMs);
    const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000); // seconds

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  // Allow request and record timestamp
  recentTimestamps.push(now);
  requestTimestamps.set(key, recentTimestamps);

  const remaining = config.maxRequests - recentTimestamps.length;
  const resetAt = new Date(now + config.windowMs);

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

/**
 * Resets rate limit for a specific user (useful for testing or admin operations)
 *
 * @param userId - User identifier
 * @param identifier - Optional identifier for specific rate limit policy
 */
export function resetRateLimit(userId: string, identifier?: string): void {
  const key = identifier ? `${userId}:${identifier}` : userId;
  requestTimestamps.delete(key);
}

/**
 * Clears all rate limit data (useful for testing)
 */
export function clearAllRateLimits(): void {
  requestTimestamps.clear();
}

/**
 * Gets current rate limit status without incrementing the counter
 *
 * @param userId - User identifier
 * @param config - Rate limit configuration
 * @returns Current status without consuming a request
 */
export function getRateLimitStatus(
  userId: string,
  config: RateLimitConfig
): {
  requestsInWindow: number;
  remaining: number;
  resetAt: Date;
} {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = config.identifier ? `${userId}:${config.identifier}` : userId;

  const timestamps = requestTimestamps.get(key) || [];
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  return {
    requestsInWindow: recentTimestamps.length,
    remaining: Math.max(0, config.maxRequests - recentTimestamps.length),
    resetAt: new Date(now + config.windowMs),
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /** For AI generation endpoints: 10 requests per minute */
  AI_GENERATION: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    identifier: "ai-generation",
  } as RateLimitConfig,

  /** Strict limit: 5 requests per minute */
  STRICT: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    identifier: "strict",
  } as RateLimitConfig,

  /** Standard API limit: 100 requests per minute */
  STANDARD: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    identifier: "standard",
  } as RateLimitConfig,
};
