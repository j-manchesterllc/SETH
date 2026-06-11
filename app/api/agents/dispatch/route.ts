export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { dispatchToAgent, adaptiveSelectAgentForTask } from '@/lib/agents'

// POST: Dispatch a task to a specific agent (supports adaptive routing)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { agentCodename, input, context, mode } = body

    if (!input) {
      return new Response(JSON.stringify({ error: 'input is required' }), { status: 400 })
    }

    // Adaptive routing: auto-select agent if mode is 'auto' or no agentCodename
    if (mode === 'auto' || (!agentCodename && mode !== 'direct')) {
      const selection = await adaptiveSelectAgentForTask(userId, input)
      if (!selection) {
        return new Response(JSON.stringify({ error: 'No suitable agent found for this task' }), { status: 422 })
      }

      const result = await dispatchToAgent(selection.codename, userId, input, context)
      return Response.json({
        ...result,
        routing: {
          method: selection.method,
          confidence: selection.confidence,
          reasoning: selection.reasoning,
        },
      })
    }

    if (!agentCodename) {
      return new Response(JSON.stringify({ error: 'agentCodename is required for direct dispatch' }), { status: 400 })
    }

    const result = await dispatchToAgent(agentCodename, userId, input, context)

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error, result }), { status: 422 })
    }

    return Response.json(result)
  } catch (err: any) {
    console.error('[Agent Dispatch]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
