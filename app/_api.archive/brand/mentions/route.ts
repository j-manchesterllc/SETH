export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: List brand mentions for a brand profile
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')
    if (!brandProfileId) return new Response(JSON.stringify({ error: 'brandProfileId required' }), { status: 400 })

    const profile = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!profile) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    const sentiment = searchParams.get('sentiment')
    const mentions = await prisma.brandMention.findMany({
      where: {
        brandProfileId,
        ...(sentiment && sentiment !== 'all' ? { sentiment } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    })

    return Response.json(mentions)
  } catch (err: any) {
    console.error('[Brand Mentions GET]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// POST: Scan for mentions using LLM (simulated — in production would integrate with social listening APIs)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { brandProfileId } = body
    if (!brandProfileId) return new Response(JSON.stringify({ error: 'brandProfileId required' }), { status: 400 })

    const profile = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!profile) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    // Use LLM to generate realistic simulated mentions for the brand
    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) return new Response(JSON.stringify({ error: 'LLM API not configured' }), { status: 500 })

    const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [{
          role: 'user',
          content: `You are a brand monitoring intelligence tool. Generate 5 realistic brand mentions for "${profile.brandName}"${profile.tagline ? ` (${profile.tagline})` : ''}. Include a mix of sentiments (positive, neutral, negative). Each mention should have: platform (twitter/linkedin/reddit/news/blog), source (author or publication name), content (the mention text, 1-3 sentences), sentiment (positive/neutral/negative), reach (estimated audience number 100-500000).

Return as JSON: { "mentions": [{ "platform": "", "source": "", "content": "", "sentiment": "", "reach": 0 }] }
Respond with raw JSON only.`
        }],
        max_tokens: 800,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) return new Response(JSON.stringify({ error: 'LLM scan failed' }), { status: 500 })

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    let mentions: any[] = []
    try {
      const parsed = JSON.parse(raw)
      mentions = parsed.mentions || parsed
    } catch { return new Response(JSON.stringify({ error: 'Failed to parse scan results' }), { status: 500 }) }

    // Store mentions
    const created = []
    for (const m of mentions) {
      const mention = await prisma.brandMention.create({
        data: {
          brandProfileId,
          platform: m.platform || 'twitter',
          source: m.source || 'Unknown',
          sourceUrl: m.sourceUrl || null,
          content: m.content || '',
          sentiment: m.sentiment || 'neutral',
          reach: m.reach || null,
        },
      })
      created.push(mention)
    }

    return Response.json({ scanned: created.length, mentions: created })
  } catch (err: any) {
    console.error('[Brand Mentions POST]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// PUT: Mark mention as reviewed
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { id, isReviewed } = body
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    const mention = await prisma.brandMention.findUnique({
      where: { id },
      include: { brandProfile: { select: { userId: true } } },
    })
    if (!mention || mention.brandProfile.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const updated = await prisma.brandMention.update({
      where: { id },
      data: { isReviewed: isReviewed ?? true },
    })

    return Response.json(updated)
  } catch (err: any) {
    console.error('[Brand Mentions PUT]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
