export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMessagesWithMemories } from '@/lib/venice'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    // Rate limit: max 1 auto-execute per user per 120s
    if (!checkRateLimit(userId, 'auto-execute', 120_000)) {
      return Response.json({ executed: [], rateLimited: true })
    }

    // Find Level 1 pending/stale-in-progress tasks (auto-execute) and Level 2-3 needing proposals
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000) // 5 min
    const [autoTasks, proposalTasks] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId,
          autonomyLevel: 1,
          executedAt: null,
          OR: [
            { status: 'pending' },
            { status: 'in-progress', updatedAt: { lt: staleThreshold } },
          ],
        },
        take: 3,
        orderBy: { priority: 'asc' },
      }),
      prisma.task.findMany({
        where: {
          userId,
          autonomyLevel: { in: [2, 3] },
          executedAt: null,
          pendingAction: null, // No proposal generated yet
          OR: [
            { status: 'pending' },
            { status: 'in-progress', updatedAt: { lt: staleThreshold } },
          ],
        },
        take: 2,
        orderBy: { priority: 'asc' },
      }),
    ])

    if (autoTasks.length === 0 && proposalTasks.length === 0) {
      return Response.json({ executed: [], proposed: [], message: 'No tasks to process' })
    }

    // Get user context for Seth
    const memories = await prisma.memory.findMany({
      where: { userId },
      orderBy: { importance: 'desc' },
      take: 5,
    })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, objectives: true, preferences: true, workingStyle: true },
    })

    const executed: Array<{ taskId: string; title: string; result: string; status: string }> = []

    for (const task of autoTasks) {
      try {
        // Build a prompt for Seth to execute the task
        const taskPrompt = `Execute this Level 1 (auto-execute) task and provide a concise completion report:\n\nTask: ${task.title}\nDescription: ${task.description ?? 'No description'}\nPriority: ${task.priority}\n\nDo your best to accomplish this task. Provide the result of your work. If it requires information, gather it. If it requires a decision, make it based on the principal's known preferences and objectives. Be thorough but concise.`

        const messages = buildMessagesWithMemories(
          memories ?? [],
          [{ role: 'user', content: taskPrompt }],
          user ?? undefined
        )

        // Use free models for background task execution (cost-efficient)
        let route = routeForBackground()
        let resultText = 'Execution attempted but no response received.'
        let success = false

        // Try with fallback chain: free models → Venice
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          const headers = buildHeaders(route)
          const body = buildRequestBody(route, messages, {
            maxTokens: 1500,
            webSearch: route.provider === 'venice' ? 'auto' : undefined,
          })

          try {
            const res = await fetch(route.apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            })

            if (res.ok) {
              const data = await res.json()
              resultText = data?.choices?.[0]?.message?.content ?? resultText
              success = true
            } else {
              console.warn(`Auto-execute model ${route.model} returned ${res.status}, trying fallback...`)
              const fallback = getBackgroundFallback(route.model)
              if (fallback) { route = fallback } else break
            }
          } catch (fetchErr: any) {
            console.warn(`Auto-execute fetch failed for ${route.model}:`, fetchErr?.message)
            const fallback = getBackgroundFallback(route.model)
            if (fallback) { route = fallback } else break
          }
        }

        // FIX #4: Only mark completed when LLM actually succeeded
        if (success) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'completed',
              executedAt: new Date(),
              executionResult: resultText.slice(0, 4000),
            },
          })
          executed.push({
            taskId: task.id,
            title: task.title,
            result: resultText.slice(0, 500),
            status: 'completed',
          })
        } else {
          // All models failed — leave task pending so it retries next cycle
          await prisma.task.update({
            where: { id: task.id },
            data: {
              executionResult: 'Auto-execution attempted but all models failed. Will retry next cycle.',
            },
          })
          executed.push({
            taskId: task.id,
            title: task.title,
            result: 'All models failed — will retry',
            status: 'retry',
          })
        }
      } catch (err: any) {
        console.error(`Auto-execute task ${task.id} failed:`, err?.message)
        await prisma.task.update({
          where: { id: task.id },
          data: {
            executionResult: `Auto-execution failed: ${err?.message ?? 'Unknown error'}`,
          },
        })
        executed.push({
          taskId: task.id,
          title: task.title,
          result: `Failed: ${err?.message ?? 'Unknown error'}`,
          status: 'failed',
        })
      }
    }

    // Phase 2: Generate proposals for Level 2-3 tasks
    const proposed: Array<{ taskId: string; title: string; plan: string; level: number }> = []

    for (const task of proposalTasks) {
      try {
        const proposalPrompt = task.autonomyLevel === 2
          ? `Propose a quick execution plan for this task. You WILL execute it and notify the user. Be concise but thorough:\n\nTask: ${task.title}\nDescription: ${task.description ?? 'No description'}\nPriority: ${task.priority}\n\nProvide a 2-3 sentence plan of what you'll do.`
          : `Propose an action plan for this task that requires user approval before execution:\n\nTask: ${task.title}\nDescription: ${task.description ?? 'No description'}\nPriority: ${task.priority}\n\nProvide a clear 3-5 sentence plan. The user must approve before you proceed.`

        const proposalMessages = buildMessagesWithMemories(
          memories ?? [],
          [{ role: 'user', content: proposalPrompt }],
          user ?? undefined
        )

        let propRoute = routeForBackground()
        let planText = ''
        let propSuccess = false

        for (let attempt = 0; attempt < 3 && !propSuccess; attempt++) {
          try {
            const headers = buildHeaders(propRoute)
            const body = buildRequestBody(propRoute, proposalMessages, { maxTokens: 500 })
            const res = await fetch(propRoute.apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })
            if (res.ok) {
              const data = await res.json()
              planText = data?.choices?.[0]?.message?.content ?? ''
              propSuccess = true
            } else {
              const fallback = getBackgroundFallback(propRoute.model)
              if (fallback) propRoute = fallback; else break
            }
          } catch {
            const fallback = getBackgroundFallback(propRoute.model)
            if (fallback) propRoute = fallback; else break
          }
        }

        if (propSuccess && planText) {
          const pendingAction = JSON.stringify({ plan: planText, generatedAt: new Date().toISOString(), model: propRoute.model })

          if (task.autonomyLevel === 2) {
            // Level 2: Execute immediately, notify user
            await prisma.task.update({
              where: { id: task.id },
              data: {
                pendingAction,
                pendingActionStatus: 'approved', // Auto-approved for Level 2
                status: 'completed',
                executedAt: new Date(),
                executionResult: planText.slice(0, 4000),
              },
            })
            proposed.push({ taskId: task.id, title: task.title, plan: planText.slice(0, 300), level: 2 })
          } else {
            // Level 3: Needs approval
            await prisma.task.update({
              where: { id: task.id },
              data: {
                pendingAction,
                pendingActionStatus: 'pending_approval',
              },
            })
            proposed.push({ taskId: task.id, title: task.title, plan: planText.slice(0, 300), level: 3 })
          }
        }
      } catch (err: any) {
        console.error(`Proposal for task ${task.id} failed:`, err?.message)
      }
    }

    return Response.json({ executed, proposed })
  } catch (error: any) {
    console.error('Auto-execute error:', error)
    return Response.json({ error: 'Auto-execution failed' }, { status: 500 })
  }
}
