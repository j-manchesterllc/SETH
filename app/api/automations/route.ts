export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/automations — list user's browser automations
 * DELETE /api/automations?id=xxx — delete a specific automation
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

    const where: any = { userId }
    if (status) where.status = status

    const automations = await prisma.browserAutomation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        taskDesc: true,
        targetUrl: true,
        status: true,
        result: true,
        partialResult: true,
        error: true,
        errorType: true,
        durationMs: true,
        retryCount: true,
        executionPhase: true,
        stepsTotal: true,
        stepsCompleted: true,
        createdAt: true,
      },
    })

    return Response.json({ automations })
  } catch (error: any) {
    console.error('[Automations] GET error:', error)
    return Response.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return Response.json({ error: 'Automation ID required' }, { status: 400 })
    }

    // Verify ownership
    const auto = await prisma.browserAutomation.findFirst({
      where: { id, userId },
    })
    if (!auto) {
      return Response.json({ error: 'Automation not found' }, { status: 404 })
    }

    await prisma.browserAutomation.delete({ where: { id } })

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('[Automations] DELETE error:', error)
    return Response.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
