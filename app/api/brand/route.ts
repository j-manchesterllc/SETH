export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: List brand profiles for the user
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const profiles = await prisma.brandProfile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { audits: true } },
        audits: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    return Response.json(profiles)
  } catch (err: any) {
    console.error('[Brand GET]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// POST: Create a new brand profile
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const {
      brandName, tagline, mission, vision,
      voiceTone, targetAudience, competitors,
      visualIdentity, contentPillars, brandValues, positioning,
    } = body

    if (!brandName) {
      return new Response(JSON.stringify({ error: 'brandName is required' }), { status: 400 })
    }

    // Safely stringify JSON fields — prevent double-serialization.
    // If value is already a string, validate it parses as JSON and store as-is.
    // If value is an object, stringify once. Never stringify a string.
    const safeJsonField = (val: unknown): string | undefined => {
      if (val === undefined || val === null) return undefined
      if (typeof val === 'string') {
        // Already a string — validate it's valid JSON, store as-is
        try { JSON.parse(val); return val } catch { return JSON.stringify(val) }
      }
      return JSON.stringify(val)
    }

    const profile = await prisma.brandProfile.create({
      data: {
        userId,
        brandName,
        tagline,
        mission,
        vision,
        voiceTone: safeJsonField(voiceTone),
        targetAudience: safeJsonField(targetAudience),
        competitors: safeJsonField(competitors),
        visualIdentity: safeJsonField(visualIdentity),
        contentPillars: safeJsonField(contentPillars),
        brandValues: safeJsonField(brandValues),
        positioning,
      },
    })

    return Response.json(profile, { status: 201 })
  } catch (err: any) {
    console.error('[Brand POST]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// PUT: Update a brand profile
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return new Response(JSON.stringify({ error: 'Brand profile id is required' }), { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.brandProfile.findFirst({ where: { id, userId } })
    if (!existing) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    // Safely stringify JSON fields — prevent double-serialization
    const safeJsonField = (val: unknown): string | undefined => {
      if (val === undefined || val === null) return undefined
      if (typeof val === 'string') {
        try { JSON.parse(val); return val } catch { return JSON.stringify(val) }
      }
      return JSON.stringify(val)
    }
    const data: Record<string, any> = {}
    const jsonFields = ['voiceTone', 'targetAudience', 'competitors', 'visualIdentity', 'contentPillars', 'brandValues']
    for (const [key, value] of Object.entries(updates)) {
      if (jsonFields.includes(key)) {
        data[key] = safeJsonField(value)
      } else {
        data[key] = value
      }
    }

    const updated = await prisma.brandProfile.update({ where: { id }, data })
    return Response.json(updated)
  } catch (err: any) {
    console.error('[Brand PUT]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// DELETE: Remove a brand profile
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    const existing = await prisma.brandProfile.findFirst({ where: { id, userId } })
    if (!existing) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    await prisma.brandProfile.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err: any) {
    console.error('[Brand DELETE]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
