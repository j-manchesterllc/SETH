export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const existing = await prisma.memory.findFirst({
      where: { id: params.id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    const memory = await prisma.memory.update({
      where: { id: params.id },
      data: {
        type: body?.type ?? existing.type,
        content: body?.content ?? existing.content,
        importance: body?.importance ?? existing.importance,
        tags: body?.tags !== undefined ? body.tags : existing.tags,
      },
    })

    return NextResponse.json(memory)
  } catch (error: any) {
    console.error('Memory update error:', error)
    return NextResponse.json({ error: 'Failed to update memory' }, { status: 500 })
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

    await prisma.memory.deleteMany({
      where: { id: params.id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Memory delete error:', error)
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
