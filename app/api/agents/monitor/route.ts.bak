export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { dispatchToAgent } from '@/lib/agents'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/agents/monitor
 * Run autonomous monitoring for agents that have monitorEnabled=true.
 * Each agent checks its domain and surfaces alerts.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    // Rate limit: max 1 monitor cycle per user per 5 minutes
    if (!checkRateLimit(userId, 'agent-monitor', 300_000)) {
      return Response.json({ alerts: [], rateLimited: true })
    }

    // Find agents with monitoring enabled that are due for a check
    const now = new Date()
    const agents = await prisma.agent.findMany({
      where: {
        userId,
        monitorEnabled: true,
        monitorQuery: { not: null },
        status: { not: 'disabled' },
      },
    })

    // Filter to agents whose last check was long enough ago
    const dueAgents = agents.filter(agent => {
      if (!agent.lastMonitorAt) return true
      const minutesSince = (now.getTime() - agent.lastMonitorAt.getTime()) / 60_000
      return minutesSince >= agent.monitorInterval
    })

    if (dueAgents.length === 0) {
      return Response.json({ alerts: [], message: 'No agents due for monitoring' })
    }

    // Get user context for richer monitoring
    const [user, recentMemories] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, objectives: true },
      }),
      prisma.memory.findMany({
        where: { userId },
        orderBy: { importance: 'desc' },
        take: 5,
        select: { content: true, type: true },
      }),
    ])

    const contextStr = [
      user?.objectives ? `Principal's objectives: ${user.objectives}` : '',
      recentMemories.length > 0
        ? `Key memories:\n${recentMemories.map(m => `- [${m.type}] ${m.content}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n\n')

    const alerts: Array<{
      agentId: string
      agentName: string
      agentAvatar: string
      codename: string
      alert: string
      severity: 'info' | 'warning' | 'critical'
    }> = []

    // Process up to 3 agents per cycle to avoid timeout
    for (const agent of dueAgents.slice(0, 3)) {
      try {
        const monitorPrompt = `You are running an autonomous monitoring scan. Check your domain for the following:\n\n"${agent.monitorQuery}"\n\nAnalyze the current situation. If there is something noteworthy to report, respond with a JSON object:\n{ "hasAlert": true, "severity": "info|warning|critical", "summary": "one-line summary", "detail": "2-3 sentence analysis" }\n\nIf nothing noteworthy, respond with:\n{ "hasAlert": false, "summary": "All clear" }\n\nReturn ONLY valid JSON.`

        const result = await dispatchToAgent(
          agent.codename,
          userId,
          monitorPrompt,
          contextStr
        )

        // Update last monitor time regardless of result
        await prisma.agent.update({
          where: { id: agent.id },
          data: {
            lastMonitorAt: now,
            lastMonitorResult: result.output?.slice(0, 2000) || 'No response',
          },
        })

        if (result.success && result.output) {
          try {
            const cleaned = result.output.replace(/```json\n?|```\n?/g, '').trim()
            const parsed = JSON.parse(cleaned)
            if (parsed.hasAlert) {
              alerts.push({
                agentId: agent.id,
                agentName: agent.name,
                agentAvatar: agent.avatar ?? '\ud83e\udd16',
                codename: agent.codename,
                alert: parsed.detail || parsed.summary,
                severity: parsed.severity || 'info',
              })
            }
          } catch {
            // If we can't parse as JSON, check if the output mentions an alert
            const lower = result.output.toLowerCase()
            if (lower.includes('alert') || lower.includes('warning') || lower.includes('critical') || lower.includes('urgent')) {
              alerts.push({
                agentId: agent.id,
                agentName: agent.name,
                agentAvatar: agent.avatar ?? '\ud83e\udd16',
                codename: agent.codename,
                alert: result.output.slice(0, 300),
                severity: 'info',
              })
            }
          }
        }
      } catch (err: any) {
        console.error(`[Monitor] Agent ${agent.codename} failed:`, err?.message)
      }
    }

    return Response.json({ alerts, checked: dueAgents.slice(0, 3).map(a => a.codename) })
  } catch (err: any) {
    console.error('[Agent Monitor]', err)
    return new Response(JSON.stringify({ error: 'Monitor failed' }), { status: 500 })
  }
}
