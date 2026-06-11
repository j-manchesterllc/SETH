export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMessagesWithMemories } from '@/lib/venice'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const { taskId, decision } = await request.json() // decision: 'approve' | 'reject'

    if (!taskId || !decision) {
      return Response.json({ error: 'taskId and decision are required' }, { status: 400 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    })

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.pendingActionStatus !== 'pending_approval') {
      return Response.json({ error: 'Task has no pending approval' }, { status: 400 })
    }

    if (decision === 'reject') {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          pendingActionStatus: 'rejected',
          executionResult: 'Proposed action was rejected by user.',
        },
      })
      return Response.json({ success: true, status: 'rejected' })
    }

    // Approve and execute
    let pendingAction: any = {}
    try { pendingAction = JSON.parse(task.pendingAction ?? '{}') } catch {}

    // Execute the proposed action
    const memories = await prisma.memory.findMany({
      where: { userId },
      orderBy: { importance: 'desc' },
      take: 5,
    })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, objectives: true, preferences: true, workingStyle: true },
    })

    const execPrompt = `Execute this APPROVED task. The user has reviewed and approved the proposed action.\n\nTask: ${task.title}\nDescription: ${task.description ?? 'None'}\nProposed Plan: ${pendingAction.plan ?? 'Execute as described'}\nPriority: ${task.priority}\n\nProceed with execution and provide a completion report.`

    const messages = buildMessagesWithMemories(
      memories ?? [],
      [{ role: 'user', content: execPrompt }],
      user ?? undefined
    )

    let route = routeForBackground()
    let resultText = 'Execution attempted but no response received.'
    let success = false
    const startTime = Date.now()

    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const headers = buildHeaders(route)
        const body = buildRequestBody(route, messages, { maxTokens: 1500 })
        const res = await fetch(route.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
        if (res.ok) {
          const data = await res.json()
          resultText = data?.choices?.[0]?.message?.content ?? resultText
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

    await prisma.task.update({
      where: { id: taskId },
      data: {
        pendingActionStatus: 'approved',
        status: success ? 'completed' : 'pending',
        executedAt: success ? new Date() : undefined,
        executionResult: resultText.slice(0, 4000),
      },
    })

    await logAgentActivity({
      userId,
      action: 'auto_execute',
      tier: route.tier,
      model: route.model,
      provider: route.provider,
      latencyMs: Date.now() - startTime,
      success,
      metadata: { taskId, taskTitle: task.title, approved: true },
    })

    return Response.json({
      success: true,
      status: 'approved_and_executed',
      result: resultText.slice(0, 500),
    })
  } catch (error: any) {
    console.error('Task approval error:', error)
    return Response.json({ error: 'Approval failed' }, { status: 500 })
  }
}
