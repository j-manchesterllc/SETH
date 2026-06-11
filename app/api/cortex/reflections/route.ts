export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReflection } from '@/lib/cortex'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    const where: Record<string, unknown> = { userId: session.user.id }
    if (timeframe && ['daily', 'weekly', 'monthly'].includes(timeframe)) {
      where.timeframe = timeframe
    }

    const [reflections, total] = await Promise.all([
      prisma.cortexReflection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cortexReflection.count({ where }),
    ])

    // Parse JSON fields
    const parsed = reflections.map(r => ({
      ...r,
      wins: safeJsonParse(r.wins),
      bottlenecks: safeJsonParse(r.bottlenecks),
      recurringThemes: safeJsonParse(r.recurringThemes),
      optimizationSuggestions: safeJsonParse(r.optimizationSuggestions),
    }))

    return NextResponse.json({ reflections: parsed, total, page, limit })
  } catch (error) {
    console.error('[Cortex] Reflections error:', error)
    return NextResponse.json({ error: 'Failed to fetch reflections' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const timeframe = body.timeframe || 'weekly'

    const success = await generateReflection(session.user.id, timeframe)
    if (!success) {
      return NextResponse.json({ error: 'Insufficient data for reflection' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Cortex] Generate reflection error:', error)
    return NextResponse.json({ error: 'Failed to generate reflection' }, { status: 500 })
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
