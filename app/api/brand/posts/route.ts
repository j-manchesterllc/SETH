export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: List scheduled posts for a brand profile
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')
    if (!brandProfileId) return new Response(JSON.stringify({ error: 'brandProfileId required' }), { status: 400 })

    // Verify ownership
    const profile = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!profile) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    const posts = await prisma.scheduledPost.findMany({
      where: { brandProfileId },
      orderBy: { scheduledFor: 'desc' },
    })

    return Response.json(posts)
  } catch (err: any) {
    console.error('[Brand Posts GET]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// POST: Create a scheduled post
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { brandProfileId, platform, content, mediaUrl, scheduledFor, hashtags } = body

    if (!brandProfileId || !platform || !content || !scheduledFor) {
      return new Response(JSON.stringify({ error: 'brandProfileId, platform, content, and scheduledFor are required' }), { status: 400 })
    }

    // Verify ownership
    const profile = await prisma.brandProfile.findFirst({ where: { id: brandProfileId, userId } })
    if (!profile) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    const post = await prisma.scheduledPost.create({
      data: {
        brandProfileId,
        platform,
        content,
        mediaUrl: mediaUrl || null,
        scheduledFor: new Date(scheduledFor),
        hashtags: hashtags || null,
      },
    })

    return Response.json(post, { status: 201 })
  } catch (err: any) {
    console.error('[Brand Posts POST]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// PUT: Update a scheduled post (e.g., cancel)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    // Verify ownership via brand profile
    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: { brandProfile: { select: { userId: true } } },
    })
    if (!post || post.brandProfile.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const updated = await prisma.scheduledPost.update({
      where: { id },
      data: {
        ...(updates.content !== undefined && { content: updates.content }),
        ...(updates.platform !== undefined && { platform: updates.platform }),
        ...(updates.scheduledFor !== undefined && { scheduledFor: new Date(updates.scheduledFor) }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.hashtags !== undefined && { hashtags: updates.hashtags }),
        ...(updates.mediaUrl !== undefined && { mediaUrl: updates.mediaUrl }),
      },
    })

    return Response.json(updated)
  } catch (err: any) {
    console.error('[Brand Posts PUT]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

// DELETE: Remove a scheduled post
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const userId = (session.user as any)?.id as string

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 })

    const post = await prisma.scheduledPost.findUnique({
      where: { id },
      include: { brandProfile: { select: { userId: true } } },
    })
    if (!post || post.brandProfile.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    await prisma.scheduledPost.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (err: any) {
    console.error('[Brand Posts DELETE]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
