export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Returns actionable Cortex alerts for the proactive alert system:
 * - High-confidence patterns with recommendations
 * - Active contradictions
 * - Low-strength memories at risk of archival
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const [patterns, contradictions, weakMemories, activeInsights] = await Promise.all([
      // High-confidence patterns with unacted recommendations
      prisma.cortexPattern.findMany({
        where: {
          userId,
          status: 'active',
          confidence: { gte: 0.6 },
          recommendation: { not: null },
        },
        orderBy: { impactScore: 'desc' },
        take: 3,
      }),
      // Active contradictions
      prisma.cortexContradiction.findMany({
        where: { userId, status: 'active' },
        orderBy: { severity: 'desc' },
        take: 3,
      }),
      // Memories at risk of decay (low strength, not pinned)
      prisma.memory.findMany({
        where: {
          userId,
          strength: { lte: 0.2 },
          pinned: false,
          type: { not: 'archived' },
        },
        orderBy: { strength: 'asc' },
        take: 5,
      }),
      // Active insights (cognitive load, strategic drift, etc.)
      prisma.cortexInsight.findMany({
        where: { userId, status: 'active', severity: { in: ['warning', 'critical'] } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ])

    interface CortexAlert {
      type: 'pattern' | 'contradiction' | 'memory_decay' | 'insight'
      severity: 'info' | 'warning' | 'critical'
      title: string
      message: string
      targetId: string
      confidence?: number
    }

    const alerts: CortexAlert[] = []

    for (const p of patterns) {
      alerts.push({
        type: 'pattern',
        severity: p.impactScore >= 7 ? 'warning' : 'info',
        title: p.title,
        message: p.recommendation || p.description,
        targetId: p.id,
        confidence: p.confidence,
      })
    }

    for (const c of contradictions) {
      alerts.push({
        type: 'contradiction',
        severity: c.severity === 'high' ? 'critical' : c.severity === 'medium' ? 'warning' : 'info',
        title: `Contradiction: ${c.title}`,
        message: c.description,
        targetId: c.id,
        confidence: c.confidence,
      })
    }

    if (weakMemories.length > 0) {
      alerts.push({
        type: 'memory_decay',
        severity: 'info',
        title: `${weakMemories.length} memor${weakMemories.length === 1 ? 'y' : 'ies'} fading`,
        message: `Low-strength memories approaching archival: ${weakMemories.map(m => m.content.slice(0, 40)).join('; ')}`,
        targetId: 'decay',
      })
    }

    for (const insight of activeInsights) {
      alerts.push({
        type: 'insight',
        severity: insight.severity === 'critical' ? 'critical' : 'warning',
        title: insight.title,
        message: insight.description.slice(0, 200),
        targetId: insight.id,
        confidence: insight.confidence,
      })
    }

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('[Cortex] Alerts error:', error)
    return NextResponse.json({ alerts: [] })
  }
}
