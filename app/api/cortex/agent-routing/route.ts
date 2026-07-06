export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRoutingAnalytics, adaptiveSelectAgent, detectTaskDomain } from '@/lib/agent-router'

// GET: Retrieve routing analytics
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30', 10)

    const analytics = await getRoutingAnalytics(userId, days)

    return Response.json(analytics)
  } catch (err: any) {
    console.error('[Agent Routing API]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// POST: Preview adaptive routing for a task (without dispatching)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { taskInput, preferSpeed, excludeAgents } = body

    if (!taskInput) {
      return new Response(JSON.stringify({ error: 'taskInput is required' }), { status: 400 })
    }

    // Preview domain detection
    const domain = detectTaskDomain(taskInput)

    // Preview agent scoring
    const routing = await adaptiveSelectAgent(userId, taskInput, { preferSpeed, excludeAgents })

    return Response.json({
      domain,
      routing: {
        method: routing.method,
        confidence: routing.confidence,
        selectedAgent: routing.selectedAgent
          ? {
              name: routing.selectedAgent.name,
              codename: routing.selectedAgent.codename,
              avatar: routing.selectedAgent.avatar,
              score: routing.selectedAgent.score,
              reasons: routing.selectedAgent.reasons,
              breakdown: routing.selectedAgent.breakdown,
            }
          : null,
        allScores: routing.allScores.map(s => ({
          name: s.name,
          codename: s.codename,
          avatar: s.avatar,
          score: s.score,
          reasons: s.reasons,
          breakdown: s.breakdown,
        })),
        reasoning: routing.reasoning,
        latencyMs: routing.latencyMs,
      },
    })
  } catch (err: any) {
    console.error('[Agent Routing API]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
