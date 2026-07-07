import { prisma } from '@/lib/prisma'
import {
  routeForBackground,
  getBackgroundFallback,
  buildHeaders,
  buildRequestBody,
  type ModelConfig,
} from '@/lib/model-router'

// ─── Types ─────────────────────────────────────────────────────────────

export interface ObservationInput {
  userId: string
  source: 'chat' | 'task' | 'calendar' | 'email' | 'automation' | 'agent' | 'memory'
  category: 'workflow' | 'decision' | 'habit' | 'priority' | 'communication' | 'focus' | 'execution'
  event: string
  metadata?: Record<string, unknown>
  outcome?: 'positive' | 'neutral' | 'negative'
  confidence?: number
  importance?: number
}

export interface FeedbackInput {
  userId: string
  type: 'accept' | 'reject' | 'suppress' | 'incorrect'
  targetType: 'pattern' | 'reflection'
  targetId: string
}

// ─── Observation Recording ─────────────────────────────────────────────

export async function recordObservation(input: ObservationInput) {
  try {
    return await prisma.cortexObservation.create({
      data: {
        userId: input.userId,
        source: input.source,
        category: input.category,
        event: input.event,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        outcome: input.outcome || null,
        confidence: input.confidence ?? 0.5,
        importance: input.importance ?? 5,
      },
    })
  } catch (err) {
    console.error('[Cortex] Failed to record observation:', err)
    return null
  }
}

// ─── LLM Call Helper ───────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userPrompt: string, retries = 2): Promise<string | null> {
  let config: ModelConfig = routeForBackground()
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = buildHeaders(config)
      const body = buildRequestBody(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { maxTokens: 2000 })

      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error(`LLM ${res.status}: ${await res.text().catch(() => 'unknown')}`)
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || null
    } catch (err) {
      console.error(`[Cortex] LLM attempt ${attempt + 1} failed:`, err)
      if (attempt < retries) {
        const fallback = getBackgroundFallback(config.model)
        if (fallback) config = fallback
      }
    }
  }
  return null
}

// ─── Pattern Analysis ──────────────────────────────────────────────────

const PATTERN_ANALYSIS_PROMPT = `You are Cortex, the adaptive learning engine for Seth — a strategic executive intelligence system.
Your role: analyze behavioral observations and detect actionable patterns.

Rules:
- Be concise, strategic, and actionable
- Never be judgmental or emotionally performative
- Focus on patterns that have real operational impact
- Include confidence levels (0-1) based on evidence density
- Every recommendation must include WHY and WHAT EVIDENCE supports it

Respond ONLY with valid JSON. No markdown, no explanation outside JSON.`

export async function analyzePatterns(userId: string): Promise<number> {
  try {
    // Get recent observations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const observations = await prisma.cortexObservation.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    if (observations.length < 5) return 0 // Need minimum data

    // Get existing active patterns to avoid duplicates
    const existingPatterns = await prisma.cortexPattern.findMany({
      where: { userId, status: { in: ['active', 'monitoring'] } },
    })

    const prompt = `Analyze these ${observations.length} behavioral observations and detect patterns.

Observations:
${observations.map(o => `- [${o.source}/${o.category}] ${o.event} (outcome: ${o.outcome || 'unknown'}, confidence: ${o.confidence})`).join('\n')}

Existing patterns (avoid duplicates):
${existingPatterns.map(p => `- ${p.title} (${p.patternType}, confidence: ${p.confidence})`).join('\n') || 'None yet'}

Return JSON array of NEW patterns detected:
[{
  "title": "short pattern title",
  "description": "detailed description of the pattern",
  "patternType": "habit|workflow|avoidance|productivity|communication|decision-making",
  "confidence": 0.0-1.0,
  "impactScore": 0.0-10.0,
  "recommendation": "actionable recommendation",
  "evidenceCount": number
}]

Return [] if no new patterns detected.`

    const result = await callLLM(PATTERN_ANALYSIS_PROMPT, prompt)
    if (!result) return 0

    let patterns: Array<{
      title: string
      description: string
      patternType: string
      confidence: number
      impactScore: number
      recommendation: string
      evidenceCount: number
    }>
    try {
      const cleaned = result.replace(/```json\n?|```\n?/g, '').trim()
      patterns = JSON.parse(cleaned)
      if (!Array.isArray(patterns)) return 0
    } catch {
      console.error('[Cortex] Failed to parse pattern analysis:', result)
      return 0
    }

    let created = 0
    for (const p of patterns) {
      if (!p.title || !p.description) continue
      await prisma.cortexPattern.create({
        data: {
          userId,
          title: p.title,
          description: p.description,
          patternType: p.patternType || 'workflow',
          confidence: Math.min(1, Math.max(0, p.confidence || 0.5)),
          impactScore: Math.min(10, Math.max(0, p.impactScore || 0)),
          recommendation: p.recommendation || null,
          evidenceIds: JSON.stringify(observations.slice(0, p.evidenceCount || 5).map(o => o.id)),
          status: 'active',
        },
      })
      created++
    }

    return created
  } catch (err) {
    console.error('[Cortex] Pattern analysis failed:', err)
    return 0
  }
}

// ─── Reflection Generation ─────────────────────────────────────────────

const REFLECTION_PROMPT = `You are Cortex, generating a strategic reflection for an executive operator.
Be concise. Be honest. Be actionable. No flattery.

Respond ONLY with valid JSON. No markdown wrapping.`

