export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as jose from 'jose'

// Google RISC configuration endpoint
const RISC_CONFIG_URL = 'https://accounts.google.com/.well-known/risc-configuration'

// Cache JWKS for performance (refresh every hour)
let cachedJWKS: jose.JSONWebKeySet | null = null
let jwksCachedAt = 0
const JWKS_CACHE_TTL = 3600_000 // 1 hour

async function getRISCConfig(): Promise<{ issuer: string; jwks_uri: string }> {
  const res = await fetch(RISC_CONFIG_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch RISC config: ${res.status}`)
  return res.json()
}

async function getGoogleJWKS(jwksUri: string): Promise<jose.JSONWebKeySet> {
  if (cachedJWKS && Date.now() - jwksCachedAt < JWKS_CACHE_TTL) {
    return cachedJWKS
  }
  const res = await fetch(jwksUri, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`)
  cachedJWKS = await res.json()
  jwksCachedAt = Date.now()
  return cachedJWKS!
}

// RISC event type constants
const EVENT_TYPES = {
  SESSIONS_REVOKED: 'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  TOKENS_REVOKED: 'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
  TOKEN_REVOKED: 'https://schemas.openid.net/secevent/oauth/event-type/token-revoked',
  ACCOUNT_DISABLED: 'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  ACCOUNT_ENABLED: 'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
  CREDENTIAL_CHANGE_REQUIRED: 'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required',
  VERIFICATION: 'https://schemas.openid.net/secevent/risc/event-type/verification',
} as const

/**
 * Resolve Google sub to app user via Account table (providerAccountId)
 */
async function resolveUserByGoogleSub(googleSub: string) {
  const account = await prisma.account.findFirst({
    where: { provider: 'google', providerAccountId: googleSub },
    select: { userId: true },
  })
  return account?.userId ?? null
}

/**
 * Revoke all sessions for a user
 */
async function revokeUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } })
  console.log(`[RISC] Revoked all sessions for user ${userId}`)
}

/**
 * Revoke Google OAuth tokens for a user
 */
async function revokeGoogleTokens(userId: string) {
  await prisma.account.updateMany({
    where: { userId, provider: 'google' },
    data: { access_token: null, refresh_token: null, expires_at: null },
  })
  console.log(`[RISC] Revoked Google OAuth tokens for user ${userId}`)
}

/**
 * Disable Google SSO for a user (prevents future Google sign-ins)
 */
async function disableGoogleSso(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { googleSsoDisabled: true },
  })
  console.log(`[RISC] Disabled Google SSO for user ${userId}`)
}

/**
 * Re-enable Google SSO for a user
 */
async function enableGoogleSso(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { googleSsoDisabled: false },
  })
  console.log(`[RISC] Re-enabled Google SSO for user ${userId}`)
}

/**
 * Handle a validated security event
 */
async function handleSecurityEvent(eventType: string, eventData: any, googleSub: string) {
  const userId = await resolveUserByGoogleSub(googleSub)
  
  if (!userId) {
    console.log(`[RISC] No app user found for Google sub ${googleSub}, skipping event ${eventType}`)
    return { userId: null, action: 'skipped_no_user' }
  }

  switch (eventType) {
    case EVENT_TYPES.SESSIONS_REVOKED:
      // Required: End all open sessions
      await revokeUserSessions(userId)
      await revokeGoogleTokens(userId)
      return { userId, action: 'sessions_revoked' }

    case EVENT_TYPES.TOKENS_REVOKED:
      // Required: Terminate sessions and revoke stored tokens
      await revokeUserSessions(userId)
      await revokeGoogleTokens(userId)
      return { userId, action: 'tokens_revoked' }

    case EVENT_TYPES.TOKEN_REVOKED:
      // Required: Delete the specific refresh token
      await revokeGoogleTokens(userId)
      return { userId, action: 'token_revoked' }

    case EVENT_TYPES.ACCOUNT_DISABLED: {
      const reason = eventData?.reason
      if (reason === 'hijacking') {
        // Required: Re-secure by ending sessions and disabling Google SSO
        await revokeUserSessions(userId)
        await revokeGoogleTokens(userId)
        await disableGoogleSso(userId)
      } else {
        // Suggested: Disable Google SSO and revoke tokens
        await disableGoogleSso(userId)
        await revokeGoogleTokens(userId)
        await revokeUserSessions(userId)
      }
      return { userId, action: 'account_disabled', reason }
    }

    case EVENT_TYPES.ACCOUNT_ENABLED:
      // Suggested: Re-enable Google SSO
      await enableGoogleSso(userId)
      return { userId, action: 'account_enabled' }

    case EVENT_TYPES.CREDENTIAL_CHANGE_REQUIRED:
      // Suggested: Flag for review — revoke sessions as precaution
      await revokeUserSessions(userId)
      await revokeGoogleTokens(userId)
      return { userId, action: 'credential_change_flagged' }

    case EVENT_TYPES.VERIFICATION:
      // Log verification token receipt
      console.log(`[RISC] Verification token received with state: ${eventData?.state}`)
      return { userId: null, action: 'verification_logged', state: eventData?.state }

    default:
      console.log(`[RISC] Unknown event type: ${eventType}`)
      return { userId, action: 'unknown_event_type' }
  }
}

