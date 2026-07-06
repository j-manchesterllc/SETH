export const dynamic = 'force-dynamic'
export const revalidate = 0
import { resolveAuth } from '@/lib/wearable-auth'
import { startTrace, annotate, endTrace } from '@/lib/telemetry'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const SETH_VOICE_ID = 'jvnRPPEhKLJSl2Q1K81u'
const MODEL_ID = 'eleven_turbo_v2_5'

/**
 * Supported output formats:
 *   - audio/mpeg (default, browser/PWA)
 *   - audio/pcm  (wearable direct pipeline — 16kHz mono PCM)
 *
 * The `format` query param or `Accept` header controls output.
 * When format=pcm, ElevenLabs streams raw pcm_16000 bytes
 * directly — no transcoding, no MP3 decode overhead.
 */
export async function POST(request: Request) {
  const trace = startTrace('tts', 'tts.synthesize')
  try {
    const auth = await resolveAuth(request)
    if (!auth) {
      endTrace(trace, 'error')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    trace.userId = auth.userId
    trace.authMethod = auth.source

    const body = await request.json()
    const { text, format: bodyFormat } = body ?? {}

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Voice synthesis not configured' }), { status: 500 })
    }

    // Resolve output format: explicit body param > Accept header > default mpeg
    const acceptHeader = request.headers.get('accept') || ''
    const wantsPcm = bodyFormat === 'pcm' || acceptHeader.includes('audio/pcm')

    // Truncate at sentence boundary
    let trimmedText = text
    if (trimmedText.length > 4500) {
      trimmedText = trimmedText.slice(0, 4500)
      const lastSentenceEnd = Math.max(
        trimmedText.lastIndexOf('. '),
        trimmedText.lastIndexOf('! '),
        trimmedText.lastIndexOf('? '),
        trimmedText.lastIndexOf('.\n'),
      )
      if (lastSentenceEnd > 2000) {
        trimmedText = trimmedText.slice(0, lastSentenceEnd + 1)
      }
    }

    // ElevenLabs output_format parameter
    // pcm_16000 = raw 16-bit signed LE PCM at 16kHz mono
    // mp3_44100_128 = standard MP3
    const outputFormat = wantsPcm ? 'pcm_16000' : 'mp3_44100_128'

    const response = await fetch(
      `${ELEVENLABS_API_URL}/${SETH_VOICE_ID}?output_format=${outputFormat}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': wantsPcm ? 'audio/pcm' : 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('[TTS] ElevenLabs error:', response.status, errorText)
      annotate(trace, { error: `ElevenLabs ${response.status}`, detail: errorText.slice(0, 200) })
      endTrace(trace, 'error')
      return new Response(JSON.stringify({ error: 'Voice synthesis failed' }), { status: 502 })
    }

    // Stream the response directly — no buffering
    // For PCM: raw bytes flow straight to wearable playback
    // For MP3: standard browser audio pipeline
    const audioBuffer = await response.arrayBuffer()

    annotate(trace, {
      format: wantsPcm ? 'pcm_16000' : 'mp3',
      textLength: trimmedText.length,
      audioBytes: audioBuffer.byteLength,
    })
    endTrace(trace, 'ok')

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': wantsPcm ? 'audio/pcm' : 'audio/mpeg',
        'X-Audio-Format': wantsPcm ? 'pcm_16000_mono_16bit' : 'mp3_44100_128',
        'X-Sample-Rate': wantsPcm ? '16000' : '44100',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('[TTS] Error:', error)
    annotate(trace, { error: error?.message })
    endTrace(trace, 'error')
    return new Response(JSON.stringify({ error: 'Voice synthesis request failed' }), { status: 500 })
  }
}
