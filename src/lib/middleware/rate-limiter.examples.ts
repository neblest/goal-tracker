/**
 * Rate Limiter - Usage Examples and Manual Tests
 *
 * This file demonstrates how to use the rate limiter and can be used
 * for manual testing during development.
 *
 * To run these examples:
 * 1. Uncomment the code at the bottom
 * 2. Run: npx tsx src/lib/middleware/rate-limiter.examples.ts
 */

import {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits,
  RateLimitPresets,
} from "./rate-limiter";

/**
 * Example 1: Basic rate limiting
 */
function example1_BasicUsage() {
  console.log("\n=== Example 1: Basic Rate Limiting ===");

  const userId = "user-123";
  const config = {
    maxRequests: 3,
    windowMs: 5000, // 5 seconds
  };

  console.log("Attempting 5 requests with limit of 3 per 5 seconds...\n");

  for (let i = 1; i <= 5; i++) {
    const result = checkRateLimit(userId, config);
    console.log(`Request ${i}:`);
    console.log(`  - Allowed: ${result.allowed}`);
    console.log(`  - Remaining: ${result.remaining}`);
    if (!result.allowed) {
      console.log(`  - Retry After: ${result.retryAfter} seconds`);
    }
    console.log();
  }

  clearAllRateLimits();
}

/**
 * Example 2: Using presets for AI generation
 */
function example2_AIGenerationPreset() {
  console.log("\n=== Example 2: AI Generation Preset (10 req/min) ===");

  const userId = "user-456";

  console.log("Making 12 requests with AI_GENERATION preset...\n");

  for (let i = 1; i <= 12; i++) {
    const result = checkRateLimit(userId, RateLimitPresets.AI_GENERATION);
    console.log(`Request ${i}:`);
    console.log(`  - Allowed: ${result.allowed}`);
    console.log(`  - Remaining: ${result.remaining}`);

    if (!result.allowed) {
      console.log(`  - Rate limited! Retry after: ${result.retryAfter} seconds`);
      break;
    }
  }

  clearAllRateLimits();
}

/**
 * Example 3: Checking status without consuming a request
 */
function example3_StatusCheck() {
  console.log("\n=== Example 3: Status Check (Read-only) ===");

  const userId = "user-789";
  const config = RateLimitPresets.STRICT; // 5 req/min

  // Make 3 requests
  for (let i = 1; i <= 3; i++) {
    checkRateLimit(userId, config);
  }

  // Check status without consuming
  const status = getRateLimitStatus(userId, config);
  console.log("Current status (without consuming):");
  console.log(`  - Requests in window: ${status.requestsInWindow}`);
  console.log(`  - Remaining: ${status.remaining}`);
  console.log(`  - Reset at: ${status.resetAt.toLocaleTimeString()}`);

  clearAllRateLimits();
}

/**
 * Example 4: Multiple users with different limits
 */
function example4_MultipleUsers() {
  console.log("\n=== Example 4: Multiple Users ===");

  const user1 = "user-alice";
  const user2 = "user-bob";

  // User 1 makes 2 requests
  console.log("User Alice makes 2 requests:");
  for (let i = 1; i <= 2; i++) {
    const result = checkRateLimit(user1, RateLimitPresets.STRICT);
    console.log(`  Request ${i} - Allowed: ${result.allowed}, Remaining: ${result.remaining}`);
  }

  // User 2 makes 3 requests
  console.log("\nUser Bob makes 3 requests:");
  for (let i = 1; i <= 3; i++) {
    const result = checkRateLimit(user2, RateLimitPresets.STRICT);
    console.log(`  Request ${i} - Allowed: ${result.allowed}, Remaining: ${result.remaining}`);
  }

  // Both users' limits are independent
  console.log("\nUser Alice makes 1 more request:");
  const aliceResult = checkRateLimit(user1, RateLimitPresets.STRICT);
  console.log(`  Allowed: ${aliceResult.allowed}, Remaining: ${aliceResult.remaining}`);

  clearAllRateLimits();
}

/**
 * Example 5: Reset rate limit for a user (admin operation)
 */
