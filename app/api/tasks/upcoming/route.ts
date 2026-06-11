export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const now = new Date()
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000)
    const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Get all pending/in-progress tasks with due dates in next 24h
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ['pending', 'in-progress'] },
        dueDate: {
          not: null,
          lte: in24Hours,
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Categorize by urgency
    const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now)
    const dueIn1Hour = tasks.filter((t: any) => {
      const d = t.dueDate ? new Date(t.dueDate) : null
      return d && d >= now && d <= in1Hour
    })
    const dueIn4Hours = tasks.filter((t: any) => {
      const d = t.dueDate ? new Date(t.dueDate) : null
      return d && d > in1Hour && d <= in4Hours
    })
    const dueIn24Hours = tasks.filter((t: any) => {
      const d = t.dueDate ? new Date(t.dueDate) : null
      return d && d > in4Hours && d <= in24Hours
    })

    // Find tasks that haven't been notified recently (within 30 min)
    const notifyThreshold = new Date(now.getTime() - 30 * 60 * 1000)
    const needsNotification = [...overdue, ...dueIn1Hour].filter(
      (t: any) => !t.notifiedAt || new Date(t.notifiedAt) < notifyThreshold
    )

    // Mark them as notified
    if (needsNotification.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: needsNotification.map((t: any) => t.id) } },
        data: { notifiedAt: now },
      })
    }

    return Response.json({
      overdue: overdue.map(formatTask),
      dueIn1Hour: dueIn1Hour.map(formatTask),
      dueIn4Hours: dueIn4Hours.map(formatTask),
      dueIn24Hours: dueIn24Hours.map(formatTask),
      needsNotification: needsNotification.map(formatTask),
    })
  } catch (error: any) {
    console.error('Upcoming tasks error:', error)
    return Response.json({ error: 'Failed to check tasks' }, { status: 500 })
  }
}

function formatTask(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    autonomyLevel: t.autonomyLevel,
    status: t.status,
    dueDate: t.dueDate,
  }
}
