export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const SKYBOX_API = 'https://backend.blockadelabs.com/api/v1'

// Curated styles for Seth ambient environments
const SETH_STYLES: Record<string, number> = {
  'command-center': 93,   // M3 Scifi Concept Art
  'above-clouds': 77,     // M3 Above the Clouds
  'neo-tokyo': 90,        // M3 Neo Tokyo
  'cinematic': 102,       // M3 Cinematic Realism
  'photoreal': 67,        // M3 Photoreal
  'digital-art': 87,      // M3 Digital Painting
  'fantasy': 139,         // M3 Fantasy
  'retro-future': 88,     // M3 Retro Fantasy
  'surreal': 141,         // M3 Surreal Painting
  'utopia': 144,          // M3 Utopian Render
  'dystopia': 146,        // M3 Dystopian Render
  'concept-render': 148,  // M3 Concept Render
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  return Response.json({
    styles: Object.entries(SETH_STYLES).map(([key, id]) => ({ key, id })),
  })
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const apiKey = process.env.SKYBOX_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'Skybox API not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { prompt, style, enhance } = body ?? {}

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const styleId = SETH_STYLES[style] ?? SETH_STYLES['command-center']

    // Generate skybox
    const genRes = await fetch(`${SKYBOX_API}/skybox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 380),
        skybox_style_id: styleId,
        enhance_prompt: enhance !== false,
      }),
    })

    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => '')
      console.error('Skybox generation error:', genRes.status, errText)
      return Response.json({ error: 'Skybox generation failed' }, { status: genRes.status })
    }

    const genData = await genRes.json()
    const skyboxId = genData?.id
    const obfuscatedId = genData?.obfuscated_id

    if (!skyboxId && !obfuscatedId) {
      return Response.json({ error: 'Failed to start generation' }, { status: 500 })
    }

    // If already complete (rare), return immediately
    if (genData?.status === 'complete' && genData?.file_url) {
      return Response.json({
        success: true,
        id: genData.id,
        fileUrl: genData.file_url,
        thumbUrl: genData.thumb_url,
        depthMapUrl: genData.depth_map_url,
        prompt: genData.prompt,
        title: genData.title,
      })
    }

    // Return immediately with pending status — client will poll /api/skybox/status
    // This avoids server-side timeout on long-running generation (60-120s)
    return Response.json(
      {
        pending: true,
        id: skyboxId,
        obfuscatedId,
        status: genData?.status ?? 'processing',
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error('Skybox API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
