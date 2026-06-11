export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: { agentId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const agent = await prisma.agent.findFirst({
      where: { id: params.agentId, userId },
    })
    if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404 })

    const body = await request.json()
    const allowedFields = ['monitorEnabled', 'monitorQuery', 'monitorInterval', 'status', 'name', 'description', 'systemPrompt']
    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), { status: 400 })
    }

    const updated = await prisma.agent.update({
      where: { id: params.agentId },
      data: updateData,
    })

    return Response.json(updated)
  } catch (err: any) {
    console.error('[Agent PATCH]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
