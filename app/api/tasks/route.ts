export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const autonomyLevel = searchParams.get('autonomyLevel')
    const priority = searchParams.get('priority')

    const where: any = { userId }
    if (status === 'archived') {
      where.status = 'archived'
    } else if (status && status !== 'all') {
      where.status = status
    } else {
      // Default: exclude archived
      where.status = { not: 'archived' }
    }
    if (autonomyLevel && autonomyLevel !== 'all') where.autonomyLevel = parseInt(autonomyLevel)
    if (priority && priority !== 'all') where.priority = priority

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(tasks ?? [])
  } catch (error: any) {
    console.error('Tasks fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const body = await request.json()

    const task = await prisma.task.create({
      data: {
        userId,
        title: body?.title ?? 'Untitled Task',
        description: body?.description ?? null,
        status: body?.status ?? 'pending',
        autonomyLevel: body?.autonomyLevel ?? 3,
        priority: body?.priority ?? 'medium',
        dueDate: body?.dueDate ? new Date(body.dueDate) : null,
      },
    })

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Task create error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
