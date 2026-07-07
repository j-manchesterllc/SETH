export const dynamic = 'force-dynamic'
export const revalidate = 0
import { prisma } from '@/lib/prisma'
import { runMemoryDecay, generateSemanticTags, enrichMemoryAsync } from '@/lib/cortex'
import { generateEmbedding, serializeEmbedding, EMBEDDING_MODEL_TAG } from '@/lib/embeddings'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'

const CRON_SECRET = process.env.CRON_SECRET || ''

const CONSOLIDATION_PROMPT = `You are Seth's memory consolidation system. Analyze the following recent conversation messages and extract long-term patterns, preferences, and insights about the user.

Rules:
- Extract 2-5 distinct insights (NOT summaries of individual messages)
- Focus on PATTERNS: repeated behaviors, emerging preferences, evolving goals, relationship dynamics
- Each insight should be something useful for future conversations
- Rate importance 6-9 (6=useful pattern, 9=critical behavioral insight)
- Choose type: "preference" for likes/dislikes/habits, "context" for situational patterns, "decision" for choices/strategies, "note" for other insights

Respond ONLY with valid JSON array:
[{"content": "...", "type": "preference|context|decision|note", "importance": 6-9, "tags": "comma,separated"}]`

/**
 * Daily cron endpoint for memory consolidation + decay.
 * Processes ALL users who have had recent activity.
 * Auth: requires CRON_SECRET header match.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('x-cron-secret') || ''
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const results: Array<{ userId: string; consolidation: any; decay: any; semanticTagsBackfilled: number; embeddingsBackfilled: number }> = []
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  try {
    // Find all users with recent messages
    const activeUsers = await prisma.user.findMany({
      where: {
        conversations: {
          some: {
            messages: {
              some: { createdAt: { gte: sevenDaysAgo } },
            },
          },
        },
      },
      select: { id: true },
    })

    for (const user of activeUsers) {
      const userId = user.id
      let consolidation: any = { skipped: true }
      let decay: any = { skipped: true }
      let semanticTagsBackfilled = 0
      let embeddingsBackfilled = 0

      try {
        // 1. Memory consolidation
        const recentMessages = await prisma.message.findMany({
          where: {
            conversation: { userId },
            createdAt: { gte: sevenDaysAgo },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { role: true, content: true, createdAt: true },
        })

        if (recentMessages.length >= 5) {
          const formatted = recentMessages
            .reverse()
            .map(m => `[${m.role.toUpperCase()}] ${m.content.slice(0, 500)}`)
            .join('\n')

          const messages = [
            { role: 'system', content: CONSOLIDATION_PROMPT },
            { role: 'user', content: `Recent conversation messages (${recentMessages.length} messages from last 7 days):\n\n${formatted}` },
          ]

          let route = routeForBackground()
          let resultText = ''
          let success = false

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

          if (success && resultText) {
            try {
              const jsonMatch = resultText.match(/\[\s*\{[\s\S]*\}\s*\]/)
              if (jsonMatch) {
                const insights = JSON.parse(jsonMatch[0])
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
                  // Generate semantic tags + vector embedding for newly created memory
                  enrichMemoryAsync(memory.id, memory.content).catch(() => {})
                  created.push(memory)
                }
                consolidation = { insightsCreated: created.length, messagesAnalyzed: recentMessages.length }

                await logAgentActivity({
                  userId,
                  action: 'consolidation',
                  tier: route.tier,
                  model: route.model,
                  provider: route.provider,
                  latencyMs: 0,
                  metadata: { insightsCreated: created.length, messagesAnalyzed: recentMessages.length, source: 'cron' },
                }).catch(() => {})
              }
            } catch {}
          }
        }

        // 2. Memory decay pass
        try {
          decay = await runMemoryDecay(userId)
        } catch (e: any) {
          decay = { error: e.message }
        }

        // 3. Backfill semantic tags on memories that don't have them
        try {
          const untagged = await prisma.memory.findMany({
            where: { userId, semanticTags: null, type: { not: 'archived' } },
            take: 10,
            select: { id: true, content: true },
          })
          for (const m of untagged) {
            const tags = await generateSemanticTags(m.content)
            if (tags.length > 0) {
              await prisma.memory.update({
                where: { id: m.id },
                data: { semanticTags: JSON.stringify(tags) },
              })
              semanticTagsBackfilled++
            }
          }
        } catch {}

        // 4. Backfill vector embeddings on memories that don't have them
        try {
          const unembedded = await prisma.memory.findMany({
            where: { userId, embedding: null, type: { not: 'archived' } },
            take: 8, // smaller batch — embedding generation is heavier
            select: { id: true, content: true },
          })
          for (const m of unembedded) {
            const vec = await generateEmbedding(m.content)
            if (vec) {
              await prisma.memory.update({
                where: { id: m.id },
                data: { embedding: serializeEmbedding(vec), embeddingModel: EMBEDDING_MODEL_TAG },
              })
              embeddingsBackfilled++
            }
          }
        } catch {}

      } catch (e: any) {
        console.error(`[Cron] Error processing user ${userId}:`, e)
      }

      results.push({ userId, consolidation, decay, semanticTagsBackfilled, embeddingsBackfilled })
    }

    return Response.json({
      success: true,
      usersProcessed: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Cron] Consolidation error:', error)
    return Response.json({ error: 'Cron consolidation failed' }, { status: 500 })
  }
}
