export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runBrowserAutomation } from '@/lib/browser-automate-core'

// Guard: fail fast with a clear message if Browserless is not configured
if (!process.env.BROWSERLESS_API_TOKEN) {
  console.warn('[browser-automate] BROWSERLESS_API_TOKEN not set — browser automation disabled')
}

/**
 * POST /api/browser-automate
 * Accepts a natural-language task description, generates a Puppeteer script via LLM,
 * executes it on Browserless.io, and returns results.
 * 
 * Requires session auth — no internal bypass.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    if (!userId) {
      return Response.json({ error: 'User ID not found' }, { status: 401 })
    }

    const body = await request.json()
    const { task, url, automationId } = body ?? {}

    if (!task) {
      return Response.json({ error: 'Task description is required' }, { status: 400 })
    }

    if (!process.env.BROWSERLESS_API_TOKEN) {
      return Response.json({ error: 'Browser automation is not configured on this server.' }, { status: 503 })
    }

    const result = await runBrowserAutomation(userId, task, url, automationId)
    return Response.json(result)
  } catch (error: any) {
    console.error('[BrowserAutomate] Route error:', error)
    return Response.json({ error: 'Automation request failed' }, { status: 500 })
  }
}
