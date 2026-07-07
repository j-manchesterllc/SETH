export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runVoiceCheck, runCompetitorScan, generateContentStrategy, runStrategicAlignment } from '@/lib/brand-manager'

// POST: Run a brand audit
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { brandProfileId, type, input } = body

    if (!brandProfileId || !type) {
      return new Response(JSON.stringify({ error: 'brandProfileId and type are required' }), { status: 400 })
    }

    // Verify ownership
    const brand = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!brand) return new Response(JSON.stringify({ error: 'Brand profile not found' }), { status: 404 })

    let result
    switch (type) {
      case 'voice_check':
        if (!input) return new Response(JSON.stringify({ error: 'Content input required for voice check' }), { status: 400 })
        result = await runVoiceCheck(brandProfileId, userId, input, request)
        break
      case 'competitor_scan':
        result = await runCompetitorScan(brandProfileId, userId, input, request)
        break
      case 'content_review':
        result = await generateContentStrategy(brandProfileId, userId, request)
        break
      case 'strategic_alignment':
        result = await runStrategicAlignment(brandProfileId, userId, request)
        break
      default:
        return new Response(JSON.stringify({ error: 'Invalid audit type' }), { status: 400 })
    }

    return Response.json(result)
  } catch (err: any) {
    console.error('[Brand Audit]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// GET: List audits for a brand profile
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return new Response(JSON.stringify({ error: 'brandProfileId required' }), { status: 400 })
    }

    // Verify ownership
    const brand = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!brand) return new Response(JSON.stringify({ error: 'Brand profile not found' }), { status: 404 })

    const audits = await prisma.brandAudit.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return Response.json(audits)
  } catch (err: any) {
    console.error('[Brand Audit GET]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