function example5_ResetLimit() {
  console.log("\n=== Example 5: Reset Rate Limit ===");

  const userId = "user-charlie";
  const config = RateLimitPresets.STRICT;

  // Make 5 requests (hit the limit)
  console.log("Making 5 requests...");
  for (let i = 1; i <= 5; i++) {
    checkRateLimit(userId, config);
  }

  // Try one more (should be rate limited)
  let result = checkRateLimit(userId, config);
  console.log(`Request 6 - Allowed: ${result.allowed} (Expected: false)`);

  // Reset the limit
  console.log("\nResetting rate limit for user...");
  resetRateLimit(userId, config.identifier);

  // Try again (should work now)
  result = checkRateLimit(userId, config);
  console.log(`Request 7 (after reset) - Allowed: ${result.allowed} (Expected: true)`);

  clearAllRateLimits();
}

/**
 * Example 6: Sliding window behavior
 */
async function example6_SlidingWindow() {
  console.log("\n=== Example 6: Sliding Window Behavior ===");

  const userId = "user-david";
  const config = {
    maxRequests: 3,
    windowMs: 2000, // 2 seconds
  };

  console.log("Making 3 requests (hitting the limit)...");
  for (let i = 1; i <= 3; i++) {
    checkRateLimit(userId, config);
  }

  // Should be rate limited
  let result = checkRateLimit(userId, config);
  console.log(`Request 4 (immediate) - Allowed: ${result.allowed} (Expected: false)`);

  // Wait 2.5 seconds
  console.log("\nWaiting 2.5 seconds for window to slide...");
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Should work again
  result = checkRateLimit(userId, config);
  console.log(`Request 5 (after 2.5s) - Allowed: ${result.allowed} (Expected: true)`);

  clearAllRateLimits();
}

/**
 * Example 7: Different identifiers for same user
 */
function example7_DifferentIdentifiers() {
  console.log("\n=== Example 7: Different Identifiers ===");

  const userId = "user-eve";

  // Use different rate limits for different endpoints
  console.log("AI Generation endpoint - 10 requests:");
  for (let i = 1; i <= 10; i++) {
    const result = checkRateLimit(userId, RateLimitPresets.AI_GENERATION);
    if (!result.allowed) {
      console.log(`  Request ${i} - Rate limited!`);
      break;
    }
  }

  // Standard endpoint still has full quota
  console.log("\nStandard endpoint - still has full quota:");
  const standardResult = checkRateLimit(userId, RateLimitPresets.STANDARD);
  console.log(`  Request 1 - Allowed: ${standardResult.allowed}, Remaining: ${standardResult.remaining}`);

  clearAllRateLimits();
}

/**
 * Run all examples
 *
 * Uncomment the code below to run the examples:
 */
/*
(async () => {
  example1_BasicUsage();
  example2_AIGenerationPreset();
  example3_StatusCheck();
  example4_MultipleUsers();
  example5_ResetLimit();
  await example6_SlidingWindow();
  example7_DifferentIdentifiers();

  console.log("\n=== All examples completed ===\n");
})();
*/

/**
 * Example usage in an API endpoint:
 *
 * ```typescript
 * import { checkRateLimit, RateLimitPresets } from '../lib/middleware/rate-limiter';
 *
 * export async function POST(context: APIContext) {
 *   // Get user ID from auth
 *   const userId = context.locals.userId;
 *
 *   // Check rate limit
 *   const rateLimit = checkRateLimit(userId, RateLimitPresets.AI_GENERATION);
 *
 *   if (!rateLimit.allowed) {
 *     return new Response(
 *       JSON.stringify({
 *         error: {
 *           code: 'rate_limited',
 *           message: `Too many requests. Retry after ${rateLimit.retryAfter} seconds.`
 *         }
 *       }),
 *       {
 *         status: 429,
 *         headers: {
 *           'Retry-After': String(rateLimit.retryAfter),
 *           'X-RateLimit-Limit': String(RateLimitPresets.AI_GENERATION.maxRequests),
 *           'X-RateLimit-Remaining': String(rateLimit.remaining),
 *           'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
 *         }
 *       }
 *     );
 *   }
 *
 *   // Process the request...
 *   return new Response(JSON.stringify({ success: true }), {
 *     headers: {
 *       'X-RateLimit-Remaining': String(rateLimit.remaining),
 *     }
 *   });
 * }
 * ```
 */
