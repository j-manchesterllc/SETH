export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_AGENTS } from '@/lib/agents'

// GET: List all agents for the user (auto-seed defaults if none exist)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    // Verify user exists in DB before attempting agent operations
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!userExists) {
      return new Response(JSON.stringify({ error: 'User not found — please sign out and sign in again' }), { status: 401 })
    }

    // Auto-seed default agents if user has none
    const count = await prisma.agent.count({ where: { userId } })
    if (count === 0) {
      try {
        await prisma.agent.createMany({
          data: DEFAULT_AGENTS.map(a => ({
            userId,
            name: a.name,
            codename: a.codename,
            role: a.role,
            description: a.description,
            systemPrompt: a.systemPrompt,
            capabilities: JSON.stringify(a.capabilities),
            tier: a.tier,
            avatar: a.avatar,
          })),
        })
      } catch (seedErr: any) {
        console.error('[Agents] Auto-seed failed:', seedErr.message)
      }
    }

    const agents = await prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { dispatches: true } },
      },
    })

    return Response.json(agents)
  } catch (err: any) {
    console.error('[Agents GET]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// POST: Create a custom agent
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { name, codename, role, description, systemPrompt, capabilities, tier, avatar } = body

    if (!name || !codename || !role || !description || !systemPrompt) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const agent = await prisma.agent.create({
      data: {
        userId,
        name,
        codename: codename.toLowerCase().replace(/\s+/g, '-'),
        role,
        description,
        systemPrompt,
        capabilities: capabilities ? JSON.stringify(capabilities) : undefined,
        tier: tier || 'free',
        avatar: avatar || '⚡',
      },
    })

    return Response.json(agent, { status: 201 })
  } catch (err: any) {
    console.error('[Agents POST]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
