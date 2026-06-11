export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRelationshipGraph, processTextForEntities } from '@/lib/cortex'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const graph = await getRelationshipGraph(session.user.id)
    return NextResponse.json(graph)
  } catch (error) {
    console.error('[Cortex] Relationships error:', error)
    return NextResponse.json({ error: 'Failed to fetch relationships' }, { status: 500 })
  }
}

// POST: Manually trigger entity extraction from text
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { text, source } = await req.json()
    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 })

    await processTextForEntities(session.user.id, text, source || 'manual')
    const graph = await getRelationshipGraph(session.user.id)
    return NextResponse.json({ success: true, graph })
  } catch (error) {
    console.error('[Cortex] Entity extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract entities' }, { status: 500 })
  }
}
