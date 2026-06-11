export const dynamic = 'force-dynamic'

import { resolveAuth } from '@/lib/wearable-auth'
import { startTrace, annotate, endTrace } from '@/lib/telemetry'

/**
 * Speech-to-Text endpoint for wearable voice pipeline.
 *
 * Accepts raw audio (PCM, WAV, WebM, MP3) and returns
 * transcribed text. Designed for the glasses → Android → SETH
 * pipeline where on-device wake detection triggers capture
 * and forwards audio here for transcription.
 *
 * Uses OpenAI Whisper via the configured LLM API for
 * privacy-aligned speech recognition.
 */
export async function POST(request: Request) {
  const trace = startTrace('transcribe', 'transcribe.stt')
  try {
    const auth = await resolveAuth(request)
    if (!auth) {
      endTrace(trace, 'error')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    trace.userId = auth.userId
    trace.authMethod = auth.source

    const contentType = request.headers.get('content-type') || ''

    let audioBlob: Blob
    let filename = 'audio.wav'

    if (contentType.includes('multipart/form-data')) {
      // Standard form upload
      const formData = await request.formData()
      const file = formData.get('audio') as File | null
      if (!file) {
        return new Response(JSON.stringify({ error: 'Audio file required (field: audio)' }), { status: 400 })
      }
      audioBlob = file
      filename = file.name || 'audio.wav'
    } else if (
      contentType.includes('audio/') ||
      contentType.includes('application/octet-stream')
    ) {
      // Raw binary upload (wearable pipeline)
      const buffer = await request.arrayBuffer()
      if (buffer.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'Empty audio payload' }), { status: 400 })
      }

      // Determine file extension from content type
      if (contentType.includes('audio/pcm') || contentType.includes('octet-stream')) {
        // Raw PCM — wrap in WAV header for Whisper compatibility
        const wavBuffer = wrapPcmInWav(new Uint8Array(buffer), 16000, 1, 16)
        audioBlob = new Blob([wavBuffer], { type: 'audio/wav' })
        filename = 'audio.wav'
      } else if (contentType.includes('audio/webm')) {
        audioBlob = new Blob([buffer], { type: 'audio/webm' })
        filename = 'audio.webm'
      } else if (contentType.includes('audio/mp3') || contentType.includes('audio/mpeg')) {
        audioBlob = new Blob([buffer], { type: 'audio/mp3' })
        filename = 'audio.mp3'
      } else {
        audioBlob = new Blob([buffer], { type: 'audio/wav' })
        filename = 'audio.wav'
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported content type. Send multipart/form-data or raw audio.' }),
        { status: 400 }
      )
    }

    // Use OpenAI-compatible Whisper API via Abacus
    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Transcription service not configured' }), { status: 500 })
    }

    const formData = new FormData()
    formData.append('file', audioBlob, filename)
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'json')

    const whisperResponse = await fetch('https://llmapis.abacus.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text().catch(() => '')
      console.error('[Transcribe] Whisper API error:', whisperResponse.status, errText)
      annotate(trace, { error: `Whisper ${whisperResponse.status}`, detail: errText.slice(0, 200) })
      endTrace(trace, 'error')
      return new Response(
        JSON.stringify({ error: 'Transcription failed', detail: errText.slice(0, 200) }),
        { status: 502 }
      )
    }

    const result = await whisperResponse.json()

    annotate(trace, {
      inputFormat: filename.split('.').pop(),
      transcribedLength: (result.text || '').length,
    })
    endTrace(trace, 'ok')

    return new Response(
      JSON.stringify({
        text: result.text || '',
        source: auth.source,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('[Transcribe] Error:', error)
    annotate(trace, { error: error?.message })
    endTrace(trace, 'error')
    return new Response(JSON.stringify({ error: 'Transcription request failed' }), { status: 500 })
  }
}

/**
 * Wraps raw PCM bytes in a WAV header.
 * Required because Whisper expects a container format, not raw samples.
 */
function wrapPcmInWav(
  pcmData: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt subchunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // subchunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data subchunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM data
  const output = new Uint8Array(buffer)
  output.set(pcmData, headerSize)

  return buffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
