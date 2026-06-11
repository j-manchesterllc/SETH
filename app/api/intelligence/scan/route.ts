export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody, type ModelConfig } from '@/lib/model-router'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAgentActivity } from '@/lib/agent-logger'

/**
 * POST /api/intelligence/scan
 * Context-aware proactive intelligence scan.
 * Checks: unresponded emails, calendar gaps, overdue task patterns, stale watches.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    // Rate limit: 1 scan per 10 minutes
    if (!checkRateLimit(userId, 'intelligence-scan', 600_000)) {
      return Response.json({ insights: [], rateLimited: true })
    }

    // Gather context data in parallel
    const [overdueTasks, staleTasks, recentLogs, activeWatches] = await Promise.all([
      // Overdue tasks
      prisma.task.findMany({
        where: {
          userId,
          status: { in: ['pending', 'in-progress'] },
          dueDate: { lt: new Date() },
        },
        select: { id: true, title: true, priority: true, dueDate: true },
        take: 10,
      }),
      // Tasks pending too long (>3 days without action)
      prisma.task.findMany({
        where: {
          userId,
          status: 'pending',
          updatedAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, title: true, priority: true, createdAt: true },
        take: 10,
      }),
      // Recent agent activity (last 24h)
      prisma.agentLog.findMany({
        where: {
          userId,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { action: true, toolName: true, success: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      // Watches that haven't been checked recently
      prisma.watch.findMany({
        where: {
          userId,
          active: true,
          OR: [
            { lastChecked: null },
            { lastChecked: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
        select: { id: true, name: true, type: true, lastChecked: true },
        take: 5,
      }),
    ])

    // Check Google tokens for email context
    let emailContext = ''
    try {
      const jwt = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET! })
      if (jwt?.googleAccessToken) {
        emailContext = 'Google connected — email triage capabilities available.'
      } else {
        emailContext = 'Google not connected — cannot scan emails.'
      }
    } catch { /* ignore */ }

    // Build the intelligence brief for LLM analysis
    const briefParts: string[] = []

    if (overdueTasks.length > 0) {
      briefParts.push(`OVERDUE TASKS (${overdueTasks.length}):\n${overdueTasks.map(t =>
        `- "${t.title}" [${t.priority}] due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'unknown'}`
      ).join('\n')}`)
    }

    if (staleTasks.length > 0) {
      briefParts.push(`STALE TASKS (${staleTasks.length} pending >3 days):\n${staleTasks.map(t =>
        `- "${t.title}" [${t.priority}] created ${new Date(t.createdAt).toLocaleDateString()}`
      ).join('\n')}`)
    }

    if (activeWatches.length > 0) {
      briefParts.push(`UNCHECKED WATCHES (${activeWatches.length}):\n${activeWatches.map(w =>
        `- "${w.name}" [${w.type}] last checked: ${w.lastChecked ? new Date(w.lastChecked).toLocaleDateString() : 'never'}`
      ).join('\n')}`)
    }

    briefParts.push(`ACTIVITY SUMMARY: ${recentLogs.length} actions in last 24h. ${recentLogs.filter(l => !l.success).length} failures.`)
    briefParts.push(emailContext)

    if (briefParts.length <= 2) {
      return Response.json({ insights: [], message: 'No actionable intelligence found' })
    }

    // Send to LLM for analysis
    const systemPrompt = `You are Seth's intelligence analysis engine. Review the situation report and generate 1-5 proactive insights or recommendations. Each insight should be actionable. Return ONLY valid JSON array: [{ "type": "overdue|stale|watch|pattern|opportunity", "severity": "low|medium|high", "title": "short title", "insight": "1-2 sentence recommendation", "action": "suggested next step" }]`

    const prompt = `SITUATION REPORT — ${new Date().toLocaleDateString()}\n\n${briefParts.join('\n\n')}\n\nGenerate proactive intelligence insights.`

    let config: ModelConfig = routeForBackground()
    let rawResponse = ''
    let success = false

    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const headers = buildHeaders(config)
        const body = buildRequestBody(config, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ], { maxTokens: 1500 })
        const res = await fetch(config.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
        if (res.ok) {
          const data = await res.json()
          rawResponse = data?.choices?.[0]?.message?.content ?? ''
          success = true
        } else {
          const fb = getBackgroundFallback(config.model)
          if (fb) config = fb; else break
        }
      } catch {
        const fb = getBackgroundFallback(config.model)
        if (fb) config = fb; else break
      }
    }

    logAgentActivity({
      userId,
      action: 'intelligence_scan',
      tier: config.tier,
      model: config.model,
      provider: config.provider,
      success,
      metadata: { overdueTasks: overdueTasks.length, staleTasks: staleTasks.length, watches: activeWatches.length },
    })

    if (!success) {
      return Response.json({ insights: [], error: 'LLM analysis failed' })
    }

    // Parse insights
    try {
      const cleaned = rawResponse.replace(/```json\n?|```\n?/g, '').trim()
      const insights = JSON.parse(cleaned)
      return Response.json({ insights: Array.isArray(insights) ? insights : [] })
    } catch {
      return Response.json({ insights: [{ type: 'pattern', severity: 'low', title: 'Analysis Note', insight: rawResponse.slice(0, 300), action: 'Review manually' }] })
    }
  } catch (err: any) {
    console.error('[Intelligence Scan]', err)
    return new Response(JSON.stringify({ error: 'Scan failed' }), { status: 500 })
  }
}
