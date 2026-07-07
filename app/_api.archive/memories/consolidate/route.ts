export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'

const CONSOLIDATION_PROMPT = `You are Seth's memory consolidation system. Analyze the following recent conversation messages and extract long-term patterns, preferences, and insights about the user.

Rules:
- Extract 2-5 distinct insights (NOT summaries of individual messages)
- Focus on PATTERNS: repeated behaviors, emerging preferences, evolving goals, relationship dynamics
- Each insight should be something useful for future conversations
- Rate importance 6-9 (6=useful pattern, 9=critical behavioral insight)
- Choose type: "preference" for likes/dislikes/habits, "context" for situational patterns, "decision" for choices/strategies, "note" for other insights

Respond ONLY with valid JSON array:
[{"content": "...", "type": "preference|context|decision|note", "importance": 6-9, "tags": "comma,separated"}]`

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    // Get recent messages (last 7 days, skip last consolidation period)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { userId },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { role: true, content: true, createdAt: true },
    })

    if (recentMessages.length < 5) {
      return Response.json({
        success: false,
        message: 'Not enough recent conversations to consolidate (need at least 5 messages)',
      })
    }

    // Format messages for analysis
    const formatted = recentMessages
      .reverse()
      .map(m => `[${m.role.toUpperCase()}] ${m.content.slice(0, 500)}`)
      .join('\n')

    const messages = [
      { role: 'system', content: CONSOLIDATION_PROMPT },
      { role: 'user', content: `Recent conversation messages (${recentMessages.length} messages from last 7 days):\n\n${formatted}` },
    ]

    // Use background model (free tier)
    let route = routeForBackground()
    let resultText = ''
    let success = false
    const startTime = Date.now()

    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const headers = buildHeaders(route)
        const body = buildRequestBody(route, messages, { maxTokens: 1500 })
        const res = await fetch(route.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
        if (res.ok) {
          const data = await res.json()
          resultText = data?.choices?.[0]?.message?.content ?? ''
          success = true
        } else {
          const fallback = getBackgroundFallback(route.model)
          if (fallback) route = fallback; else break
        }
      } catch {
        const fallback = getBackgroundFallback(route.model)
        if (fallback) route = fallback; else break
      }
    }

    if (!success || !resultText) {
      return Response.json({ success: false, message: 'Failed to generate consolidation — all models failed' })
    }

    // Parse LLM response
    let insights: Array<{ content: string; type: string; importance: number; tags: string }> = []
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/)
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0])
      }
    } catch {
      return Response.json({ success: false, message: 'Failed to parse consolidation results' })
    }

    if (insights.length === 0) {
      return Response.json({ success: false, message: 'No insights extracted' })
    }

    // Save insights as memories
    const created = []
    for (const insight of insights.slice(0, 5)) {
      const memory = await prisma.memory.create({
        data: {
          userId,
          type: ['context', 'decision', 'preference', 'note'].includes(insight.type) ? insight.type : 'note',
          content: `[AUTO-CONSOLIDATED] ${insight.content}`,
          importance: Math.min(9, Math.max(1, insight.importance ?? 6)),
          tags: (insight.tags ?? 'consolidated').toLowerCase(),
        },
      })
      created.push(memory)
    }

    const latencyMs = Date.now() - startTime

    // Log the consolidation
    await logAgentActivity({
      userId,
      action: 'consolidation',
      tier: route.tier,
      model: route.model,
      provider: route.provider,
      latencyMs,
      metadata: { insightsCreated: created.length, messagesAnalyzed: recentMessages.length },
    })

    return Response.json({
      success: true,
      insights: created.map(c => ({ id: c.id, content: c.content, type: c.type, importance: c.importance })),
      messagesAnalyzed: recentMessages.length,
      model: route.model,
    })
  } catch (error: any) {
    console.error('Memory consolidation error:', error)
    return Response.json({ error: 'Consolidation failed' }, { status: 500 })
  }
}
