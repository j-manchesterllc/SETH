export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MODULE_ENVIRONMENTS } from '@/lib/environment-config'

const SKYBOX_API = 'https://backend.blockadelabs.com/api/v1'

// Style map (mirrors skybox route)
const SETH_STYLES: Record<string, number> = {
  'command-center': 93,
  'above-clouds': 77,
  'neo-tokyo': 90,
  'cinematic': 102,
  'photoreal': 67,
  'digital-art': 87,
  'fantasy': 139,
  'retro-future': 88,
  'surreal': 141,
  'utopia': 144,
  'dystopia': 146,
  'concept-render': 148,
}

// POST: Generate environment for a module or decision thread
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const apiKey = process.env.SKYBOX_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Skybox API not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { type, module, conversationId, prompt: customPrompt, style: customStyle } = body

    let prompt: string
    let styleId: number

    if (type === 'module') {
      // Pre-generate a module environment
      const env = MODULE_ENVIRONMENTS.find(e => e.module === module)
      if (!env) return Response.json({ error: 'Unknown module' }, { status: 400 })
      prompt = env.prompt
      styleId = SETH_STYLES[env.style] ?? SETH_STYLES['command-center']
    } else if (type === 'decision') {
      // Generate for a specific conversation/decision thread
      if (!customPrompt) return Response.json({ error: 'Prompt required for decision environments' }, { status: 400 })
      prompt = customPrompt.slice(0, 380)
      styleId = SETH_STYLES[customStyle ?? 'cinematic'] ?? SETH_STYLES['cinematic']
    } else {
      return Response.json({ error: 'type must be "module" or "decision"' }, { status: 400 })
    }

    // Generate via Blockade Labs
    const genRes = await fetch(`${SKYBOX_API}/skybox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        prompt,
        skybox_style_id: styleId,
        enhance_prompt: true,
      }),
    })

    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => '')
      console.error('[Env Gen] Skybox error:', genRes.status, errText)
      return Response.json({ error: 'Generation failed' }, { status: genRes.status })
    }

    const genData = await genRes.json()
    const skyboxId = genData?.id

    if (!skyboxId) {
      return Response.json({ error: 'Failed to start generation' }, { status: 500 })
    }

    // If already complete (rare), return immediately
    if (genData?.status === 'complete' && genData?.file_url) {
      if (type === 'decision' && conversationId) {
        const userId = (session.user as any)?.id as string
        await prisma.conversation.updateMany({
          where: { id: conversationId, userId },
          data: { environmentUrl: genData.file_url, environmentThumb: genData.thumb_url },
        })
      }
      return Response.json({
        success: true,
        fileUrl: genData.file_url,
        thumbUrl: genData.thumb_url,
        module: type === 'module' ? module : undefined,
      })
    }

    // Return immediately with pending status — client will poll /api/skybox/status
    // This avoids server-side timeout on long-running generation (60-120s)
    return Response.json({
      pending: true,
      id: skyboxId,
      status: genData?.status ?? 'processing',
      conversationId: type === 'decision' ? conversationId : undefined,
      module: type === 'module' ? module : undefined,
    }, { status: 202 })
  } catch (error: any) {
    console.error('[Env Gen] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
