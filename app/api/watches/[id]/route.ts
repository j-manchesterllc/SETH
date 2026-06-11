export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const body = await request.json()

    const watch = await prisma.watch.updateMany({
      where: { id: params.id, userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.query !== undefined && { query: body.query }),
        ...(body.threshold !== undefined && { threshold: body.threshold }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
        ...(body.active !== undefined && { active: body.active }),
      },
    })

    if (watch.count === 0) {
      return Response.json({ error: 'Watch not found' }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('Update watch error:', error)
    return Response.json({ error: 'Failed to update watch' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const result = await prisma.watch.deleteMany({
      where: { id: params.id, userId },
    })

    if (result.count === 0) {
      return Response.json({ error: 'Watch not found' }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('Delete watch error:', error)
    return Response.json({ error: 'Failed to delete watch' }, { status: 500 })
  }
}