export async function generateReflection(
  userId: string,
  timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<boolean> {
  try {
    const daysBack = timeframe === 'daily' ? 1 : timeframe === 'weekly' ? 7 : 30
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

    const [observations, patterns, tasks] = await Promise.all([
      prisma.cortexObservation.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.cortexPattern.findMany({
        where: { userId, status: 'active' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { userId, updatedAt: { gte: since } },
        take: 50,
      }),
    ])

    if (observations.length < 3 && tasks.length < 2) return false

    const completedTasks = tasks.filter(t => t.status === 'completed')
    const pendingTasks = tasks.filter(t => t.status === 'pending')

    const prompt = `Generate a ${timeframe} reflection based on this data:

Observations (${observations.length} total):
${observations.slice(0, 30).map(o => `- [${o.source}] ${o.event} (${o.outcome || 'neutral'})`).join('\n')}

Active Patterns:
${patterns.map(p => `- ${p.title}: ${p.description.slice(0, 100)}`).join('\n') || 'None detected yet'}

Tasks: ${completedTasks.length} completed, ${pendingTasks.length} pending out of ${tasks.length} total

Return JSON:
{
  "summary": "2-3 sentence executive summary",
  "wins": ["win1", "win2"],
  "bottlenecks": ["bottleneck1"],
  "recurringThemes": ["theme1"],
  "optimizationSuggestions": ["suggestion1"],
  "executionScore": 0-100,
  "focusScore": 0-100,
  "consistencyScore": 0-100
}`

    const result = await callLLM(REFLECTION_PROMPT, prompt)
    if (!result) return false

    let reflection: {
      summary: string
      wins?: string[]
      bottlenecks?: string[]
      recurringThemes?: string[]
      optimizationSuggestions?: string[]
      executionScore?: number
      focusScore?: number
      consistencyScore?: number
    }
    try {
      const cleaned = result.replace(/```json\n?|```\n?/g, '').trim()
      reflection = JSON.parse(cleaned)
    } catch {
      console.error('[Cortex] Failed to parse reflection:', result)
      return false
    }

    await prisma.cortexReflection.create({
      data: {
        userId,
        timeframe,
        summary: reflection.summary || 'Insufficient data for detailed analysis.',
        wins: JSON.stringify(reflection.wins || []),
        bottlenecks: JSON.stringify(reflection.bottlenecks || []),
        recurringThemes: JSON.stringify(reflection.recurringThemes || []),
        optimizationSuggestions: JSON.stringify(reflection.optimizationSuggestions || []),
        executionScore: reflection.executionScore || 0,
        focusScore: reflection.focusScore || 0,
        consistencyScore: reflection.consistencyScore || 0,
      },
    })

    return true
  } catch (err) {
    console.error('[Cortex] Reflection generation failed:', err)
    return false
  }
}

// ─── Feedback Processing ───────────────────────────────────────────────

export async function processFeedback(input: FeedbackInput): Promise<boolean> {
  try {
    if (input.targetType === 'pattern') {
      const pattern = await prisma.cortexPattern.findFirst({
        where: { id: input.targetId, userId: input.userId },
      })
      if (!pattern) return false

      if (input.type === 'accept') {
        await prisma.cortexPattern.update({
          where: { id: input.targetId },
          data: { confidence: Math.min(1, pattern.confidence + 0.1) },
        })
      } else if (input.type === 'reject' || input.type === 'incorrect') {
        await prisma.cortexPattern.update({
          where: { id: input.targetId },
          data: {
            confidence: Math.max(0, pattern.confidence - 0.2),
            status: input.type === 'incorrect' ? 'resolved' : pattern.status,
          },
        })
      } else if (input.type === 'suppress') {
        await prisma.cortexPattern.update({
          where: { id: input.targetId },
          data: { status: 'suppressed' },
        })
      }

      // Record the feedback as an observation for meta-learning
      await recordObservation({
        userId: input.userId,
        source: 'agent',
        category: 'decision',
        event: `User ${input.type}ed pattern: ${pattern.title}`,
        metadata: { patternId: input.targetId, feedbackType: input.type },
        outcome: input.type === 'accept' ? 'positive' : 'negative',
        confidence: 0.9,
        importance: 7,
      })

      return true
    }
    return false
  } catch (err) {
    console.error('[Cortex] Feedback processing failed:', err)
    return false
  }
}

// ─── Overview Aggregation ──────────────────────────────────────────────

export async function getCortexOverview(userId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [recentObservations, totalObservations, activePatterns, latestReflection, recentTasks, sourceCounts] = await Promise.all([
    prisma.cortexObservation.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.cortexObservation.count({ where: { userId } }),
    prisma.cortexPattern.findMany({
      where: { userId, status: { in: ['active', 'monitoring'] } },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
    prisma.cortexReflection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { userId, updatedAt: { gte: thirtyDaysAgo } },
      select: { status: true, createdAt: true, updatedAt: true },
    }),
    prisma.cortexObservation.groupBy({
      by: ['source'],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
  ])

  // Calculate execution metrics from tasks
  const completedTasks = recentTasks.filter(t => t.status === 'completed').length
  const totalTasks = recentTasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Parse reflection JSON fields
  const reflection = latestReflection ? {
    ...latestReflection,
    wins: safeJsonParse(latestReflection.wins),
    bottlenecks: safeJsonParse(latestReflection.bottlenecks),
    recurringThemes: safeJsonParse(latestReflection.recurringThemes),
    optimizationSuggestions: safeJsonParse(latestReflection.optimizationSuggestions),
  } : null

  return {
    stats: {
      recentObservations,
      totalObservations,
      activePatternCount: activePatterns.length,
      completionRate,
      completedTasks,
      totalTasks,
    },
    patterns: activePatterns,
    latestReflection: reflection,
    sourceCounts: sourceCounts.map(s => ({ source: s.source, count: s._count })),
  }
}

function safeJsonParse(val: string | null): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ─── Memory Decay System ────────────────────────────────────────────────

/**
 * Calculate effective memory strength factoring in decay over time.
 * strength = baseStrength - (decayRate * daysSinceLastAccess)
 * Pinned memories always return 1.0.
 */
export function calculateEffectiveStrength(memory: {
  strength: number
  decayRate: number
  pinned: boolean
  lastAccessedAt: Date | null
  createdAt: Date
  importance: number
}): number {
  if (memory.pinned) return 1.0

  const referenceDate = memory.lastAccessedAt || memory.createdAt
  const daysSince = (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)

  // Importance provides a floor — high importance memories decay slower
  const importanceBonus = (memory.importance / 10) * 0.3 // max 0.3 bonus
  const decayed = memory.strength - (memory.decayRate * daysSince) + importanceBonus

  return Math.max(0.01, Math.min(1.0, decayed))
}

/**
 * Get memories weighted by effective strength for chat context.
 * Records access and bumps strength on retrieved memories.
 */
/**
 * Generate semantic tags for a memory using LLM.
 * Returns an array of normalized lowercase concept tokens.
 * Fire-and-forget safe — returns empty array on failure.
 */
export async function generateSemanticTags(content: string): Promise<string[]> {
  try {
    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) return []
    const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [{
          role: 'user',
          content: `Extract 5-12 normalized semantic concepts/keywords from this text. Return ONLY a JSON array of lowercase strings — no explanation.\n\nText: "${content.slice(0, 1000)}"`
        }],
        max_tokens: 200,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    // Parse JSON — might be { "tags": [...] } or just [...]
    const parsed = JSON.parse(raw)
    const arr = Array.isArray(parsed) ? parsed : (parsed.tags || parsed.concepts || parsed.keywords || Object.values(parsed)[0])
    if (Array.isArray(arr)) return arr.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 15)
    return []
  } catch {
    return []
  }
}

/**
 * Unified memory enrichment: generates both semantic tags AND vector embedding.
 * Fire-and-forget safe — updates the memory record asynchronously.
 */
export async function enrichMemoryAsync(memoryId: string, content: string): Promise<void> {
  try {
    const [tags, embedding] = await Promise.allSettled([
      generateSemanticTags(content),
      import('@/lib/embeddings').then(({ generateEmbedding, serializeEmbedding, EMBEDDING_MODEL_TAG }) =>
        generateEmbedding(content).then(vec => vec ? { data: serializeEmbedding(vec), model: EMBEDDING_MODEL_TAG } : null)
      ),
    ])

    const updateData: Record<string, any> = {}
    if (tags.status === 'fulfilled' && tags.value.length > 0) {
      updateData.semanticTags = JSON.stringify(tags.value)
    }
    if (embedding.status === 'fulfilled' && embedding.value) {
      updateData.embedding = embedding.value.data
      updateData.embeddingModel = embedding.value.model
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.memory.update({ where: { id: memoryId }, data: updateData })
    }
  } catch (err) {
    console.error('[Cortex] enrichMemoryAsync failed:', err)
  }
}

/**
 * Compute semantic similarity score between query tokens and memory semantic tags.
 * Returns 0-1 score based on token overlap ratio.
 */
function semanticSimilarity(queryTokens: string[], semanticTags: string[]): number {
  if (!queryTokens.length || !semanticTags.length) return 0
  let matches = 0
  for (const qt of queryTokens) {
    for (const st of semanticTags) {
      if (st.includes(qt) || qt.includes(st)) {
        matches++
        break
      }
    }
  }
  return matches / Math.max(queryTokens.length, 1)
}

/**
 * Tokenize a query string into normalized lowercase tokens for matching.
 */
function tokenizeQuery(query: string): string[] {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','about','i','me','my','we','our','you','your','he','his','she','her','it','its','they','them','their','what','which','who','whom','this','that','these','those','am','and','but','or','if'])
  return query.toLowerCase().split(/\W+/).filter(t => t.length >= 2 && !stopWords.has(t))
}

export async function getWeightedMemories(userId: string, limit: number = 10, query?: string) {
  // Fetch more than needed so we can sort by effective strength
  const memories = await prisma.memory.findMany({
    where: { userId },
    orderBy: { importance: 'desc' },
    take: limit * 3,
  })

  const queryTokens = query ? tokenizeQuery(query) : []

  // Generate query embedding for vector similarity (if query provided)
  let queryEmbedding: number[] | null = null
  if (query && query.length > 5) {
    try {
      const { generateEmbedding } = await import('@/lib/embeddings')
      queryEmbedding = await generateEmbedding(query)
    } catch { /* fall back to tag-based matching */ }
  }

  // Calculate effective strength and sort — with vector similarity + tag fallback
  const weighted = memories.map(m => {
    const effectiveStrength = calculateEffectiveStrength(m)
    let semanticScore = 0

    if (queryTokens.length > 0 || queryEmbedding) {
      // Vector embedding similarity (primary signal)
      if (queryEmbedding && m.embedding) {
        try {
          const { parseEmbedding, cosineSimilarity } = require('@/lib/embeddings')
          const memEmb = parseEmbedding(m.embedding)
          if (memEmb) {
            semanticScore = cosineSimilarity(queryEmbedding, memEmb)
          }
        } catch { /* skip vector path */ }
      }

      // Tag-based fallback (for memories without embeddings)
      if (semanticScore === 0 && queryTokens.length > 0) {
        const tags: string[] = m.semanticTags ? (() => { try { return JSON.parse(m.semanticTags) } catch { return [] } })() : []
        semanticScore = semanticSimilarity(queryTokens, tags)
        const contentLower = m.content.toLowerCase()
        const contentMatch = queryTokens.filter(t => contentLower.includes(t)).length / Math.max(queryTokens.length, 1)
        semanticScore = Math.max(semanticScore, contentMatch * 0.8)
      }
    }
    return {
      ...m,
      effectiveStrength,
      semanticScore,
    }
  })

  weighted.sort((a, b) => {
    // Composite score: strength*importance + semantic relevance boost
    const baseA = a.effectiveStrength * (a.importance / 10)
    const baseB = b.effectiveStrength * (b.importance / 10)
    // Semantic boost: up to 0.6 for vector matches, 0.5 for tag matches
    const scoreA = baseA + (a.semanticScore * 0.6)
    const scoreB = baseB + (b.semanticScore * 0.6)
    return scoreB - scoreA
  })

  const selected = weighted.slice(0, limit)

  // Bump access count and lastAccessedAt for retrieved memories (fire-and-forget)
  if (selected.length > 0) {
    const ids = selected.map(m => m.id)
    prisma.memory.updateMany({
      where: { id: { in: ids } },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    }).catch(() => {})
  }

  return selected
}

/**
 * Run decay pass: reduce strength on stale memories.
 * Call periodically (e.g., daily via API trigger).
 */
export async function runMemoryDecay(userId: string): Promise<{ processed: number; archived: number }> {
  const memories = await prisma.memory.findMany({
    where: { userId, pinned: false },
  })

  let archived = 0
  for (const m of memories) {
    const effective = calculateEffectiveStrength(m)

    if (effective <= 0.05) {
      // Archive near-zero memories by setting type to 'archived'
      await prisma.memory.update({
        where: { id: m.id },
        data: { strength: 0, type: 'archived' },
      })
      archived++
    } else if (effective < m.strength) {
      // Update stored strength
      await prisma.memory.update({
        where: { id: m.id },
        data: { strength: effective },
      })
    }
  }

  return { processed: memories.length, archived }
}

/**
 * Reinforce a memory — called when a memory is explicitly referenced or confirmed.
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
  try {
    await prisma.memory.update({
      where: { id: memoryId },
      data: {
        strength: { increment: 0.1 },
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    })
    // Clamp strength to 1.0
    await prisma.$executeRaw`UPDATE "Memory" SET strength = 1.0 WHERE id = ${memoryId} AND strength > 1.0`
  } catch (err) {
    console.error('[Cortex] Failed to reinforce memory:', err)
  }
}

// ─── Contradiction Detection ────────────────────────────────────────────

const CONTRADICTION_PROMPT = `You are Cortex, the contradiction detection engine for Seth — a strategic executive intelligence system.
Analyze the provided memories, preferences, and recent actions to detect any contradictions.

Rules:
- Only flag genuine contradictions, not mere nuance or contextual differences
- Assign confidence (0-1) based on how clearly the items conflict
- Severity: "low" for minor preference conflicts, "medium" for strategic inconsistencies, "high" for goal/decision conflicts
- Do NOT flag things that are simply evolving preferences (context matters)
- Be concise and specific

Respond ONLY with valid JSON. No markdown wrapping.`

export async function detectContradictions(userId: string): Promise<number> {
  try {
    // Gather data for analysis
    const [memories, recentObservations, existingContradictions] = await Promise.all([
      prisma.memory.findMany({
        where: { userId, type: { not: 'archived' } },
        orderBy: { importance: 'desc' },
        take: 30,
      }),
      prisma.cortexObservation.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.cortexContradiction.findMany({
        where: { userId, status: 'active' },
        take: 20,
      }),
    ])

    if (memories.length < 2 && recentObservations.length < 3) return 0

    const prompt = `Analyze these items for contradictions:

MEMORIES (stored preferences/decisions/context):
${memories.map(m => `- [${m.type}] (importance: ${m.importance}) ${m.content}`).join('\n')}

RECENT ACTIONS (last 14 days):
${recentObservations.map(o => `- [${o.source}/${o.category}] ${o.event}`).join('\n')}

EXISTING CONTRADICTIONS (avoid duplicates):
${existingContradictions.map(c => `- ${c.title}`).join('\n') || 'None'}

Return JSON array of NEW contradictions:
[{
  "category": "preference_conflict|strategic_conflict|goal_conflict|behavioral_conflict|scheduling_conflict|memory_conflict",
  "title": "short title",
  "description": "what contradicts what and why",
  "evidenceA": "first conflicting statement/action",
  "evidenceB": "second conflicting statement/action",
  "confidence": 0.0-1.0,
  "severity": "low|medium|high"
}]

Return [] if no contradictions detected.`

    const result = await callLLM(CONTRADICTION_PROMPT, prompt)
    if (!result) return 0

    let contradictions: Array<{
      category: string
      title: string
      description: string
      evidenceA: string
      evidenceB: string
      confidence: number
      severity: string
    }>
    try {
      const cleaned = result.replace(/```json\n?|```\n?/g, '').trim()
      contradictions = JSON.parse(cleaned)
      if (!Array.isArray(contradictions)) return 0
    } catch {
      console.error('[Cortex] Failed to parse contradiction analysis:', result)
      return 0
    }

    let created = 0
    for (const c of contradictions) {
      if (!c.title || !c.description) continue
      await prisma.cortexContradiction.create({
        data: {
          userId,
          category: c.category || 'behavioral_conflict',
          title: c.title,
          description: c.description,
          evidenceA: c.evidenceA || '',
          evidenceB: c.evidenceB || '',
          confidence: Math.min(1, Math.max(0, c.confidence || 0.5)),
          severity: c.severity || 'medium',
          status: 'active',
        },
      })
      created++
    }

    return created
  } catch (err) {
    console.error('[Cortex] Contradiction detection failed:', err)
    return 0
  }
}

/**
 * Resolve a contradiction — user provides resolution or dismisses.
 */
export async function resolveContradiction(
  userId: string,
  contradictionId: string,
  action: 'resolve' | 'dismiss',
  resolution?: string
): Promise<boolean> {
  try {
    const existing = await prisma.cortexContradiction.findFirst({
      where: { id: contradictionId, userId },
    })
    if (!existing) return false

    await prisma.cortexContradiction.update({
      where: { id: contradictionId },
      data: {
        status: action === 'resolve' ? 'resolved' : 'dismissed',
        resolution: resolution || null,
      },
    })

    // Record as observation
    await recordObservation({
      userId,
      source: 'agent',
      category: 'decision',
      event: `Contradiction ${action}d: ${existing.title}${resolution ? ` — ${resolution}` : ''}`,
      metadata: { contradictionId, action },
      outcome: 'positive',
      confidence: 0.9,
      importance: 6,
    })

    return true
  } catch (err) {
    console.error('[Cortex] Failed to resolve contradiction:', err)
    return false
  }
}

// ─── Enhanced Overview (with decay + contradiction stats) ───────────────

export async function getCortexOverviewV2(userId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    recentObservations,
    totalObservations,
    activePatterns,
    latestReflection,
    recentTasks,
    sourceCounts,
    activeContradictions,
    memoryStats,
  ] = await Promise.all([
    prisma.cortexObservation.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.cortexObservation.count({ where: { userId } }),
    prisma.cortexPattern.findMany({
      where: { userId, status: { in: ['active', 'monitoring'] } },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
    prisma.cortexReflection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { userId, updatedAt: { gte: thirtyDaysAgo } },
      select: { status: true, createdAt: true, updatedAt: true },
    }),
    prisma.cortexObservation.groupBy({
      by: ['source'],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.cortexContradiction.findMany({
      where: { userId, status: 'active' },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),
    prisma.memory.aggregate({
      where: { userId, type: { not: 'archived' } },
      _count: true,
      _avg: { strength: true, importance: true },
    }),
  ])

  const completedTasks = recentTasks.filter(t => t.status === 'completed').length
  const totalTasks = recentTasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const reflection = latestReflection ? {
    ...latestReflection,
    wins: safeJsonParse(latestReflection.wins),
    bottlenecks: safeJsonParse(latestReflection.bottlenecks),
    recurringThemes: safeJsonParse(latestReflection.recurringThemes),
    optimizationSuggestions: safeJsonParse(latestReflection.optimizationSuggestions),
  } : null

  return {
    stats: {
      recentObservations,
      totalObservations,
      activePatternCount: activePatterns.length,
      completionRate,
      completedTasks,
      totalTasks,
      activeContradictionCount: activeContradictions.length,
      memoryCount: memoryStats._count ?? 0,
      avgMemoryStrength: Math.round((memoryStats._avg?.strength ?? 1) * 100),
      avgMemoryImportance: Math.round((memoryStats._avg?.importance ?? 5) * 10) / 10,
    },
    patterns: activePatterns,
    contradictions: activeContradictions,
    latestReflection: reflection,
    sourceCounts: sourceCounts.map(s => ({ source: s.source, count: s._count })),
  }
}

// ─── Phase 3: Relationship Mapping ───────────────────────────────────────

interface ExtractedEntity {
  name: string
  nodeType: 'person' | 'project' | 'goal' | 'concept' | 'organization'
  description?: string
  metadata?: Record<string, unknown>
}

interface ExtractedRelation {
  sourceName: string
  targetName: string
  edgeType: string
  context?: string
}

/**
 * Extract entities and relationships from text using LLM
 */
export async function extractEntities(
  userId: string,
  text: string,
  source: string
): Promise<{ entities: ExtractedEntity[]; relations: ExtractedRelation[] }> {
  try {
    // Get existing entities for context
    const existingEntities = await prisma.cortexEntity.findMany({
      where: { userId },
      select: { name: true, nodeType: true },
      take: 100,
      orderBy: { mentionCount: 'desc' },
    })

    const systemPrompt = `You are an entity extraction engine for an executive intelligence system.
Extract entities (people, projects, goals, concepts, organizations) and relationships from text.

EXISTING KNOWN ENTITIES (update mentions if referenced):
${existingEntities.map(e => `- ${e.name} (${e.nodeType})`).join('\n') || 'None yet'}

Return JSON only:
{
  "entities": [
    { "name": "Alex Chen", "nodeType": "person", "description": "Investor contact", "metadata": { "role": "investor" } }
  ],
  "relations": [
    { "sourceName": "Alex Chen", "targetName": "Project Atlas", "edgeType": "stakeholder_of", "context": "Lead investor" }
  ]
}

RULES:
- nodeType: person | project | goal | concept | organization
- edgeType: collaborated_on | mentioned_with | blocked_by | dependent_on | frequently_associated | reports_to | stakeholder_of
- Normalize names (proper case for people, consistent naming)
- Only extract clearly identifiable entities, not generic terms
- Keep descriptions concise (under 100 chars)
- If no entities found, return empty arrays`

    const content = await callLLM(systemPrompt, `Source: ${source}\n\nText:\n${text.slice(0, 3000)}`)
    if (!content) return { entities: [], relations: [] }
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { entities: [], relations: [] }
    return JSON.parse(jsonMatch[0])
  } catch {
    return { entities: [], relations: [] }
  }
}

/**
 * Upsert extracted entities into the graph and update mention counts
 */
export async function upsertEntities(
  userId: string,
  entities: ExtractedEntity[]
): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>()

  for (const entity of entities) {
    try {
      const existing = await prisma.cortexEntity.findUnique({
        where: { userId_nodeType_name: { userId, nodeType: entity.nodeType, name: entity.name } },
      })

      if (existing) {
        await prisma.cortexEntity.update({
          where: { id: existing.id },
          data: {
            mentionCount: { increment: 1 },
            lastMentionedAt: new Date(),
            ...(entity.description && !existing.description ? { description: entity.description } : {}),
          },
        })
        nameToId.set(entity.name, existing.id)
      } else {
        const created = await prisma.cortexEntity.create({
          data: {
            userId,
            nodeType: entity.nodeType,
            name: entity.name,
            description: entity.description || null,
            metadata: entity.metadata ? JSON.stringify(entity.metadata) : null,
          },
        })
        nameToId.set(entity.name, created.id)
      }
    } catch {
      // unique constraint race condition, skip
    }
  }

  return nameToId
}

/**
 * Upsert extracted relations into the graph
 */
export async function upsertRelations(
  userId: string,
  relations: ExtractedRelation[],
  nameToId: Map<string, string>
) {
  for (const rel of relations) {
    const sourceId = nameToId.get(rel.sourceName)
    const targetId = nameToId.get(rel.targetName)
    if (!sourceId || !targetId || sourceId === targetId) continue

    try {
      const existing = await prisma.cortexRelation.findUnique({
        where: { userId_sourceId_targetId_edgeType: { userId, sourceId, targetId, edgeType: rel.edgeType } },
      })

      if (existing) {
        await prisma.cortexRelation.update({
          where: { id: existing.id },
          data: { weight: { increment: 0.5 }, metadata: rel.context ? JSON.stringify({ context: rel.context }) : existing.metadata },
        })
      } else {
        await prisma.cortexRelation.create({
          data: {
            userId,
            sourceId,
            targetId,
            edgeType: rel.edgeType,
            metadata: rel.context ? JSON.stringify({ context: rel.context }) : null,
          },
        })
      }
    } catch {
      // unique constraint race condition, skip
    }
  }
}

/**
 * Full entity extraction + graph update pipeline (fire-and-forget)
 */
export async function processTextForEntities(userId: string, text: string, source: string) {
  try {
    const { entities, relations } = await extractEntities(userId, text, source)
    if (entities.length === 0) return
    const nameToId = await upsertEntities(userId, entities)
    if (relations.length > 0) {
      await upsertRelations(userId, relations, nameToId)
    }
  } catch {
    // fire-and-forget
  }
}

/**
 * Get relationship graph for a user
 */
export async function getRelationshipGraph(userId: string) {
  const [entities, relations] = await Promise.all([
    prisma.cortexEntity.findMany({
      where: { userId },
      orderBy: { mentionCount: 'desc' },
      take: 100,
    }),
    prisma.cortexRelation.findMany({
      where: { userId },
      orderBy: { weight: 'desc' },
      take: 200,
      include: { source: { select: { name: true, nodeType: true } }, target: { select: { name: true, nodeType: true } } },
    }),
  ])

  return { entities, relations }
}

// ─── Phase 3: Project Linking ────────────────────────────────────────────

export async function createProject(userId: string, name: string, description?: string, metadata?: Record<string, unknown>) {
  return prisma.cortexProject.create({
    data: {
      userId,
      name,
      description: description || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}

export async function getProjects(userId: string) {
  return prisma.cortexProject.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { links: { take: 50, orderBy: { linkedAt: 'desc' } } },
  })
}

export async function linkToProject(projectId: string, entityType: string, entityId: string, context?: string) {
  try {
    return await prisma.cortexProjectLink.create({
      data: { projectId, entityType, entityId, context: context || null },
    })
  } catch {
    // duplicate link, skip
    return null
  }
}

export async function unlinkFromProject(projectId: string, entityType: string, entityId: string) {
  try {
    await prisma.cortexProjectLink.deleteMany({
      where: { projectId, entityType, entityId },
    })
  } catch {
    // not found, skip
  }
}

/**
 * Auto-detect project references in text and link entities
 */
export async function autoLinkProjects(userId: string, text: string, entityType: string, entityId: string) {
  try {
    const projects = await prisma.cortexProject.findMany({
      where: { userId, status: 'active' },
      select: { id: true, name: true },
    })
    if (projects.length === 0) return

    const lowerText = text.toLowerCase()
    for (const project of projects) {
      if (lowerText.includes(project.name.toLowerCase())) {
        await linkToProject(project.id, entityType, entityId, `Auto-linked: mentioned "${project.name}"`)
      }
    }
  } catch {
    // fire-and-forget
  }
}

// ─── Phase 3: Temporal Relevance Weighting ───────────────────────────────

/**
 * Calculate temporal relevance score for a memory
 * Factors: recency, seasonal match, deadline proximity, recurrence
 */
export function calculateTemporalRelevance(
  createdAt: Date,
  tags?: string,
  importance?: number
): number {
  const now = new Date()
  const daysSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

  // Recency score: exponential decay over 90 days
  const recencyScore = Math.max(0, 1 - (daysSince / 90))

  // Seasonal match: check if content has seasonal keywords matching current quarter
  const month = now.getMonth()
  const quarter = Math.floor(month / 3) + 1
  let seasonalBonus = 0
  if (tags) {
    const lowerTags = tags.toLowerCase()
    const seasonalKeywords: Record<number, string[]> = {
      1: ['tax', 'q1', 'annual', 'january', 'february', 'march', 'year-end', 'planning'],
      2: ['q2', 'april', 'may', 'june', 'mid-year', 'summer'],
      3: ['q3', 'july', 'august', 'september', 'fall', 'autumn'],
      4: ['q4', 'october', 'november', 'december', 'holiday', 'year-end', 'budget'],
    }
    if (seasonalKeywords[quarter]?.some(kw => lowerTags.includes(kw))) {
      seasonalBonus = 0.2
    }
  }

  // Importance weighting
  const importanceBonus = ((importance || 5) / 10) * 0.3

  return Math.min(1, recencyScore + seasonalBonus + importanceBonus)
}

// ─── Phase 3: Cognitive Load Detection ───────────────────────────────────

/**
 * Analyze recent activity for cognitive overload signals
 */
export async function detectCognitiveLoad(userId: string): Promise<{
  loadLevel: 'normal' | 'elevated' | 'high' | 'critical'
  score: number
  signals: string[]
  recommendation?: string
}> {
  try {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [recentObs, recentTasks, weekObs] = await Promise.all([
      prisma.cortexObservation.count({ where: { userId, createdAt: { gte: threeDaysAgo } } }),
      prisma.task.findMany({
        where: { userId, updatedAt: { gte: sevenDaysAgo } },
        select: { status: true, priority: true, dueDate: true },
      }),
      prisma.cortexObservation.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
    ])

    const signals: string[] = []
    let loadScore = 0

    // Signal: High activity volume
    const dailyAvg3d = recentObs / 3
    const dailyAvg7d = weekObs / 7
    if (dailyAvg3d > dailyAvg7d * 1.5 && dailyAvg3d > 10) {
      signals.push(`Activity spike: ${Math.round(dailyAvg3d)} actions/day vs ${Math.round(dailyAvg7d)} weekly avg`)
      loadScore += 0.25
    }

    // Signal: Task overload
    const pendingTasks = recentTasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
    const highPriTasks = pendingTasks.filter(t => t.priority === 'critical' || t.priority === 'high')
    if (pendingTasks.length > 15) {
      signals.push(`${pendingTasks.length} active tasks (recommended: <15)`)
      loadScore += 0.2
    }
    if (highPriTasks.length > 5) {
      signals.push(`${highPriTasks.length} high/critical priority tasks competing for attention`)
      loadScore += 0.2
    }

    // Signal: Overdue tasks
    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < now)
    if (overdueTasks.length > 3) {
      signals.push(`${overdueTasks.length} overdue tasks accumulating`)
      loadScore += 0.2
    }

    // Signal: Context switching (many different categories in recent observations)
    const recentCategories = await prisma.cortexObservation.findMany({
      where: { userId, createdAt: { gte: threeDaysAgo } },
      select: { category: true },
      distinct: ['category'],
    })
    if (recentCategories.length >= 5) {
      signals.push(`High context switching: ${recentCategories.length} different work categories in 3 days`)
      loadScore += 0.15
    }

    loadScore = Math.min(1, loadScore)
    const loadLevel = loadScore >= 0.7 ? 'critical' : loadScore >= 0.5 ? 'high' : loadScore >= 0.3 ? 'elevated' : 'normal'

    let recommendation: string | undefined
    if (loadLevel === 'critical') {
      recommendation = 'Consider deferring non-essential tasks and focusing on the top 3 priorities. Cancel or delegate where possible.'
    } else if (loadLevel === 'high') {
      recommendation = 'Cognitive load is elevated. Prioritize ruthlessly and batch similar tasks to reduce context switching.'
    } else if (loadLevel === 'elevated') {
      recommendation = 'Workload is above baseline. Monitor for signs of diminishing returns.'
    }

    return { loadLevel, score: loadScore, signals, recommendation }
  } catch {
    return { loadLevel: 'normal', score: 0, signals: [] }
  }
}

// ─── Phase 3: Strategic Drift Analysis ───────────────────────────────────

/**
 * Analyze whether recent actions align with stated goals and objectives
 */
export async function analyzeStrategicDrift(userId: string): Promise<{
  driftScore: number // 0 = perfectly aligned, 1 = completely drifted
  alignedAreas: string[]
  driftAreas: string[]
  recommendation?: string
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { objectives: true, preferences: true },
    })

    if (!user?.objectives) {
      return { driftScore: 0, alignedAreas: [], driftAreas: [], recommendation: 'Set strategic objectives in your Profile to enable drift analysis.' }
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const [recentObservations, recentReflections, recentPatterns] = await Promise.all([
      prisma.cortexObservation.findMany({
        where: { userId, createdAt: { gte: fourteenDaysAgo } },
        select: { event: true, category: true, outcome: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.cortexReflection.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { summary: true, bottlenecks: true, wins: true },
      }),
      prisma.cortexPattern.findMany({
        where: { userId, status: 'active' },
        select: { title: true, description: true, patternType: true },
        take: 10,
      }),
    ])

    const sysPrompt = `You are a strategic alignment analyzer. Compare the user's stated objectives against their recent behavior to detect drift.

Return JSON only:
{
  "driftScore": 0.35,
  "alignedAreas": ["Area where actions match goals"],
  "driftAreas": ["Area where actions diverge from goals"],
  "recommendation": "Concise actionable suggestion"
}

driftScore: 0 = perfectly aligned, 1 = completely drifted. Be nuanced — most people have some drift.`

    const userPrompt = `STATED OBJECTIVES:\n${user.objectives}\n\nPREFERENCES:\n${user.preferences || 'None stated'}\n\nRECENT ACTIVITY (14 days):\n${recentObservations.map(o => `- [${o.category}] ${o.event} (${o.outcome})`).join('\n')}\n\nRECENT REFLECTIONS:\n${recentReflections.map(r => `Summary: ${r.summary}\nWins: ${JSON.parse(r.wins as string || '[]').join(', ')}\nBottlenecks: ${JSON.parse(r.bottlenecks as string || '[]').join(', ')}`).join('\n---\n')}\n\nACTIVE PATTERNS:\n${recentPatterns.map(p => `- ${p.title}: ${p.description}`).join('\n')}`

    const llmContent = await callLLM(sysPrompt, userPrompt)
    if (!llmContent) return { driftScore: 0, alignedAreas: [], driftAreas: [] }
    const jsonMatch = llmContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { driftScore: 0, alignedAreas: [], driftAreas: [] }
    return JSON.parse(jsonMatch[0])
  } catch {
    return { driftScore: 0, alignedAreas: [], driftAreas: [] }
  }
}

// ─── Phase 3: Environmental Correlation ──────────────────────────────────

/**
 * Analyze correlation between context (time of day, day of week) and productivity
 */
export async function analyzeEnvironmentalCorrelation(userId: string): Promise<{
  insights: Array<{ factor: string; finding: string; confidence: number }>
  bestPerformanceWindow?: string
  recommendation?: string
}> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const observations = await prisma.cortexObservation.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, category: true, outcome: true, importance: true },
      orderBy: { createdAt: 'asc' },
    })

    if (observations.length < 20) {
      return { insights: [], recommendation: 'Need at least 20 observations for environmental analysis. Keep using Seth.' }
    }

    // Bucket by hour and day of week
    const hourBuckets: Record<number, { total: number; positive: number; importance: number }> = {}
    const dayBuckets: Record<number, { total: number; positive: number; importance: number }> = {}

    for (const obs of observations) {
      const hour = obs.createdAt.getHours()
      const day = obs.createdAt.getDay()

      if (!hourBuckets[hour]) hourBuckets[hour] = { total: 0, positive: 0, importance: 0 }
      hourBuckets[hour].total++
      if (obs.outcome === 'positive') hourBuckets[hour].positive++
      hourBuckets[hour].importance += obs.importance

      if (!dayBuckets[day]) dayBuckets[day] = { total: 0, positive: 0, importance: 0 }
      dayBuckets[day].total++
      if (obs.outcome === 'positive') dayBuckets[day].positive++
      dayBuckets[day].importance += obs.importance
    }

    const insights: Array<{ factor: string; finding: string; confidence: number }> = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Find peak hours
    const hourEntries = Object.entries(hourBuckets)
      .filter(([, v]) => v.total >= 3)
      .map(([h, v]) => ({ hour: parseInt(h), rate: v.positive / v.total, avgImportance: v.importance / v.total, total: v.total }))
      .sort((a, b) => b.rate - a.rate)

    if (hourEntries.length >= 3) {
      const best = hourEntries[0]
      const worst = hourEntries[hourEntries.length - 1]
      insights.push({
        factor: 'Time of Day',
        finding: `Peak performance at ${best.hour}:00 (${Math.round(best.rate * 100)}% positive outcomes). Lowest at ${worst.hour}:00 (${Math.round(worst.rate * 100)}%).`,
        confidence: Math.min(0.9, best.total / 20),
      })
    }

    // Find peak days
    const dayEntries = Object.entries(dayBuckets)
      .filter(([, v]) => v.total >= 3)
      .map(([d, v]) => ({ day: parseInt(d), rate: v.positive / v.total, total: v.total }))
      .sort((a, b) => b.rate - a.rate)

    if (dayEntries.length >= 3) {
      const best = dayEntries[0]
      const worst = dayEntries[dayEntries.length - 1]
      insights.push({
        factor: 'Day of Week',
        finding: `Most effective on ${dayNames[best.day]}s (${Math.round(best.rate * 100)}% positive). Least on ${dayNames[worst.day]}s (${Math.round(worst.rate * 100)}%).`,
        confidence: Math.min(0.9, best.total / 10),
      })
    }

    // Category distribution
    const categoryMap: Record<string, number> = {}
    for (const obs of observations) {
      categoryMap[obs.category] = (categoryMap[obs.category] || 0) + 1
    }
    const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]
    if (topCategory) {
      const pct = Math.round((topCategory[1] / observations.length) * 100)
      insights.push({
        factor: 'Focus Distribution',
        finding: `${pct}% of activity is ${topCategory[0]}-related. ${pct > 60 ? 'Consider diversifying focus.' : 'Healthy distribution.'}`,
        confidence: 0.8,
      })
    }

    const bestWindow = hourEntries.length > 0 ? `${hourEntries[0].hour}:00–${(hourEntries[0].hour + 2) % 24}:00` : undefined

    return {
      insights,
      bestPerformanceWindow: bestWindow,
      recommendation: bestWindow ? `Schedule high-priority work during your peak window: ${bestWindow}` : undefined,
    }
  } catch {
    return { insights: [] }
  }
}

