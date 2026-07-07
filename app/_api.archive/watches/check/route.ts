export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import { checkRateLimit } from '@/lib/rate-limit'

const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    // Rate limit: max 1 watch check per user per 60s
    if (!checkRateLimit(userId, 'watches-check', 60_000)) {
      return Response.json({ alerts: [], checked: 0, rateLimited: true })
    }

    const veniceKey = process.env.VENICE_API_KEY
    if (!veniceKey) {
      return Response.json({ error: 'API not configured' }, { status: 500 })
    }

    const now = new Date()

    // Get active watches that are due for a check
    const watches = await prisma.watch.findMany({
      where: { userId, active: true },
    })

    const dueWatches = watches.filter((w: any) => {
      if (!w.lastChecked) return true
      const interval = FREQUENCY_MS[w.frequency] ?? FREQUENCY_MS.daily
      return now.getTime() - new Date(w.lastChecked).getTime() >= interval
    })

    if (dueWatches.length === 0) {
      return Response.json({ alerts: [], checked: 0 })
    }

    const alerts: Array<{ watchId: string; name: string; type: string; alert: string; data: string }> = []

    // Helper: call LLM with free-tier fallback chain
    async function callWithFallback(
      messages: Array<{ role: string; content: string }>,
      opts: { maxTokens?: number; webSearch?: boolean | 'auto' } = {}
    ): Promise<string> {
      let route = routeForBackground()
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const headers = buildHeaders(route)
          const body = buildRequestBody(route, messages, {
            maxTokens: opts.maxTokens ?? 800,
            webSearch: route.provider === 'venice' ? (opts.webSearch ?? undefined) : undefined,
          })
          const res = await fetch(route.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
          if (res.ok) {
            const data = await res.json()
            return data?.choices?.[0]?.message?.content ?? ''
          }
          console.warn(`Watch check model ${route.model} returned ${res.status}`)
        } catch (e: any) {
          console.warn(`Watch check fetch failed for ${route.model}:`, e?.message)
        }
        const fallback = getBackgroundFallback(route.model)
        if (!fallback) break
        route = fallback
      }
      // Last resort: direct Venice call (always available for web search)
      try {
        const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${veniceKey}` },
          body: JSON.stringify({
            model: 'venice-uncensored', messages,
            venice_parameters: { enable_web_search: opts.webSearch === true ? 'on' : 'auto' },
            max_tokens: opts.maxTokens ?? 800,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          return data?.choices?.[0]?.message?.content ?? ''
        }
      } catch {}
      return ''
    }

    // Check max 3 watches per call to avoid timeout
    for (const watch of dueWatches.slice(0, 3)) {
      try {
        // Step 1: Search for latest data (prefer Venice for web search, free models as fallback)
        const searchQuery = watch.type === 'price'
          ? `What is the current price/value of: ${watch.query}? Provide the exact current price and any significant recent change.`
          : watch.type === 'news'
            ? `What is the latest news about: ${watch.query}? Provide the most recent and significant developments.`
            : `Check the following and provide a brief status update: ${watch.query}`

        const searchResult = await callWithFallback(
          [
            { role: 'system', content: 'You are a concise intelligence analyst. Search for the latest information and provide a brief, factual update. Focus on specific numbers, dates, and developments.' },
            { role: 'user', content: searchQuery },
          ],
          { maxTokens: 800, webSearch: true }
        ) || 'No data retrieved'

        // Step 2: Analyze if alert should trigger (free model, no web search needed)
        const analysisPrompt = watch.threshold
          ? `Based on this data, does it meet the alert condition "${watch.threshold}"? Respond with ALERT: [brief reason] if yes, or NO_ALERT: [brief status] if no.\n\nData: ${searchResult}`
          : `Summarize the key finding in one sentence. If there's something noteworthy or actionable, start with ALERT:, otherwise start with UPDATE:.\n\nData: ${searchResult}`

        const analysisText = await callWithFallback(
          [{ role: 'user', content: analysisPrompt }],
          { maxTokens: 200 }
        )

        const isAlert = analysisText.toUpperCase().startsWith('ALERT')

        // Update the watch
        await prisma.watch.update({
          where: { id: watch.id },
          data: {
            lastChecked: now,
            lastResult: searchResult.slice(0, 2000),
            ...(isAlert && { lastAlerted: now }),
          },
        })

        if (isAlert) {
          alerts.push({
            watchId: watch.id,
            name: watch.name,
            type: watch.type,
            alert: analysisText.slice(0, 300),
            data: searchResult.slice(0, 500),
          })
        }
      } catch (err: any) {
        console.error(`Watch check failed for ${watch.id}:`, err?.message)
      }
    }

    return Response.json({
      alerts,
      checked: Math.min(dueWatches.length, 3),
      remaining: Math.max(dueWatches.length - 3, 0),
    })
  } catch (error: any) {
    console.error('Watch check error:', error)
    return Response.json({ error: 'Watch check failed' }, { status: 500 })
  }
}
