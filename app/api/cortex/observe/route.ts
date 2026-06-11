export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { recordObservation } from '@/lib/cortex'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { source, category, event, metadata, outcome, confidence, importance } = body

    if (!source || !category || !event) {
      return NextResponse.json({ error: 'Missing required fields: source, category, event' }, { status: 400 })
    }

    const observation = await recordObservation({
      userId: session.user.id,
      source,
      category,
      event,
      metadata,
      outcome,
      confidence,
      importance,
    })

    if (!observation) {
      return NextResponse.json({ error: 'Failed to record observation' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: observation.id })
  } catch (error) {
    console.error('[Cortex] Observe error:', error)
    return NextResponse.json({ error: 'Failed to record observation' }, { status: 500 })
  }
}