// ─── Phase 3: Generate Insights ──────────────────────────────────────────

/**
 * Run all Phase 3 analyses and store as CortexInsights
 */
export async function generateInsights(userId: string): Promise<number> {
  let newInsights = 0

  try {
    // 1. Cognitive Load
    const cogLoad = await detectCognitiveLoad(userId)
    if (cogLoad.loadLevel !== 'normal' && cogLoad.signals.length > 0) {
      const existing = await prisma.cortexInsight.findFirst({
        where: { userId, insightType: 'cognitive_load', status: 'active' },
      })
      if (!existing) {
        await prisma.cortexInsight.create({
          data: {
            userId,
            insightType: 'cognitive_load',
            title: `Cognitive Load: ${cogLoad.loadLevel.charAt(0).toUpperCase() + cogLoad.loadLevel.slice(1)}`,
            description: cogLoad.recommendation || cogLoad.signals.join('. '),
            severity: cogLoad.loadLevel === 'critical' ? 'critical' : cogLoad.loadLevel === 'high' ? 'warning' : 'info',
            confidence: cogLoad.score,
            evidence: JSON.stringify({ signals: cogLoad.signals, score: cogLoad.score }),
          },
        })
        newInsights++
      } else {
        // Update existing
        await prisma.cortexInsight.update({
          where: { id: existing.id },
          data: {
            title: `Cognitive Load: ${cogLoad.loadLevel.charAt(0).toUpperCase() + cogLoad.loadLevel.slice(1)}`,
            description: cogLoad.recommendation || cogLoad.signals.join('. '),
            severity: cogLoad.loadLevel === 'critical' ? 'critical' : cogLoad.loadLevel === 'high' ? 'warning' : 'info',
            confidence: cogLoad.score,
            evidence: JSON.stringify({ signals: cogLoad.signals, score: cogLoad.score }),
          },
        })
      }
    }

    // 2. Strategic Drift
    const drift = await analyzeStrategicDrift(userId)
    if (drift.driftScore > 0.3 && drift.driftAreas.length > 0) {
      const existing = await prisma.cortexInsight.findFirst({
        where: { userId, insightType: 'strategic_drift', status: 'active' },
      })
      const title = `Strategic Drift: ${drift.driftScore >= 0.6 ? 'Significant' : 'Moderate'} misalignment detected`
      const desc = `${drift.driftAreas.join('. ')}${drift.recommendation ? '\n\n' + drift.recommendation : ''}`

      if (!existing) {
        await prisma.cortexInsight.create({
          data: {
            userId,
            insightType: 'strategic_drift',
            title,
            description: desc,
            severity: drift.driftScore >= 0.6 ? 'warning' : 'info',
            confidence: drift.driftScore,
            evidence: JSON.stringify({ alignedAreas: drift.alignedAreas, driftAreas: drift.driftAreas }),
          },
        })
        newInsights++
      } else {
        await prisma.cortexInsight.update({
          where: { id: existing.id },
          data: { title, description: desc, severity: drift.driftScore >= 0.6 ? 'warning' : 'info', confidence: drift.driftScore, evidence: JSON.stringify({ alignedAreas: drift.alignedAreas, driftAreas: drift.driftAreas }) },
        })
      }
    }

    // 3. Environmental Correlation
    const envCorr = await analyzeEnvironmentalCorrelation(userId)
    if (envCorr.insights.length > 0) {
      const existing = await prisma.cortexInsight.findFirst({
        where: { userId, insightType: 'environmental_correlation', status: 'active' },
      })
      const title = envCorr.bestPerformanceWindow
        ? `Peak Performance Window: ${envCorr.bestPerformanceWindow}`
        : 'Environmental Patterns Detected'
      const desc = envCorr.insights.map(i => `${i.factor}: ${i.finding}`).join('\n') + (envCorr.recommendation ? `\n\n${envCorr.recommendation}` : '')
      const avgConf = envCorr.insights.reduce((s, i) => s + i.confidence, 0) / envCorr.insights.length

      if (!existing) {
        await prisma.cortexInsight.create({
          data: {
            userId,
            insightType: 'environmental_correlation',
            title,
            description: desc,
            severity: 'info',
            confidence: avgConf,
            evidence: JSON.stringify(envCorr.insights),
          },
        })
        newInsights++
      } else {
        await prisma.cortexInsight.update({
          where: { id: existing.id },
          data: { title, description: desc, confidence: avgConf, evidence: JSON.stringify(envCorr.insights) },
        })
      }
    }
  } catch {
    // partial failure is acceptable
  }

  return newInsights
}

