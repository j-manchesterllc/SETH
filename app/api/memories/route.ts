export const dynamic = 'force-dynamic'

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
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const where: any = { userId }
    if (type && type !== 'all') where.type = type
    if (search) {
      const q = search.toLowerCase()
      where.OR = [
        { content: { contains: q } },
        { tags: { contains: q } },
      ]
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(memories ?? [])
  } catch (error: any) {
    console.error('Memories fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
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

    const memory = await prisma.memory.create({
      data: {
        userId,
        type: body?.type ?? 'note',
        content: body?.content ?? '',
        importance: body?.importance ?? 5,
        tags: body?.tags ? body.tags.toLowerCase() : null,
      },
    })

    // Generate semantic tags + vector embedding asynchronously (fire-and-forget)
    import('@/lib/cortex').then(({ enrichMemoryAsync }) => {
      enrichMemoryAsync(memory.id, memory.content).catch(() => {})
    }).catch(() => {})

    // Cortex observation (fire-and-forget)
    import('@/lib/cortex').then(({ recordObservation, processTextForEntities, autoLinkProjects }) => {
      recordObservation({
        userId,
        source: 'memory',
        category: 'decision',
        event: `Memory created [${body?.type ?? 'note'}]: ${(body?.content ?? '').slice(0, 100)}`,
        metadata: { memoryId: memory.id, type: body?.type, importance: body?.importance },
        outcome: 'positive',
        confidence: 0.8,
        importance: body?.importance ?? 5,
      }).catch(() => {})
      // Entity extraction + project auto-linking
      processTextForEntities(userId, body?.content ?? '', 'memory').catch(() => {})
      autoLinkProjects(userId, body?.content ?? '', 'memory', memory.id).catch(() => {})
    }).catch(() => {})

    return NextResponse.json(memory)
  } catch (error: any) {
    console.error('Memory create error:', error)
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 })
  }
}
