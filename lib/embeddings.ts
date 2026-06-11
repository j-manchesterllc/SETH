/**
 * Application-Level Vector Embeddings
 * 
 * Generates fixed-dimensional float vectors from text using the LLM API,
 * then computes cosine similarity in application code for semantic search.
 * 
 * This replaces pgvector — all vector operations happen in the Node.js runtime.
 * Embedding dimension: 64 (compact enough for JSON storage, rich enough for semantic discrimination)
 */

import {
  routeForBackground,
  buildHeaders,
  buildRequestBody,
  getBackgroundFallback,
  type ModelConfig,
} from '@/lib/model-router'

const EMBEDDING_DIM = 64
const EMBEDDING_MODEL_TAG = 'llm-v1-d64'

// ─── Embedding Generation ────────────────────────────────────────────────

/**
 * Generate a fixed-dimensional embedding vector from text using the LLM API.
 * Returns a normalized float array of length EMBEDDING_DIM, or null on failure.
 * 
 * Strategy: Ask the LLM to project the text's semantic meaning into a numeric vector.
 * The prompt is carefully engineered to produce consistent, discriminative embeddings.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) return null

  const truncated = text.slice(0, 1500) // keep input manageable

  const systemPrompt = `You are an embedding encoder. Given input text, output ONLY a JSON array of exactly ${EMBEDDING_DIM} floating-point numbers between -1.0 and 1.0 that represent the semantic meaning of the text. Each dimension should capture a different aspect of meaning (topic, sentiment, urgency, domain, specificity, abstraction level, etc.). Texts with similar meanings should produce similar vectors. Output nothing but the JSON array.`

  const userPrompt = `Encode this text as a ${EMBEDDING_DIM}-dimensional semantic vector:\n\n"${truncated}"`

  let config: ModelConfig = routeForBackground()

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const headers = buildHeaders(config)
      const body = buildRequestBody(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { maxTokens: 800 })

      // Override temperature for deterministic embeddings
      body.temperature = 0

      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const fallback = getBackgroundFallback(config.model)
        if (fallback && attempt === 0) {
          config = fallback
          continue
        }
        return null
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content || ''

      // Extract the JSON array from the response
      const match = raw.match(/\[([\s\S]*?)\]/)
      if (!match) return null

      const parsed = JSON.parse(`[${match[1]}]`)
      if (!Array.isArray(parsed) || parsed.length < EMBEDDING_DIM / 2) return null

      // Normalize to exactly EMBEDDING_DIM dimensions
      const vec = parsed.slice(0, EMBEDDING_DIM).map((v: any) => {
        const n = Number(v)
        return isNaN(n) ? 0 : Math.max(-1, Math.min(1, n))
      })

      // Pad if shorter
      while (vec.length < EMBEDDING_DIM) vec.push(0)

      // L2 normalize
      return l2Normalize(vec)
    } catch {
      const fallback = getBackgroundFallback(config.model)
      if (fallback && attempt === 0) {
        config = fallback
        continue
      }
      return null
    }
  }

  return null
}

// ─── Vector Math ─────────────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors. Returns 0-1 (clamped).
 * Assumes inputs are L2-normalized (dot product = cosine similarity).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }
  // Clamp to [0, 1] — negative similarity treated as 0 for ranking
  return Math.max(0, Math.min(1, dot))
}

/**
 * L2 (unit) normalization of a vector.
 */
export function l2Normalize(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}

/**
 * Parse a stored embedding from JSON string.
 */
export function parseEmbedding(stored: string | null): number[] | null {
  if (!stored) return null
  try {
    const arr = JSON.parse(stored)
    if (Array.isArray(arr) && arr.length === EMBEDDING_DIM) return arr
    return null
  } catch {
    return null
  }
}

/**
 * Serialize an embedding for database storage.
 */
export function serializeEmbedding(vec: number[]): string {
  return JSON.stringify(vec.map(v => Math.round(v * 1e6) / 1e6)) // 6 decimal places
}

export { EMBEDDING_DIM, EMBEDDING_MODEL_TAG }