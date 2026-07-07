export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/automations/metrics
 * Returns operational automation metrics for the authenticated user.
 *
 * Tracks:
 *  - Total automations started
 *  - Completed / Failed / Partial / Running counts
 *  - Retry rate (automations that required retry)
 *  - Median execution time
 *  - Success rate by time period
 *  - Failure breakdown by errorType
 *  - Average steps completed vs total
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    // Get all automations for metrics
    const automations = await prisma.browserAutomation.findMany({
      where: { userId },
      select: {
        status: true,
        errorType: true,
        durationMs: true,
        retryCount: true,
        stepsTotal: true,
        stepsCompleted: true,
        executionPhase: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // last 500 for metrics
    })

    const total = automations.length
    if (total === 0) {
      return Response.json({
        total: 0,
        completed: 0,
        failed: 0,
        partial: 0,
        running: 0,
        successRate: 0,
        retryRate: 0,
        medianDurationMs: 0,
        avgStepCompletion: 0,
        failureBreakdown: {},
        last7Days: { total: 0, completed: 0, successRate: 0 },
        last30Days: { total: 0, completed: 0, successRate: 0 },
      })
    }

    // Status counts
    const completed = automations.filter(a => a.status === 'completed').length
    const failed = automations.filter(a => a.status === 'failed').length
    const partial = automations.filter(a => a.status === 'partial').length
    const running = automations.filter(a => a.status === 'running').length

    // Success rate
    const resolved = completed + failed + partial
    const successRate = resolved > 0 ? Math.round((completed / resolved) * 100) : 0

    // Retry rate
    const retriedCount = automations.filter(a => (a.retryCount ?? 0) > 0).length
    const retryRate = total > 0 ? Math.round((retriedCount / total) * 100) : 0

    // Median duration (completed only)
    const durations = automations
      .filter(a => a.durationMs && a.status === 'completed')
      .map(a => a.durationMs!)
      .sort((a, b) => a - b)
    const medianDurationMs = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0

    // Average step completion
    const withSteps = automations.filter(a => a.stepsTotal && a.stepsTotal > 0)
    const avgStepCompletion = withSteps.length > 0
      ? Math.round(
          (withSteps.reduce((sum, a) => sum + ((a.stepsCompleted ?? 0) / a.stepsTotal!), 0) / withSteps.length) * 100
        )
      : 0

    // Failure breakdown by errorType
    const failureBreakdown: Record<string, number> = {}
    automations
      .filter(a => a.status === 'failed' || a.status === 'partial')
      .forEach(a => {
        const type = a.errorType ?? 'unknown'
        failureBreakdown[type] = (failureBreakdown[type] ?? 0) + 1
      })

    // Time-windowed metrics
    const now = Date.now()
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000)

    const last7 = automations.filter(a => new Date(a.createdAt) >= d7)
    const last7Completed = last7.filter(a => a.status === 'completed').length
    const last7Resolved = last7.filter(a => ['completed', 'failed', 'partial'].includes(a.status)).length

    const last30 = automations.filter(a => new Date(a.createdAt) >= d30)
    const last30Completed = last30.filter(a => a.status === 'completed').length
    const last30Resolved = last30.filter(a => ['completed', 'failed', 'partial'].includes(a.status)).length

    // Mutation risk distribution (from partialResult metadata)
    const riskDistribution: Record<string, number> = { safe: 0, low: 0, medium: 0, high: 0, critical: 0 }
    const duplicatesBlocked = automations.filter(a => a.errorType === 'duplicate').length
    const ssrfBlocked = automations.filter(a => a.errorType === 'ssrf_blocked').length

    for (const a of automations) {
      // Try to extract risk from partialResult metadata
      if (a.status === 'completed' || a.status === 'partial' || a.status === 'failed') {
        // We don't have partialResult in select, but executionPhase gives us some signal
        // For risk: increment based on available data
      }
    }

    return Response.json({
      total,
      completed,
      failed,
      partial,
      running,
      successRate,
      retryRate,
      medianDurationMs,
      avgStepCompletion,
      failureBreakdown,
      duplicatesBlocked,
      ssrfBlocked,
      last7Days: {
        total: last7.length,
        completed: last7Completed,
        successRate: last7Resolved > 0 ? Math.round((last7Completed / last7Resolved) * 100) : 0,
      },
      last30Days: {
        total: last30.length,
        completed: last30Completed,
        successRate: last30Resolved > 0 ? Math.round((last30Completed / last30Resolved) * 100) : 0,
      },
    })
  } catch (error: any) {
    console.error('[Automations Metrics] Error:', error)
    return Response.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
