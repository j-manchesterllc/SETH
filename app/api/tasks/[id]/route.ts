export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordObservation } from '@/lib/cortex'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const body = await request.json()

    const existing = await prisma.task.findFirst({
      where: { id: params.id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        title: body?.title ?? existing.title,
        description: body?.description !== undefined ? body.description : existing.description,
        status: body?.status ?? existing.status,
        autonomyLevel: body?.autonomyLevel ?? existing.autonomyLevel,
        priority: body?.priority ?? existing.priority,
        dueDate: body?.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : existing.dueDate,
      },
    })

    // Cortex observation for status transitions (fire-and-forget)
    if (body?.status && body.status !== existing.status) {
      const isCompletion = body.status === 'completed'
      recordObservation({
        userId,
        source: 'task',
        category: 'execution',
        event: `Task ${body.status}: ${task.title}`,
        metadata: {
          taskId: task.id,
          fromStatus: existing.status,
          toStatus: body.status,
          priority: task.priority,
          hadDueDate: !!task.dueDate,
        },
        outcome: isCompletion ? 'positive' : 'neutral',
        confidence: 0.85,
        importance: isCompletion ? 7 : 5,
      }).catch(() => {})
    }

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Task update error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    await prisma.task.deleteMany({
      where: { id: params.id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Task delete error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
