export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processFeedback } from '@/lib/cortex'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, targetType, targetId } = body

    if (!type || !targetType || !targetId) {
      return NextResponse.json({ error: 'Missing required fields: type, targetType, targetId' }, { status: 400 })
    }

    if (!['accept', 'reject', 'suppress', 'incorrect'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    const success = await processFeedback({
      userId: session.user.id,
      type,
      targetType,
      targetId,
    })

    if (!success) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Cortex] Feedback error:', error)
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 })
  }
}