// ─── Phase 3: Enhanced Overview (V3) ─────────────────────────────────────

export async function getCortexOverviewV3(userId: string) {
  const v2 = await getCortexOverviewV2(userId)

  const [entityCount, relationCount, projectCount, activeInsights] = await Promise.all([
    prisma.cortexEntity.count({ where: { userId } }),
    prisma.cortexRelation.count({ where: { userId } }),
    prisma.cortexProject.count({ where: { userId, status: 'active' } }),
    prisma.cortexInsight.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    ...v2,
    stats: {
      ...v2.stats,
      entityCount,
      relationCount,
      projectCount,
      activeInsightCount: activeInsights.length,
    },
    insights: activeInsights.map(i => ({
      id: i.id,
      insightType: i.insightType,
      title: i.title,
      description: i.description,
      severity: i.severity,
      confidence: i.confidence,
      evidence: i.evidence,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

// ─── Graph-Aware Context Retrieval ──────────────────────────────────────
// Pure DB queries — zero LLM calls. Returns a pre-formatted context block
// ranked by relevance, recency, project linkage, contradiction probability,
// and strategic significance.

interface GraphContextItem {
  type: 'entity' | 'relation' | 'contradiction' | 'insight' | 'project'
  text: string
  score: number // 0-1 composite ranking score
}

/**
 * Extract meaningful tokens from a query for entity matching.
 * Strips stop words and short tokens, returns lowercase unique tokens.
 */
function extractQueryTokens(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
    'like', 'through', 'after', 'over', 'between', 'out', 'up', 'down',
    'that', 'this', 'these', 'those', 'it', 'its', 'my', 'your', 'his',
    'her', 'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
    'why', 'how', 'not', 'no', 'nor', 'but', 'or', 'and', 'if', 'then',
    'else', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
    'there', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'only', 'own', 'same', 'tell', 'me', 'know', 'think',
    'get', 'make', 'go', 'see', 'come', 'take', 'want', 'look', 'use',
    'find', 'give', 'say', 'hey', 'seth', 'please', 'thanks', 'thank',
  ])
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !stopWords.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i) // unique
}

/**
 * Compute a composite ranking score for a graph context item.
 * Factors: relevance (direct match bonus), recency, importance/severity,
 * project linkage, contradiction probability.
 */
function computeContextScore(opts: {
  relevance: number      // 0-1: direct match = 1.0, 1-hop = 0.6
  recencyDays: number    // days since last update/mention
  importance: number     // 0-1: severity/confidence/importance normalized
  hasProjectLink: boolean
  isContradiction: boolean
  isStrategic: boolean   // goal or high-severity insight
}): number {
  // Exponential decay: half-life of 14 days, floor at 0.05
  const recencyScore = Math.max(0.05, Math.exp(-0.693 * opts.recencyDays / 14))
  return (
    opts.relevance * 0.30 +
    recencyScore * 0.20 +
    opts.importance * 0.15 +
    (opts.hasProjectLink ? 0.12 : 0) +
    (opts.isContradiction ? 0.13 : 0) +
    (opts.isStrategic ? 0.10 : 0)
  )
}

function daysSince(date: Date): number {
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Retrieve entity-aware graph context for a user query.
 * Returns a formatted string block ready for system prompt injection,
 * or null if no relevant graph context was found.
 *
 * Performance: 3-4 parallel DB queries, no LLM calls, typically <50ms.
 */
export async function getGraphContext(
  userId: string,
  query: string,
  opts: { maxItems?: number; includeInsights?: boolean; includeContradictions?: boolean } = {}
): Promise<string | null> {
  const { maxItems = 12, includeInsights = true, includeContradictions = true } = opts
  const tokens = extractQueryTokens(query)
  if (tokens.length === 0) return null

  // ── Step 1: Match entities against query tokens (case-insensitive) ──
  // Use OR conditions for each token against entity names
  const matchedEntities = await prisma.cortexEntity.findMany({
    where: {
      userId,
      OR: tokens.map(t => ({ name: { contains: t, mode: 'insensitive' as const } })),
    },
    orderBy: { mentionCount: 'desc' },
    take: 20,
  })

  if (matchedEntities.length === 0 && !includeInsights) return null

  const matchedEntityIds = matchedEntities.map(e => e.id)
  const matchedEntityNames = new Set(matchedEntities.map(e => e.name.toLowerCase()))

  // ── Step 2: Parallel fetch — 1-hop edges, contradictions, insights, projects ──
  const [relations, contradictions, insights, projectLinks] = await Promise.all([
    // 1-hop relations for matched entities
    matchedEntityIds.length > 0
      ? prisma.cortexRelation.findMany({
          where: {
            userId,
            OR: [
              { sourceId: { in: matchedEntityIds } },
              { targetId: { in: matchedEntityIds } },
            ],
          },
          include: {
            source: { select: { id: true, name: true, nodeType: true, description: true, mentionCount: true, lastMentionedAt: true } },
            target: { select: { id: true, name: true, nodeType: true, description: true, mentionCount: true, lastMentionedAt: true } },
          },
          orderBy: { weight: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),

    // Active contradictions mentioning any matched entity name
    includeContradictions && matchedEntities.length > 0
      ? prisma.cortexContradiction.findMany({
          where: {
            userId,
            status: 'active',
            OR: tokens.flatMap(t => [
              { title: { contains: t } },
              { description: { contains: t } },
            ]),
          },
          orderBy: { severity: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),

    // Active insights (strategic drift, cognitive load, etc.)
    includeInsights
      ? prisma.cortexInsight.findMany({
          where: {
            userId,
            status: 'active',
          },
          orderBy: { confidence: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),

    // Projects linked to matched entities
    matchedEntityIds.length > 0
      ? prisma.cortexProjectLink.findMany({
          where: {
            entityType: 'entity',
            entityId: { in: matchedEntityIds },
          },
          include: {
            project: { select: { name: true, description: true, status: true, updatedAt: true } },
          },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  // ── Step 3: Build scored context items ──
  const items: GraphContextItem[] = []
  const seenProjects = new Set<string>()

  // Direct entity matches
  for (const entity of matchedEntities) {
    const desc = entity.description ? `: ${entity.description.slice(0, 120)}` : ''
    items.push({
      type: 'entity',
      text: `[${entity.nodeType.toUpperCase()}] ${entity.name}${desc} (mentioned ${entity.mentionCount}x)`,
      score: computeContextScore({
        relevance: 1.0,
        recencyDays: daysSince(entity.lastMentionedAt),
        importance: Math.min(1, entity.mentionCount / 20),
        hasProjectLink: false, // checked below
        isContradiction: false,
        isStrategic: entity.nodeType === 'goal',
      }),
    })
  }

  // 1-hop relations — surface the connected entity and edge type
  const seen1hop = new Set<string>()
  for (const rel of relations) {
    // Identify the "other" entity (the one we didn't directly match)
    const isSourceMatched = matchedEntityIds.includes(rel.sourceId)
    const other = isSourceMatched ? rel.target : rel.source
    const matched = isSourceMatched ? rel.source : rel.target
    const key = `${other.id}-${rel.edgeType}`
    if (seen1hop.has(key)) continue
    seen1hop.add(key)

    // Skip if the "other" entity was already directly matched
    if (matchedEntityNames.has(other.name.toLowerCase())) continue

    const direction = isSourceMatched
      ? `${matched.name} —[${rel.edgeType.replace(/_/g, ' ')}]→ ${other.name}`
      : `${other.name} —[${rel.edgeType.replace(/_/g, ' ')}]→ ${matched.name}`

    items.push({
      type: 'relation',
      text: `${direction} (weight: ${rel.weight.toFixed(1)})`,
      score: computeContextScore({
        relevance: 0.6,
        recencyDays: daysSince(other.lastMentionedAt),
        importance: Math.min(1, rel.weight / 5),
        hasProjectLink: false,
        isContradiction: false,
        isStrategic: other.nodeType === 'goal',
      }),
    })
  }

  // Contradictions
  const severityMap: Record<string, number> = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3 }
  for (const c of contradictions) {
    items.push({
      type: 'contradiction',
      text: `⚠ CONTRADICTION [${c.severity}]: ${c.title} — ${c.description.slice(0, 150)}`,
      score: computeContextScore({
        relevance: 0.85,
        recencyDays: daysSince(c.updatedAt),
        importance: severityMap[c.severity] ?? 0.5,
        hasProjectLink: false,
        isContradiction: true,
        isStrategic: c.severity === 'critical' || c.severity === 'high',
      }),
    })
  }

  // Active insights
  for (const ins of insights) {
    items.push({
      type: 'insight',
      text: `💡 INSIGHT [${ins.insightType.replace(/_/g, ' ')}]: ${ins.title} — ${ins.description.slice(0, 150)}`,
      score: computeContextScore({
        relevance: 0.5,
        recencyDays: daysSince(ins.updatedAt),
        importance: ins.confidence,
        hasProjectLink: false,
        isContradiction: false,
        isStrategic: ins.severity === 'critical' || ins.insightType === 'strategic_drift',
      }),
    })
  }

  // Project context
  for (const pl of projectLinks) {
    if (!pl.project || seenProjects.has(pl.project.name)) continue
    seenProjects.add(pl.project.name)
    const desc = pl.project.description ? `: ${pl.project.description.slice(0, 100)}` : ''
    items.push({
      type: 'project',
      text: `📁 PROJECT [${pl.project.status}]: ${pl.project.name}${desc}`,
      score: computeContextScore({
        relevance: 0.7,
        recencyDays: daysSince(pl.project.updatedAt),
        importance: pl.project.status === 'active' ? 0.8 : 0.3,
        hasProjectLink: true,
        isContradiction: false,
        isStrategic: true,
      }),
    })

    // Boost scores of entities linked to this project
    for (const item of items) {
      if (item.type === 'entity') {
        const entityName = item.text.split('] ')[1]?.split(':')[0]?.trim()
        if (entityName && pl.project.name.toLowerCase().includes(entityName.toLowerCase())) {
          item.score = Math.min(1, item.score + 0.12)
        }
      }
    }
  }

  // ── Step 4: Context Budgeting — Rank, Deduplicate, Compress, Token-Limit ──
  if (items.length === 0) return null

  // 4a: Deduplication — suppress items with semantically overlapping content
  const deduped = deduplicateContextItems(items)

  // 4b: Rank by composite score
  deduped.sort((a, b) => b.score - a.score)

  // 4c: Token-aware injection — stay within budget
  const TOKEN_BUDGET = 800 // ~800 tokens ≈ 3200 chars for graph context
  const CHAR_BUDGET = TOKEN_BUDGET * 4
  const selected: GraphContextItem[] = []
  let charCount = 0

  for (const item of deduped) {
    // Adaptive compression: truncate low-score items more aggressively
    let text = item.text
    if (item.score < 0.4 && text.length > 100) {
      text = text.slice(0, 100) + '…'
    } else if (item.score < 0.6 && text.length > 180) {
      text = text.slice(0, 180) + '…'
    }

    const lineLength = text.length + 1 // +1 for newline
    if (charCount + lineLength > CHAR_BUDGET) break

    selected.push({ ...item, text })
    charCount += lineLength
    if (selected.length >= maxItems) break
  }

  if (selected.length === 0) return null

  const block = selected.map(i => i.text).join('\n')
  return `Knowledge Graph Context (${selected.length} items, budget-managed):\n${block}`
}

/**
 * Suppress near-duplicate context items.
 * Uses normalized text fingerprinting to catch:
 *   - Same entity appearing as direct match AND in a relation
 *   - Overlapping contradiction/insight descriptions
 */
function deduplicateContextItems(items: GraphContextItem[]): GraphContextItem[] {
  const seen = new Set<string>()
  const result: GraphContextItem[] = []

  for (const item of items) {
    // Extract a fingerprint: lowercase, strip decoration, take first 60 chars
    const raw = item.text
      .replace(/[\[\]\(\)\{\}\u2500\u2014⚠💡📁]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    const fingerprint = raw.slice(0, 60)

    // Check for overlap with existing fingerprints
    let isDupe = false
    for (const existing of seen) {
      // If >70% character overlap in the fingerprint zone, it's a dupe
      if (fingerprint.length > 10 && existing.length > 10) {
        const shorter = fingerprint.length < existing.length ? fingerprint : existing
        const longer = fingerprint.length >= existing.length ? fingerprint : existing
        if (longer.includes(shorter.slice(0, 30))) {
          isDupe = true
          break
        }
      }
    }

    if (!isDupe) {
      seen.add(fingerprint)
      result.push(item)
    }
  }

  return result
}