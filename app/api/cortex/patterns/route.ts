export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'
    const patternType = searchParams.get('type') || undefined

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status !== 'all') {
      where.status = status
    }
    if (patternType) {
      where.patternType = patternType
    }

    const patterns = await prisma.cortexPattern.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { impactScore: 'desc' }],
      take: 50,
    })

    const parsed = patterns.map(p => ({
      ...p,
      evidenceIds: safeJsonParse(p.evidenceIds),
    }))

    return NextResponse.json({ patterns: parsed })
  } catch (error) {
    console.error('[Cortex] Patterns error:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}

function safeJsonParse(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
