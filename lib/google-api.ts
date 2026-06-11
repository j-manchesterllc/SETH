/**
 * Shared utility for accessing Google APIs from server routes.
 * Retrieves the Google access token from the JWT and creates
 * authenticated API clients.
 */

import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'

/**
 * Extract the Google access token from the request's NextAuth JWT.
 * Returns null if the user hasn't connected Google or the token is missing.
 */
export async function getGoogleAccessToken(request: Request): Promise<string | null> {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })
    return (token?.googleAccessToken as string) ?? null
  } catch (err) {
    console.error('[GoogleAPI] Failed to get token:', err)
    return null
  }
}

/**
 * Create an authenticated Google OAuth2 client from the request JWT.
 */
export async function getGoogleAuth(request: Request) {
  const accessToken = await getGoogleAccessToken(request)
  if (!accessToken) return null

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ access_token: accessToken })
  return auth
}

/**
 * Create a Google Calendar API client from the request JWT.
 */
export async function getCalendarClient(request: Request) {
  const auth = await getGoogleAuth(request)
  if (!auth) return null
  return google.calendar({ version: 'v3', auth })
}

/**
 * Create a Gmail API client from the request JWT.
 */
export async function getGmailClient(request: Request) {
  const auth = await getGoogleAuth(request)
  if (!auth) return null
  return google.gmail({ version: 'v1', auth })
}
