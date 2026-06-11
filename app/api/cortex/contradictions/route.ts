export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { detectContradictions, resolveContradiction } from '@/lib/cortex'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'active'

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status !== 'all') {
      where.status = status
    }

    const contradictions = await prisma.cortexContradiction.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
      take: 50,
    })

    return NextResponse.json({ contradictions })
  } catch (error) {
    console.error('[Cortex] Contradictions error:', error)
    return NextResponse.json({ error: 'Failed to fetch contradictions' }, { status: 500 })
  }
}

// POST: run contradiction detection OR resolve a contradiction
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // If resolving a contradiction
    if (body.action === 'resolve' || body.action === 'dismiss') {
      if (!body.contradictionId) {
        return NextResponse.json({ error: 'Missing contradictionId' }, { status: 400 })
      }
      const success = await resolveContradiction(
        session.user.id,
        body.contradictionId,
        body.action,
        body.resolution
      )
      return NextResponse.json({ success })
    }

    // Default: run detection
    const newContradictions = await detectContradictions(session.user.id)
    return NextResponse.json({ success: true, newContradictions })
  } catch (error) {
    console.error('[Cortex] Contradiction action error:', error)
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 })
  }
}