/**
 * POST /api/security-events
 * 
 * Google Cross-Account Protection (RISC) receiver endpoint.
 * Receives signed JWT security event tokens from Google when
 * security-relevant changes occur on shared users' Google accounts.
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body
    const body = await request.text()
    if (!body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    // Step 1: Fetch RISC configuration
    const riscConfig = await getRISCConfig()

    // Step 2: Get Google's signing keys
    const jwks = await getGoogleJWKS(riscConfig.jwks_uri)

    // Step 3: Decode header to get kid
    const protectedHeader = jose.decodeProtectedHeader(body)
    const kid = protectedHeader.kid
    if (!kid) {
      console.error('[RISC] Token missing kid in header')
      return NextResponse.json({ error: 'Missing key ID' }, { status: 400 })
    }

    // Step 4: Find the matching public key
    const matchingKey = jwks.keys?.find((k: any) => k.kid === kid)
    if (!matchingKey) {
      console.error(`[RISC] No matching key found for kid: ${kid}`)
      return NextResponse.json({ error: 'Key not found' }, { status: 400 })
    }

    // Step 5: Import the key and verify the token
    const publicKey = await jose.importJWK(matchingKey, protectedHeader.alg || 'RS256')
    
    const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
    const { payload } = await jose.jwtVerify(body, publicKey, {
      issuer: riscConfig.issuer,
      audience: clientId,
      // Note: Security event tokens represent historical events.
      // jose skips exp verification when the claim is absent.
    })

    // Step 6: Extract event information
    const jti = payload.jti
    const events = (payload as any).events as Record<string, any> | undefined

    if (!jti || !events) {
      console.error('[RISC] Token missing jti or events claim')
      return NextResponse.json({ error: 'Invalid token structure' }, { status: 400 })
    }

    // Step 7: Deduplication — check if we've already processed this event
    const existingEvent = await prisma.securityEvent.findUnique({ where: { jti } })
    if (existingEvent) {
      console.log(`[RISC] Duplicate event ${jti}, already processed`)
      return new NextResponse(null, { status: 202 })
    }

    // Step 8: Process each event in the token
    const results: Array<{ eventType: string; action: string; userId: string | null }> = []

    for (const [eventType, eventData] of Object.entries(events)) {
      // Extract the Google sub from the subject claim
      const subject = eventData?.subject
      let googleSub: string | null = null

      if (subject?.subject_type === 'iss-sub') {
        googleSub = subject.sub
      } else if (subject?.subject_type === 'id_token_claims') {
        googleSub = subject.sub
      }

      if (!googleSub) {
        console.error(`[RISC] Could not extract Google sub from event ${eventType}`)
        continue
      }

      const result = await handleSecurityEvent(eventType, eventData, googleSub)

      // Record the event for audit trail and deduplication
      await prisma.securityEvent.create({
        data: {
          jti,
          eventType,
          googleSub,
          userId: result.userId,
          payload: JSON.stringify({ eventType, eventData, result }),
          status: 'processed',
        },
      })

      results.push({ eventType, action: result.action, userId: result.userId })
    }

    console.log(`[RISC] Processed event ${jti}:`, JSON.stringify(results))

    // Return 202 Accepted as per RISC spec
    return new NextResponse(null, { status: 202 })

  } catch (error: any) {
    console.error('[RISC] Error processing security event:', error?.message || error)
    
    // Return 400 for validation errors, 500 for internal errors
    if (error?.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' || 
        error?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
        error?.code === 'ERR_JWS_INVALID') {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/security-events
 * 
 * Health check endpoint — useful for verifying the receiver is accessible.
 * Not part of the RISC protocol, but helpful for debugging.
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'Cross-Account Protection (RISC) receiver',
    supported_events: Object.values(EVENT_TYPES),
  })
}
