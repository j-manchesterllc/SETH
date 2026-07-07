export const dynamic = 'force-dynamic'
export const revalidate = 0
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
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Parallel queries for all stats
    const [
      totalLogs,
      logs24h,
      logs7d,
      recentLogs,
      tierCounts,
      toolCounts,
      memoriesCount,
      tasksCount,
      tasksByStatus,
      conversationCount,
      messageCount,
      watchCount,
    ] = await Promise.all([
      prisma.agentLog.count({ where: { userId } }),
      prisma.agentLog.count({ where: { userId, createdAt: { gte: last24h } } }),
      prisma.agentLog.count({ where: { userId, createdAt: { gte: last7d } } }),
      prisma.agentLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          tier: true,
          model: true,
          provider: true,
          toolName: true,
          latencyMs: true,
          success: true,
          error: true,
          createdAt: true,
          metadata: true,
        },
      }),
      prisma.agentLog.groupBy({
        by: ['tier'],
        where: { userId, createdAt: { gte: last30d } },
        _count: true,
      }),
      prisma.agentLog.groupBy({
        by: ['toolName'],
        where: { userId, action: 'tool_call', createdAt: { gte: last30d } },
        _count: true,
      }),
      prisma.memory.count({ where: { userId } }),
      prisma.task.count({ where: { userId } }),
      prisma.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      }),
      prisma.conversation.count({ where: { userId } }),
      prisma.message.count({
        where: { conversation: { userId } },
      }),
      prisma.watch.count({ where: { userId } }),
    ])

    // Compute average latency
    const avgLatency = await prisma.agentLog.aggregate({
      where: { userId, latencyMs: { not: null }, createdAt: { gte: last7d } },
      _avg: { latencyMs: true },
    })

    // Tier distribution
    const tierDistribution: Record<string, number> = {}
    for (const t of tierCounts) {
      tierDistribution[t.tier ?? 'unknown'] = t._count
    }

    // Tool usage
    const toolUsage: Record<string, number> = {}
    for (const t of toolCounts) {
      if (t.toolName) toolUsage[t.toolName] = t._count
    }

    // Task status breakdown
    const taskStatusMap: Record<string, number> = {}
    for (const t of tasksByStatus) {
      taskStatusMap[t.status] = t._count
    }

    return Response.json({
      overview: {
        totalInteractions: totalLogs,
        last24h: logs24h,
        last7d: logs7d,
        avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
        memories: memoriesCount,
        tasks: tasksCount,
        tasksByStatus: taskStatusMap,
        conversations: conversationCount,
        messages: messageCount,
        watches: watchCount,
      },
      tierDistribution,
      toolUsage,
      recentActivity: recentLogs,
    })
  } catch (error: any) {
    console.error('System stats error:', error)
    return Response.json({ error: 'Failed to fetch system stats' }, { status: 500 })
  }
}
