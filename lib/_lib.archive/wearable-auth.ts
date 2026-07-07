/**
 * SETH Wearable Authentication Layer
 *
 * Provides API-key-based authentication for headless devices
 * (smart glasses, companion runtimes, ambient interfaces)
 * that operate outside browser session context.
 *
 * Authentication resolves through two paths:
 *   1. Session-based (browser, PWA) — standard NextAuth
 *   2. API-key-based (wearable, companion) — x-api-key header
 *
 * Both paths resolve to the same userId, ensuring unified
 * identity across all interaction surfaces.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export interface AuthResult {
  userId: string
  source: 'session' | 'api-key'
}

/** SHA-256 hash a raw API key */
export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/** Extract the prefix portion (seth_ + first 8 hex chars) from a raw key */
export function extractPrefix(raw: string): string {
  return raw.slice(0, 13) // "seth_" (5) + 8 hex chars
}

/**
 * Resolves authentication from either session or API key.
 * Wearable devices authenticate via `x-api-key` header.
 * Browser/PWA clients authenticate via NextAuth session.
 *
 * API-key path uses prefix-based lookup + constant-time hash comparison
 * to avoid exposing timing information.
 */
export async function resolveAuth(request: Request): Promise<AuthResult | null> {
  // Path 1: API key (wearable/companion)
  const rawKey = request.headers.get('x-api-key')
  if (rawKey) {
    try {
      const prefix = extractPrefix(rawKey)
      const incomingHash = hashApiKey(rawKey)

      // Try hashed lookup first (new keys)
      const hashedUser = await prisma.user.findUnique({
        where: { apiKeyPrefix: prefix },
        select: { id: true, apiKeyHash: true },
      })
      if (hashedUser?.apiKeyHash) {
        // Constant-time comparison
        const storedBuf = Buffer.from(hashedUser.apiKeyHash, 'hex')
        const incomingBuf = Buffer.from(incomingHash, 'hex')
        if (storedBuf.length === incomingBuf.length && crypto.timingSafeEqual(storedBuf, incomingBuf)) {
          return { userId: hashedUser.id, source: 'api-key' }
        }
        return null
      }

      // Fallback: legacy plaintext lookup (pre-migration keys)
      const legacyUser = await prisma.user.findUnique({
        where: { apiKey: rawKey },
        select: { id: true },
      })
      if (legacyUser) {
        // Auto-migrate: store hash + prefix, clear plaintext
        await prisma.user.update({
          where: { id: legacyUser.id },
          data: {
            apiKeyHash: incomingHash,
            apiKeyPrefix: prefix,
            apiKey: null,
          },
        }).catch(e => console.error('[WearableAuth] Auto-migration failed:', e))
        return { userId: legacyUser.id, source: 'api-key' }
      }
    } catch (e) {
      console.error('[WearableAuth] API key lookup failed:', e)
    }
    return null
  }

  // Path 2: Session (browser/PWA)
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (userId) {
    return { userId, source: 'session' }
  }

  return null
}

/**
 * Generates a cryptographically secure API key for wearable access.
 * Format: seth_<48 hex chars> (24 random bytes)
 */
export function generateApiKey(): string {
  return `seth_${crypto.randomBytes(24).toString('hex')}`
}
