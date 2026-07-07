export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const watches = await prisma.watch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ watches })
  } catch (error: any) {
    console.error('Fetch watches error:', error)
    return Response.json({ error: 'Failed to fetch watches' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const body = await request.json()
    const { name, type, query, threshold, frequency } = body ?? {}

    if (!name || !type || !query) {
      return Response.json({ error: 'Name, type, and query are required' }, { status: 400 })
    }

    const watch = await prisma.watch.create({
      data: {
        userId,
        name,
        type,
        query,
        threshold: threshold ?? null,
        frequency: frequency ?? 'daily',
      },
    })

    return Response.json({ watch })
  } catch (error: any) {
    console.error('Create watch error:', error)
    return Response.json({ error: 'Failed to create watch' }, { status: 500 })
  }
}
