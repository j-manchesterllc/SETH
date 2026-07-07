import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Prevent static generation – this route must be server‑side rendered
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.agentId },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
