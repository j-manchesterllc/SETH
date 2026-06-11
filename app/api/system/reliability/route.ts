export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReliabilityMetrics } from '@/lib/reliability'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const hours = Math.min(parseInt(searchParams.get('hours') || '24', 10), 720) // max 30d

    const metrics = await getReliabilityMetrics((session.user as any).id, hours)
    return Response.json(metrics)
  } catch (error: any) {
    console.error('[Reliability API] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch reliability metrics' }), { status: 500 })
  }
}
