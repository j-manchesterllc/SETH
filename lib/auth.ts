import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) {
          throw new Error('No account found with this email')
        }
        if (!user.password) {
          throw new Error('This account uses Google sign-in. Please use the Google button.')
        }
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid password')
        }
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      // Block Google SSO if Cross-Account Protection has disabled it for this user
      if (account?.provider === 'google' && user?.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { googleSsoDisabled: true } })
        if (dbUser?.googleSsoDisabled) {
          return '/login?error=GoogleSSODisabled'
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      // On initial sign-in, capture Google OAuth tokens
      if (account?.provider === 'google') {
        token.googleAccessToken = account.access_token
        token.googleRefreshToken = account.refresh_token
        token.googleTokenExpiry = account.expires_at ? account.expires_at * 1000 : 0
      }
      if (user) {
        token.id = user.id
      }

      // If token is expired, try to refresh it
      if (token.googleRefreshToken && token.googleTokenExpiry && Date.now() > (token.googleTokenExpiry as number) - 60_000) {
        try {
          const refreshed = await refreshGoogleToken(token.googleRefreshToken as string)
          token.googleAccessToken = refreshed.access_token
          token.googleTokenExpiry = Date.now() + refreshed.expires_in * 1000
          // Clear any previous error state on successful refresh
          delete token.googleAccessTokenError
        } catch (err) {
          console.error('[Auth] Google token refresh failed:', err)
          // Clear stale tokens so UI shows "not connected" instead of using expired token
          token.googleAccessToken = undefined
          token.googleAccessTokenError = 'RefreshFailed'
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id as string
        ;(session.user as any).googleConnected = !!token.googleAccessToken
        ;(session.user as any).googleError = token.googleAccessTokenError ?? null
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  cookies: {
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

/**
 * Refresh an expired Google OAuth access token using the refresh token.
 */
async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token refresh failed: ${res.status} ${text.slice(0, 200)}`)
  }

  return res.json()
}