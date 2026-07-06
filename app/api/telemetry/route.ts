export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTelemetrySummary, getTraceDetail } from '@/lib/telemetry'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const traceId = searchParams.get('traceId')
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    // Single trace detail
    if (traceId) {
      const detail = await getTraceDetail(traceId)
      if (!detail) {
        return new Response(JSON.stringify({ error: 'Trace not found' }), { status: 404 })
      }
      return Response.json(detail)
    }

    // Summary view
    const summary = await getTelemetrySummary(Math.min(hours, 168)) // max 7 days
    return Response.json(summary)
  } catch (error: any) {
    console.error('[Telemetry API] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch telemetry' }), { status: 500 })
  }
}
