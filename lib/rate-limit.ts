/**
 * Simple in-memory rate limiter for API routes.
 * Tracks last call time per user per endpoint to prevent abuse.
 */

const cooldowns = new Map<string, number>()

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of cooldowns) {
    if (now - timestamp > 600_000) cooldowns.delete(key)
  }
}, 600_000)

/**
 * Check if a request should be rate-limited.
 * @param userId - The user making the request
 * @param endpoint - The endpoint identifier (e.g. 'watches-check')
 * @param cooldownMs - Minimum time between calls in milliseconds (default: 60s)
 * @returns true if the request should be allowed, false if rate-limited
 */
export function checkRateLimit(userId: string, endpoint: string, cooldownMs: number = 60_000): boolean {
  const key = `${userId}:${endpoint}`
  const lastCall = cooldowns.get(key)
  const now = Date.now()

  if (lastCall && now - lastCall < cooldownMs) {
    return false // Rate limited
  }

  cooldowns.set(key, now)
  return true // Allowed
}
