export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runMemoryDecay, reinforceMemory } from '@/lib/cortex'

// POST: run decay pass or reinforce/pin a memory
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Pin/unpin a memory
    if (body.action === 'pin' || body.action === 'unpin') {
      if (!body.memoryId) {
        return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 })
      }
      const memory = await prisma.memory.findFirst({
        where: { id: body.memoryId, userId: session.user.id },
      })
      if (!memory) {
        return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
      }
      await prisma.memory.update({
        where: { id: body.memoryId },
        data: { pinned: body.action === 'pin', strength: body.action === 'pin' ? 1.0 : memory.strength },
      })
      return NextResponse.json({ success: true })
    }

    // Reinforce a memory
    if (body.action === 'reinforce') {
      if (!body.memoryId) {
        return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 })
      }
      await reinforceMemory(body.memoryId)
      return NextResponse.json({ success: true })
    }

    // Default: run decay pass
    const result = await runMemoryDecay(session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Cortex] Decay action error:', error)
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 })
  }
}
