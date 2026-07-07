export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SKYBOX_API = 'https://backend.blockadelabs.com/api/v1'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const apiKey = process.env.SKYBOX_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Skybox API not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const skyboxId = searchParams.get('id')
  const conversationId = searchParams.get('conversationId')

  if (!skyboxId) {
    return Response.json({ error: 'ID required' }, { status: 400 })
  }

  try {
    // Use numeric id (not obfuscated_id) for the imagine/requests endpoint
    const res = await fetch(
      `${SKYBOX_API}/imagine/requests/${skyboxId}`,
      { headers: { 'x-api-key': apiKey } }
    )

    if (!res.ok) {
      return Response.json({ error: 'Failed to check status' }, { status: res.status })
    }

    const data = await res.json()
    const result = data?.request ?? data

    // If complete and a conversationId was provided, save the environment URL to the conversation
    if (result.status === 'complete' && result.file_url && conversationId) {
      const userId = (session.user as any)?.id as string
      if (userId) {
        prisma.conversation.updateMany({
          where: { id: conversationId, userId },
          data: {
            environmentUrl: result.file_url,
            environmentThumb: result.thumb_url ?? null,
          },
        }).catch((err: any) => console.error('[Skybox Status] Failed to update conversation:', err))
      }
    }

    return Response.json({
      status: result.status,
      fileUrl: result.file_url ?? null,
      thumbUrl: result.thumb_url ?? null,
      depthMapUrl: result.depth_map_url ?? null,
      prompt: result.prompt ?? null,
    })
  } catch (error: any) {
    console.error('Skybox status error:', error)
    return Response.json({ error: 'Check failed' }, { status: 500 })
  }
}
