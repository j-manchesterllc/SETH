export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey, hashApiKey, extractPrefix } from '@/lib/wearable-auth'

/**
 * API key management for wearable/companion device authentication.
 *
 * GET  — Returns whether an API key exists + masked prefix preview
 * POST — Generates a new key, stores SHA-256 hash + prefix (never plaintext)
 * DELETE — Revokes all key material
 */

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiKeyPrefix: true, apiKeyHash: true, apiKey: true },
  })

  // Hashed key exists
  if (user?.apiKeyPrefix && user?.apiKeyHash) {
    return new Response(
      JSON.stringify({
        hasKey: true,
        keyPreview: `${user.apiKeyPrefix}…****`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Legacy plaintext key exists
  if (user?.apiKey) {
    return new Response(
      JSON.stringify({
        hasKey: true,
        keyPreview: `${user.apiKey.slice(0, 9)}…${user.apiKey.slice(-4)}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ hasKey: false, keyPreview: null }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const rawKey = generateApiKey()
  const keyHash = hashApiKey(rawKey)
  const prefix = extractPrefix(rawKey)

  await prisma.user.update({
    where: { id: userId },
    data: {
      apiKeyHash: keyHash,
      apiKeyPrefix: prefix,
      apiKey: null, // clear any legacy plaintext key
    },
  })

  // Return the full key once — it will never be retrievable again
  return new Response(
    JSON.stringify({
      apiKey: rawKey,
      warning: 'Store this key securely. It will not be shown again in full.',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      apiKey: null,
      apiKeyHash: null,
      apiKeyPrefix: null,
    },
  })

  return new Response(
    JSON.stringify({ revoked: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
