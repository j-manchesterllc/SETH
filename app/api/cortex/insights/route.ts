export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateInsights } from '@/lib/cortex'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const insights = await prisma.cortexInsight.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json(insights)
  } catch (error) {
    console.error('[Cortex] Insights error:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

// POST: Trigger insight generation
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const newInsights = await generateInsights(session.user.id)
    return NextResponse.json({ success: true, newInsights })
  } catch (error) {
    console.error('[Cortex] Insight generation error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

// PUT: Acknowledge or dismiss insight
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { insightId, action } = await req.json()
    if (!insightId || !action) return NextResponse.json({ error: 'insightId and action required' }, { status: 400 })

    await prisma.cortexInsight.update({
      where: { id: insightId },
      data: { status: action === 'dismiss' ? 'dismissed' : 'acknowledged' },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Cortex] Insight update error:', error)
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
  }
}
