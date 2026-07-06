export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAgentActivity } from '@/lib/agent-logger'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const now = new Date()
    const changes: Array<{ id: string; title: string; change: string }> = []

    // 1. Auto-escalate overdue tasks to HIGH priority
    const overdueTasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ['pending', 'in-progress'] },
        dueDate: { lt: now },
        priority: { not: 'high' },
      },
    })

    for (const task of overdueTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { priority: 'high' },
      })
      changes.push({ id: task.id, title: task.title, change: `Escalated to HIGH (was ${task.priority}, overdue)` })
    }

    // 2. Escalate tasks due within 24h from low → medium
    const soonDue = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const urgentTasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ['pending', 'in-progress'] },
        dueDate: { gte: now, lte: soonDue },
        priority: 'low',
      },
    })

    for (const task of urgentTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { priority: 'medium' },
      })
      changes.push({ id: task.id, title: task.title, change: 'Escalated to MEDIUM (was low, due within 24h)' })
    }

    // 3. Auto-archive completed tasks older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oldCompleted = await prisma.task.findMany({
      where: {
        userId,
        status: 'completed',
        updatedAt: { lt: sevenDaysAgo },
      },
      select: { id: true, title: true },
    })

    if (oldCompleted.length > 0) {
      await prisma.task.updateMany({
        where: {
          id: { in: oldCompleted.map(t => t.id) },
        },
        data: { status: 'archived' },
      })
      for (const t of oldCompleted) {
        changes.push({ id: t.id, title: t.title, change: 'Archived (completed >7 days ago)' })
      }
    }

    // Log the reprioritization
    if (changes.length > 0) {
      await logAgentActivity({
        userId,
        action: 'reprioritize',
        metadata: { changes: changes.length, details: changes },
      })
    }

    return Response.json({
      success: true,
      changes,
      summary: {
        escalatedHigh: overdueTasks.length,
        escalatedMedium: urgentTasks.length,
        archived: oldCompleted.length,
      },
    })
  } catch (error: any) {
    console.error('Task reprioritization error:', error)
    return Response.json({ error: 'Reprioritization failed' }, { status: 500 })
  }
}
