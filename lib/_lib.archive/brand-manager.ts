import { prisma } from '@/lib/prisma'
import {
  routeForBackground,
  getBackgroundFallback,
  buildHeaders,
  buildRequestBody,
  type ModelConfig,
} from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'
import { getGmailClient, getCalendarClient } from '@/lib/google-api'
import { createHash } from 'crypto'

/**
 * Defensively parse voiceTone from DB — handles double-serialization.
 * If the stored value was accidentally JSON.stringify'd twice, this unwraps it.
 * Always returns a valid BrandVoice with array fields.
 */
function safeParseVoiceTone(raw: string | null): BrandVoice {
  const fallback: BrandVoice = { tone: [], personality: [], vocabulary: [], avoid: [] }
  if (!raw) return fallback
  try {
    let parsed = JSON.parse(raw)
    // If double-serialized, parsed will be a string — parse again
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { return fallback }
    }
    if (typeof parsed !== 'object' || parsed === null) return fallback
    return {
      tone: Array.isArray(parsed.tone) ? parsed.tone : [],
      personality: Array.isArray(parsed.personality) ? parsed.personality : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid : [],
    }
  } catch {
    return fallback
  }
}

export interface BrandVoice {
  tone: string[]        // e.g. ['authoritative', 'strategic', 'confident']
  personality: string[] // e.g. ['visionary', 'pragmatic', 'direct']
  vocabulary: string[]  // preferred terms
  avoid: string[]       // words/phrases to never use
}

export interface ConfidenceBreakdown {
  coverage: number     // 0-100: what % of weighted sources returned data
  freshness: number    // 0-100: quality-weighted freshness of available data
  anchorStrength: number // 0-100: how many anchor sources are present
  conflictPenalty: number // 0-100: deduction for detected signal conflicts
  composite: number    // 0-100: final derived confidence
}

export interface BrandAuditResult {
  type: string
  score: number // 0-100
  confidence: number // 0-100: evidence-derived, NOT LLM-invented
  confidenceBreakdown?: ConfidenceBreakdown
  findings: Array<{
    category: string
    status: 'strong' | 'moderate' | 'weak'
    detail: string
    recommendation?: string
    evidence?: string[] // specific data points supporting this finding
    confidence?: number // 0-100 confidence for this individual finding
  }>
  conflicts?: Array<{
    signalA: string
    signalB: string
    tension: string
    detectedBy: 'structural' | 'llm' // was this found by rules or by the model?
  }>
  summary: string
  contextSources?: string[] // tracks which data sources were used
  telemetry?: ContextTelemetry
}

// ─── Context Utilization Telemetry ─────────────────────────────────

export interface ContextTelemetry {
  totalSourcesAttempted: number
  sourcesReturned: number
  sourcesTruncated: number
  sourcesDropped: number  // hit global budget ceiling
  totalCharsRaw: number
  totalCharsBudgeted: number
  budgetUtilization: number // 0-100%
  auditType: string
  weightProfile: string // which weight profile was used
  structuralConflictsDetected: number
}

// ─── Context Weighting & Budget System ─────────────────────────────

/**
 * Each context source has:
 *  - weight: base importance (0-1). Profile/goals dominate; transient signals are lower.
 *  - freshnessHorizon: how far back the data reaches (days). Used for temporal decay.
 *  - budgetChars: max characters allocated in the prompt. Prevents context explosion.
 *  - tier: 'anchor' sources shape the analysis frame; 'signal' sources provide evidence.
 */
interface SourceConfig {
  key: string
  label: string
  weight: number           // 0-1 base importance
  freshnessHorizon: number // days of coverage
  budgetChars: number      // max chars in assembled prompt
  tier: 'anchor' | 'signal'
}

const SOURCE_CONFIGS: SourceConfig[] = [
  // Anchors — shape the analysis frame, highest weight
  { key: 'activeGoals',     label: 'Profile',          weight: 1.0,  freshnessHorizon: 365, budgetChars: 800,  tier: 'anchor' },
  { key: 'cortexPatterns',  label: 'Cortex Patterns',  weight: 0.9,  freshnessHorizon: 90,  budgetChars: 700,  tier: 'anchor' },
  { key: 'memories',        label: 'Memories',         weight: 0.85, freshnessHorizon: 180, budgetChars: 700,  tier: 'anchor' },
  // Signals — provide evidence, modulated by freshness
  { key: 'cortexInsights',  label: 'Cortex Insights',  weight: 0.75, freshnessHorizon: 30,  budgetChars: 500,  tier: 'signal' },
  { key: 'recentTasks',     label: 'Tasks',             weight: 0.65, freshnessHorizon: 14,  budgetChars: 500,  tier: 'signal' },
  { key: 'upcomingCalendar',label: 'Calendar',          weight: 0.6,  freshnessHorizon: 14,  budgetChars: 500,  tier: 'signal' },
  { key: 'recentEmails',    label: 'Gmail',             weight: 0.5,  freshnessHorizon: 7,   budgetChars: 500,  tier: 'signal' },
]

const TOTAL_CONTEXT_BUDGET = 4200 // chars — hard ceiling to prevent prompt noise

// ─── Audit-Type-Specific Weight Profiles ───────────────────────────

/**
 * Weight multipliers per audit type. Applied on top of base SOURCE_CONFIGS weights.
 * Values > 1.0 boost a source for that audit; < 1.0 suppress it.
 * This prevents email-heavy prompts for competitor scans or calendar-light prompts
 * for strategic alignment where schedule data is critical.
 */
type AuditType = 'voice_check' | 'competitor_scan' | 'content_review' | 'strategic_alignment'

const WEIGHT_PROFILES: Record<AuditType, Partial<Record<string, number>>> = {
  voice_check: {
    recentEmails: 1.6,    // email tone IS the voice evidence
    cortexPatterns: 1.2,  // behavioral consistency matters
    upcomingCalendar: 0.5, // calendar less relevant for voice
    recentTasks: 0.6,
  },
  competitor_scan: {
    recentEmails: 0.4,     // emails rarely contain competitive intel
    activeGoals: 1.3,      // positioning against competitors needs clear goals
    cortexInsights: 1.3,   // strategic insights highly relevant
    upcomingCalendar: 0.5,
  },
  content_review: {
    upcomingCalendar: 1.4, // content should align with upcoming events
    recentTasks: 1.2,      // tasks reveal what's actionable for content
    cortexPatterns: 1.1,
    recentEmails: 0.7,
  },
  strategic_alignment: {
    upcomingCalendar: 1.5, // calendar = how time is actually spent
    recentTasks: 1.3,      // tasks = what's being prioritized
    recentEmails: 1.2,     // emails = who you're communicating with
    cortexPatterns: 1.3,   // patterns = behavioral reality
    memories: 1.1,
  },
}

function getEffectiveWeight(config: SourceConfig, auditType: AuditType): number {
  const multiplier = WEIGHT_PROFILES[auditType]?.[config.key] ?? 1.0
  return Math.min(config.weight * multiplier, 1.5) // cap at 1.5 to prevent runaway
}

/**
 * Compute a stable version hash of the weight configuration surface.
 * Stored with every BrandAudit record so profile changes can be correlated
 * with output distribution shifts. Query pattern:
 *   SELECT weightProfileVersion, AVG(score), COUNT(*) FROM "BrandAudit"
 *     WHERE type NOT LIKE 'ablation_%'
 *     GROUP BY weightProfileVersion
 *   Note: Ablation runs are now stored in BrandAblation (separate table), but filter
 *   ablation_ types in BrandAudit for any legacy records.
 */
function computeWeightProfileVersion(): string {
  const surface = {
    sourceWeights: SOURCE_CONFIGS.map(s => ({ key: s.key, weight: s.weight, budget: s.budgetChars, tier: s.tier })),
    profiles: WEIGHT_PROFILES,
    totalBudget: TOTAL_CONTEXT_BUDGET,
  }
  return createHash('sha256').update(JSON.stringify(surface)).digest('hex').slice(0, 16)
}

/** Cached at module load — only changes when code changes */
const WEIGHT_PROFILE_VERSION = computeWeightProfileVersion()

/** Exposed for ablation API — lists valid source keys that can be excluded */
export const AVAILABLE_SOURCE_KEYS = SOURCE_CONFIGS.map(s => s.key)
export { WEIGHT_PROFILE_VERSION }

interface ContextEntry {
  config: SourceConfig
  effectiveWeight: number
  raw: string | null
  truncated: string | null
  charCount: number
  freshness: 'current' | 'recent' | 'aging' | 'stale'
  wasTruncated: boolean
}

// ─── Structural Conflict Detection ─────────────────────────────────

interface StructuralConflict {
  signalA: string
  signalB: string
  tension: string
  detectedBy: 'structural'
}

/**
 * Pre-LLM structural analysis: detect contradictions between data sources
 * using rule-based heuristics. These are injected into the prompt AND
 * into the result, so the LLM doesn't need to independently discover them.
 */
function detectStructuralConflicts(entries: ContextEntry[]): StructuralConflict[] {
  const conflicts: StructuralConflict[] = []
  const dataByKey: Record<string, string> = {}
  for (const e of entries) {
    if (e.truncated) dataByKey[e.config.key] = e.truncated
  }

  const goals = dataByKey.activeGoals?.toLowerCase() || ''
  const tasks = dataByKey.recentTasks?.toLowerCase() || ''
  const calendar = dataByKey.upcomingCalendar?.toLowerCase() || ''
  const patterns = dataByKey.cortexPatterns?.toLowerCase() || ''
  const emails = dataByKey.recentEmails?.toLowerCase() || ''

  // Rule 1: Goals mention focus areas that tasks don't reflect
  if (goals && tasks) {
    // Extract key goal terms (words after "objectives:")
    const goalTerms = extractKeyTerms(goals)
    const taskTerms = extractKeyTerms(tasks)
    const missingInTasks = goalTerms.filter(g => !taskTerms.some(t => t.includes(g) || g.includes(t)))
    if (missingInTasks.length >= 2 && goalTerms.length >= 3) {
      conflicts.push({
        signalA: `Profile: objectives mention "${missingInTasks.slice(0, 3).join('", "')}"`,
        signalB: 'Tasks: no active tasks address these objective areas',
        tension: 'Stated priorities are not reflected in current task allocation — possible strategic drift',
        detectedBy: 'structural',
      })
    }
  }

  // Rule 2: Calendar is heavily loaded but tasks show low completion
  if (calendar && tasks) {
    const calendarLines = calendar.split('\n').filter(l => l.trim().startsWith('-')).length
    const completedTasks = (tasks.match(/\[completed/gi) || []).length
    const totalTasks = tasks.split('\n').filter(l => l.trim().startsWith('-')).length
    if (calendarLines > 8 && totalTasks > 5 && completedTasks < totalTasks * 0.2) {
      conflicts.push({
        signalA: `Calendar: ${calendarLines} events in next 14 days (high density)`,
        signalB: `Tasks: only ${completedTasks}/${totalTasks} tasks completed`,
        tension: 'Heavy calendar commitments with low task completion — potential overcommitment or priority misalignment',
        detectedBy: 'structural',
      })
    }
  }

  // Rule 3: Cortex patterns suggest avoidance but calendar/tasks show engagement
  if (patterns && (calendar || tasks)) {
    if (patterns.includes('avoidance') && (calendar.split('\n').length > 5 || tasks.split('\n').length > 8)) {
      conflicts.push({
        signalA: 'Cortex Patterns: avoidance pattern detected',
        signalB: `Calendar/Tasks: active engagement (${calendar.split('\n').filter(l => l.trim()).length} events, ${tasks.split('\n').filter(l => l.trim()).length} tasks)`,
        tension: 'Behavioral avoidance pattern conflicts with high operational activity — may indicate displacement behavior',
        detectedBy: 'structural',
      })
    }
  }

  // Rule 4: Email communication volume vs stated working style
  if (emails && goals) {
    const emailCount = emails.split('\n').filter(l => l.trim().startsWith('-')).length
    if (goals.includes('deep work') || goals.includes('focus') || goals.includes('minimize meetings')) {
      if (emailCount >= 6) {
        conflicts.push({
          signalA: 'Profile: working style emphasizes deep work/focus',
          signalB: `Gmail: ${emailCount} recent emails suggest high communication volume`,
          tension: 'Stated preference for focused work conflicts with high email engagement volume',
          detectedBy: 'structural',
        })
      }
    }
  }

  return conflicts
}

/** Extract meaningful terms from a text block for comparison */
function extractKeyTerms(text: string): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'not', 'but', 'have', 'has'])
  return text
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w))
    .slice(0, 20)
}

// ─── Evidence-Derived Confidence Scoring ───────────────────────────

function computeConfidenceBreakdown(
  entries: ContextEntry[],
  structuralConflicts: StructuralConflict[]
): ConfidenceBreakdown {
  // 1. Coverage: weighted % of sources that returned data
  const maxWeight = SOURCE_CONFIGS.reduce((sum, s) => sum + s.weight, 0)
  const activeWeight = entries.reduce((sum, e) => sum + e.effectiveWeight, 0)
  const coverage = Math.round((activeWeight / maxWeight) * 100)

  // 2. Freshness: weighted average of freshness quality
  const freshnessScores: Record<string, number> = {
    current: 100, recent: 75, aging: 40, stale: 15
  }
  const freshness = entries.length > 0
    ? Math.round(
        entries.reduce((sum, e) => sum + freshnessScores[e.freshness] * e.effectiveWeight, 0) /
        entries.reduce((sum, e) => sum + e.effectiveWeight, 0)
      )
    : 0

  // 3. Anchor strength: are the identity-stable sources present?
  const anchorSources = entries.filter(e => e.config.tier === 'anchor')
  const totalAnchors = SOURCE_CONFIGS.filter(s => s.tier === 'anchor').length
  const anchorStrength = Math.round((anchorSources.length / totalAnchors) * 100)

  // 4. Conflict penalty: more unresolved structural conflicts = less reliable
  const conflictPenalty = Math.min(structuralConflicts.length * 8, 30) // max 30 point deduction

  // Composite: weighted formula
  // Coverage and anchor strength are most important (they determine if we have data to reason about)
  // Freshness matters but less so. Conflicts reduce confidence.
  const composite = Math.max(0, Math.min(100, Math.round(
    coverage * 0.35 +
    anchorStrength * 0.30 +
    freshness * 0.20 +
    (100 - conflictPenalty) * 0.15
  )))

  return { coverage, freshness, anchorStrength, conflictPenalty, composite }
}

interface OperationalContext {
  entries: ContextEntry[]
  sources: string[]          // which sources returned data
  totalWeight: number        // sum of active source weights (quality indicator)
  confidenceScore: number    // 0-100: evidence-derived composite
  confidenceBreakdown: ConfidenceBreakdown
  structuralConflicts: StructuralConflict[]
  telemetry: ContextTelemetry
}

/**
 * Compute temporal freshness tag based on the source's horizon.
 * Anchors with long horizons are always 'current' (they represent stable identity).
 * Signals decay faster — 'current' within 25% of horizon, 'aging' beyond 75%.
 */
function computeFreshness(config: SourceConfig): ContextEntry['freshness'] {
  if (config.tier === 'anchor') return 'current' // anchors are identity-stable
  // For signals, freshness degrades linearly with horizon breadth
  if (config.freshnessHorizon <= 7) return 'current'
  if (config.freshnessHorizon <= 14) return 'recent'
  if (config.freshnessHorizon <= 60) return 'aging'
  return 'stale'
}

/**
 * Truncate text to a character budget, preserving complete lines.
 */
function truncateToBudget(text: string, budget: number): string {
  if (text.length <= budget) return text
  const lines = text.split('\n')
  let result = ''
  for (const line of lines) {
    if ((result + line + '\n').length > budget - 20) break // leave room for truncation note
    result += line + '\n'
  }
  return result.trimEnd() + '\n  [... truncated to budget]'
}

/**
 * Gather operational context from across SETH's systems.
 * 
 * KEY DESIGN DECISIONS:
 * 1. WEIGHTING: Sources are ranked by strategic importance. Profile/Cortex (anchor)
 *    shape the frame; Email/Calendar/Tasks (signal) provide temporal evidence.
 * 2. TEMPORAL: Each source tagged with freshness. LLM is instructed to weight
 *    accordingly — stale signals should not override fresh anchor data.
 * 3. BUDGETING: Each source has a character ceiling. Total context has a hard cap.
 *    Prevents low-weight sources from consuming disproportionate prompt space.
 * 4. ORDERING: Anchors first (identity frame), then signals descending by weight.
 */
export interface ContextOptions {
  auditType?: AuditType
  /** Source keys to exclude (ablation testing). e.g. ['recentEmails', 'upcomingCalendar'] */
  sourceExclusions?: string[]
  /** Shuffle context insertion order to test position sensitivity. Weights unchanged. */
  shuffleOrder?: boolean
  /** Pin LLM temperature. 0 = deterministic (for ablation). undefined = model default. */
  temperature?: number
}

async function gatherOperationalContext(
  userId: string,
  request?: Request,
  auditTypeOrOpts: AuditType | ContextOptions = 'voice_check'
): Promise<OperationalContext> {
  // Normalize args: accept either a simple auditType string or a full options object
  const opts: ContextOptions = typeof auditTypeOrOpts === 'string'
    ? { auditType: auditTypeOrOpts }
    : auditTypeOrOpts
  const auditType = opts.auditType ?? 'voice_check'
  const sourceExclusions = new Set(opts.sourceExclusions ?? [])
  const shuffleOrder = opts.shuffleOrder ?? false
  // Build fetchers keyed by source config key
  const fetchers: Record<string, () => Promise<string | null>> = {
    recentEmails: async () => {
      if (!request) return null
      try {
        const gmail = await getGmailClient(request)
        if (!gmail) return null
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 10,
          labelIds: ['INBOX'],
        })
        const msgIds = listRes.data.messages ?? []
        if (msgIds.length === 0) return null
        
        const summaries: string[] = []
        for (const msg of msgIds.slice(0, 8)) {
          try {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date'],
            })
            const headers = detail.data.payload?.headers ?? []
            const from = headers.find(h => h.name === 'From')?.value ?? ''
            const subject = headers.find(h => h.name === 'Subject')?.value ?? ''
            const date = headers.find(h => h.name === 'Date')?.value ?? ''
            const ageLabel = getEmailAgeLabel(date)
            summaries.push(`- ${subject} (from: ${from.split('<')[0].trim()}, ${ageLabel})`)
          } catch {}
        }
        return summaries.length > 0 ? summaries.join('\n') : null
      } catch {
        return null
      }
    },

    upcomingCalendar: async () => {
      if (!request) return null
      try {
        const calendar = await getCalendarClient(request)
        if (!calendar) return null
        const now = new Date()
        const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          maxResults: 15,
          singleEvents: true,
          orderBy: 'startTime',
        })
        const events = res.data.items ?? []
        if (events.length === 0) return null
        return events.map(e => {
          const start = e.start?.dateTime || e.start?.date || ''
          const daysOut = start ? Math.ceil((new Date(start).getTime() - now.getTime()) / (86400000)) : 0
          const proximity = daysOut <= 2 ? '[IMMINENT]' : daysOut <= 7 ? '[this week]' : '[next week+]'
          return `- ${proximity} ${e.summary ?? 'Untitled'} (${start}${e.location ? `, ${e.location}` : ''})`
        }).join('\n')
      } catch {
        return null
      }
    },

    activeGoals: async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { objectives: true, preferences: true, workingStyle: true },
        })
        if (!user) return null
        const parts: string[] = []
        if (user.objectives) parts.push(`Objectives: ${user.objectives}`)
        if (user.preferences) parts.push(`Preferences: ${user.preferences}`)
        if (user.workingStyle) parts.push(`Working Style: ${user.workingStyle}`)
        return parts.length > 0 ? parts.join('\n') : null
      } catch {
        return null
      }
    },

    recentTasks: async () => {
      try {
        const tasks = await prisma.task.findMany({
          where: { userId, status: { not: 'archived' } },
          orderBy: { updatedAt: 'desc' },
          take: 15,
          select: { title: true, status: true, priority: true, dueDate: true, updatedAt: true },
        })
        if (tasks.length === 0) return null
        const now = new Date()
        return tasks.map(t => {
          const due = t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleDateString()})` : ''
          const age = Math.floor((now.getTime() - new Date(t.updatedAt).getTime()) / 86400000)
          const freshTag = age <= 1 ? '[today]' : age <= 3 ? '[recent]' : age <= 7 ? '[this week]' : `[${age}d ago]`
          return `- ${freshTag} [${t.status}/${t.priority}] ${t.title}${due}`
        }).join('\n')
      } catch {
        return null
      }
    },

    memories: async () => {
      try {
        const memories = await prisma.memory.findMany({
          where: { userId, importance: { gte: 7 } },
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: { type: true, content: true, tags: true, updatedAt: true },
        })
        if (memories.length === 0) return null
        const now = new Date()
        return memories.map(m => {
          const tags = m.tags ? ` [${JSON.parse(m.tags).join(', ')}]` : ''
          const ageDays = Math.floor((now.getTime() - new Date(m.updatedAt).getTime()) / 86400000)
          const ageTag = ageDays <= 7 ? '[recent]' : ageDays <= 30 ? `[${ageDays}d ago]` : `[${Math.floor(ageDays / 30)}mo ago]`
          return `- ${ageTag} (${m.type}) ${m.content.slice(0, 200)}${tags}`
        }).join('\n')
      } catch {
        return null
      }
    },

    cortexPatterns: async () => {
      try {
        const patterns = await prisma.cortexPattern.findMany({
          where: { userId },
          orderBy: { confidence: 'desc' },
          take: 8,
          select: { title: true, description: true, confidence: true, patternType: true, updatedAt: true },
        })
        if (patterns.length === 0) return null
        const now = new Date()
        return patterns.map(p => {
          const ageDays = Math.floor((now.getTime() - new Date(p.updatedAt).getTime()) / 86400000)
          const ageTag = ageDays <= 14 ? '[active]' : ageDays <= 60 ? '[established]' : '[long-term]'
          return `- ${ageTag} [${p.patternType}] ${p.title}: ${p.description.slice(0, 150)} (confidence: ${(p.confidence * 100).toFixed(0)}%)`
        }).join('\n')
      } catch {
        return null
      }
    },

    cortexInsights: async () => {
      try {
        const insights = await prisma.cortexInsight.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { insightType: true, title: true, description: true, severity: true, createdAt: true },
        })
        if (insights.length === 0) return null
        const now = new Date()
        return insights.map(i => {
          const ageDays = Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86400000)
          const ageTag = ageDays <= 7 ? '[fresh]' : ageDays <= 30 ? `[${ageDays}d ago]` : '[aging]'
          return `- ${ageTag} [${i.insightType}/${i.severity}] ${i.title}: ${i.description.slice(0, 200)}`
        }).join('\n')
      } catch {
        return null
      }
    },
  }

  // Filter out excluded sources (ablation testing)
  const activeSources = SOURCE_CONFIGS.filter(c => !sourceExclusions.has(c.key))

  // Execute all fetchers in parallel
  const fetchPromises = activeSources.map(config => 
    fetchers[config.key]().catch(() => null)
  )
  const rawResults = await Promise.allSettled(fetchPromises)

  // Build weighted, budgeted entries — sorted by effective weight for this audit type
  const sourceResults = activeSources.map((config, i) => ({
    config,
    effectiveWeight: getEffectiveWeight(config, auditType),
    rawValue: rawResults[i].status === 'fulfilled' ? (rawResults[i] as PromiseFulfilledResult<string | null>).value : null,
  }))

  if (shuffleOrder) {
    // Fisher-Yates shuffle — weights unchanged, only insertion order randomized
    for (let i = sourceResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sourceResults[i], sourceResults[j]] = [sourceResults[j], sourceResults[i]]
    }
  } else {
    // Default: sort by effective weight descending so high-priority sources get budget first
    sourceResults.sort((a, b) => b.effectiveWeight - a.effectiveWeight)
  }

  const entries: ContextEntry[] = []
  const sources: string[] = []
  let usedBudget = 0
  let totalCharsRaw = 0
  let sourcesTruncated = 0
  let sourcesDropped = 0

  for (const { config, effectiveWeight, rawValue } of sourceResults) {
    if (!rawValue) continue
    totalCharsRaw += rawValue.length

    // Enforce per-source and global budget
    const remainingGlobal = TOTAL_CONTEXT_BUDGET - usedBudget
    const effectiveBudget = Math.min(config.budgetChars, remainingGlobal)

    if (effectiveBudget <= 50) {
      sourcesDropped++
      continue // source data exists but global budget exhausted
    }

    const wasTruncated = rawValue.length > effectiveBudget
    const truncated = truncateToBudget(rawValue, effectiveBudget)
    if (wasTruncated) sourcesTruncated++

    entries.push({
      config,
      effectiveWeight,
      raw: rawValue,
      truncated,
      charCount: truncated.length,
      freshness: computeFreshness(config),
      wasTruncated,
    })
    usedBudget += truncated.length
    sources.push(config.label)
  }

  // Structural conflict detection (pre-LLM)
  const structuralConflicts = detectStructuralConflicts(entries)

  // Evidence-derived confidence (NOT LLM-generated)
  const confidenceBreakdown = computeConfidenceBreakdown(entries, structuralConflicts)

  // Telemetry
  const telemetry: ContextTelemetry = {
    totalSourcesAttempted: activeSources.length,
    sourcesReturned: entries.length + sourcesDropped,
    sourcesTruncated,
    sourcesDropped,
    totalCharsRaw,
    totalCharsBudgeted: usedBudget,
    budgetUtilization: Math.round((usedBudget / TOTAL_CONTEXT_BUDGET) * 100),
    auditType,
    weightProfile: auditType,
    structuralConflictsDetected: structuralConflicts.length,
  }

  // Log telemetry server-side
  const telemetryLog: Record<string, unknown> = { ...telemetry, profileVersion: WEIGHT_PROFILE_VERSION }
  if (sourceExclusions.size > 0) telemetryLog.ablation = Array.from(sourceExclusions)
  if (shuffleOrder) telemetryLog.positionShuffled = true
  console.log('[Brand Context Telemetry]', JSON.stringify(telemetryLog))

  return {
    entries,
    sources,
    totalWeight: entries.reduce((sum, e) => sum + e.effectiveWeight, 0),
    confidenceScore: confidenceBreakdown.composite,
    confidenceBreakdown,
    structuralConflicts,
    telemetry,
  }
}

/** Convert email date string to relative age label */
function getEmailAgeLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const hours = Math.floor((Date.now() - date.getTime()) / 3600000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'yesterday'
    return `${days}d ago`
  } catch {
    return dateStr
  }
}

const SECTION_HEADERS: Record<string, string> = {
  activeGoals: 'USER PROFILE & GOALS',
  cortexPatterns: 'BEHAVIORAL PATTERNS (Cortex)',
  memories: 'KEY MEMORIES & DECISIONS',
  cortexInsights: 'STRATEGIC INSIGHTS (Cortex)',
  recentTasks: 'ACTIVE TASKS',
  upcomingCalendar: 'UPCOMING CALENDAR',
  recentEmails: 'RECENT EMAIL COMMUNICATIONS',
}

function buildContextBlock(ctx: OperationalContext): string {
  if (ctx.entries.length === 0) return ''

  // Separate anchors and signals for explicit hierarchy
  const anchors = ctx.entries.filter(e => e.config.tier === 'anchor')
  const signals = ctx.entries.filter(e => e.config.tier === 'signal')

  const sections: string[] = []

  if (anchors.length > 0) {
    sections.push('=== ANCHOR CONTEXT (identity-stable, high weight) ===')
    for (const entry of anchors) {
      const header = SECTION_HEADERS[entry.config.key] || entry.config.label
      const truncNote = entry.wasTruncated ? ' [TRUNCATED]' : ''
      sections.push(`--- ${header} [effective weight: ${entry.effectiveWeight.toFixed(2)}, freshness: ${entry.freshness}]${truncNote} ---\n${entry.truncated}`)
    }
  }

  if (signals.length > 0) {
    sections.push('\n=== SIGNAL CONTEXT (temporal evidence, audit-adjusted weights) ===')
    for (const entry of signals) {
      const header = SECTION_HEADERS[entry.config.key] || entry.config.label
      const truncNote = entry.wasTruncated ? ' [TRUNCATED]' : ''
      sections.push(`--- ${header} [effective weight: ${entry.effectiveWeight.toFixed(2)}, freshness: ${entry.freshness}, horizon: ${entry.config.freshnessHorizon}d]${truncNote} ---\n${entry.truncated}`)
    }
  }

  // Inject structural conflicts so the LLM addresses them
  let conflictSection = ''
  if (ctx.structuralConflicts.length > 0) {
    const conflictLines = ctx.structuralConflicts.map((c, i) =>
      `  ${i + 1}. ${c.signalA} vs ${c.signalB}\n     Tension: ${c.tension}`
    ).join('\n')
    conflictSection = `\n\n=== SIGNALS TO INVESTIGATE (structural hypotheses — confirm, contextualize, or dismiss) ===\n${conflictLines}`
  }

  const { confidenceBreakdown: cb } = ctx
  const preamble = `\n\n--- OPERATIONAL CONTEXT (weighted cross-system intelligence) ---
SYSTEM CONFIDENCE: ${ctx.confidenceScore}% (coverage: ${cb.coverage}%, freshness: ${cb.freshness}%, anchors: ${cb.anchorStrength}%, conflict penalty: -${cb.conflictPenalty})
WEIGHT PROFILE: ${ctx.telemetry.weightProfile} (weights are audit-type-adjusted)

CONTEXT WEIGHTING INSTRUCTIONS:
- ANCHOR sources define the user's stable identity. These FRAME the analysis.
- SIGNAL sources provide temporal evidence. Weight by freshness tags:
  [today]/[just now]/[IMMINENT] = high | [recent]/[this week] = moderate | [aging]/[Xd ago] = low | [stale] = minimal
- Effective weights shown per-source are already audit-type-adjusted. Higher weight = more influence.
- SIGNALS TO INVESTIGATE (if any) are structural hypotheses, not confirmed problems. Confirm, contextualize, or dismiss each one.
- If you detect ADDITIONAL conflicts beyond the pre-identified signals, surface them with detectedBy: "llm".
`

  return `${preamble}\n${sections.join('\n\n')}${conflictSection}\n--- END OPERATIONAL CONTEXT ---`
}

// ─── LLM Call Helper ───────────────────────────────────────────────

async function callLLM(
  prompt: string,
  systemPrompt: string,
  userId: string,
  auditType: string,
  temperature?: number
): Promise<string> {
  let config: ModelConfig = routeForBackground()
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]

  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const headers = buildHeaders(config)
      const body = buildRequestBody(config, messages, { maxTokens: 3000, temperature })
      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const fallback = getBackgroundFallback(config.model)
        if (fallback) { config = fallback; continue }
        throw new Error(`LLM API error: ${res.status}`)
      }
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      
      logAgentActivity({
        userId,
        action: 'brand_audit',
        tier: config.tier,
        model: config.model,
        provider: config.provider,
        metadata: { auditType },
      })
      
      return content
    } catch (err: any) {
      const fallback = getBackgroundFallback(config.model)
      if (fallback && attempt < maxAttempts - 1) { config = fallback; continue }
      throw err
    }
  }
  throw new Error('All LLM attempts failed')
}

// ─── Brand Voice Check ─────────────────────────────────────────────

export async function runVoiceCheck(
  brandProfileId: string,
  userId: string,
  contentToCheck: string,
  request?: Request,
  contextOverrides?: Partial<ContextOptions>
): Promise<BrandAuditResult> {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } })
  if (!brand) throw new Error('Brand profile not found')

  const voice: BrandVoice = safeParseVoiceTone(brand.voiceTone)
  const ctx = await gatherOperationalContext(userId, request, { auditType: 'voice_check', ...contextOverrides })
  const contextBlock = buildContextBlock(ctx)

  const systemPrompt = `You are an elite brand voice analyst with deep expertise in executive communications, brand psychology, and strategic positioning. You have access to the user's full operational context — their emails, calendar, tasks, goals, and behavioral patterns — which you MUST use to provide hyper-personalized, contextually grounded feedback.

Your analysis should not be generic. Reference specific elements from the operational context to show how the content aligns (or conflicts) with the user's actual communication patterns, upcoming commitments, and strategic priorities.

Return ONLY valid JSON (no markdown fences).`

  const prompt = `Brand: ${brand.brandName}
Brand Voice Guidelines:
- Tone: ${voice.tone.join(', ') || 'Not defined'}
- Personality: ${voice.personality.join(', ') || 'Not defined'}
- Preferred vocabulary: ${voice.vocabulary.join(', ') || 'Not defined'}
- Words to avoid: ${voice.avoid.join(', ') || 'Not defined'}
- Brand values: ${brand.brandValues || 'Not defined'}
- Positioning: ${brand.positioning || 'Not defined'}
- Target Audience: ${brand.targetAudience || 'Not defined'}
- Mission: ${brand.mission || 'Not defined'}${contextBlock}

Content to evaluate:
"""${contentToCheck}"""

Analyze this content against BOTH the brand voice guidelines AND the operational context. Consider:
1. Does this content align with the user's actual communication style visible in their emails?
2. Does it support or conflict with their current goals and strategic priorities?
3. Is the timing appropriate given upcoming calendar commitments?
4. Does it reinforce the behavioral patterns Cortex has detected?

Return JSON: {
  "score": <0-100>,
  "confidence": <0-100, how confident you are in this score given available data>,
  "findings": [{ "category": "...", "status": "strong|moderate|weak", "detail": "...", "recommendation": "...", "evidence": ["specific data point 1", "specific data point 2"], "confidence": <0-100> }],
  "conflicts": [{ "signalA": "source + data point", "signalB": "source + data point", "tension": "what the conflict implies" }],
  "summary": "..."
}`

  const raw = await callLLM(prompt, systemPrompt, userId, 'voice_check', contextOverrides?.temperature)
  
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    // Merge structural + LLM conflicts, tag LLM ones
    const llmConflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map((c: any) => ({ ...c, detectedBy: c.detectedBy || 'llm' as const }))
      : []
    const allConflicts = [
      ...ctx.structuralConflicts,
      ...llmConflicts.filter((lc: any) =>
        !ctx.structuralConflicts.some(sc => sc.tension === lc.tension)
      ),
    ]

    const result: BrandAuditResult = {
      type: 'voice_check',
      score: Number(parsed.score) || 0,
      confidence: ctx.confidenceScore, // evidence-derived, NOT from LLM
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      conflicts: allConflicts,
      summary: parsed.summary || '',
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }

    await prisma.brandAudit.create({
      data: {
        brandProfileId,
        type: 'voice_check',
        input: contentToCheck.slice(0, 2000),
        result: JSON.stringify(result),
        score: result.score,
        weightProfileVersion: WEIGHT_PROFILE_VERSION,
      },
    })

    return result
  } catch {
    return {
      type: 'voice_check',
      score: 0,
      confidence: ctx.confidenceScore,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: [{ category: 'Parse Error', status: 'weak', detail: 'Could not parse LLM response', recommendation: 'Try again' }],
      summary: raw.slice(0, 500),
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }
  }
}

// ─── Competitor Analysis ───────────────────────────────────────────

export async function runCompetitorScan(
  brandProfileId: string,
  userId: string,
  competitorName?: string,
  request?: Request,
  contextOverrides?: Partial<ContextOptions>
): Promise<BrandAuditResult> {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } })
  if (!brand) throw new Error('Brand profile not found')

  const competitors = brand.competitors ? JSON.parse(brand.competitors) : []
  const target = competitorName || (competitors.length > 0 ? competitors.map((c: any) => c.name || c).join(', ') : 'general market')
  const ctx = await gatherOperationalContext(userId, request, { auditType: 'competitor_scan', ...contextOverrides })
  const contextBlock = buildContextBlock(ctx)

  const systemPrompt = `You are a competitive intelligence analyst specializing in brand positioning, market differentiation, and strategic advantage. You have access to the user's full operational context — their goals, tasks, communications, and behavioral intelligence — which you MUST use to provide actionable competitive insights grounded in the user's actual situation.

Do not give generic competitive analysis. Use the operational context to identify specific opportunities where the user's current activities, relationships, or strategic direction give them unique competitive advantages or expose blind spots.

Return ONLY valid JSON.`

  const prompt = `Analyze the competitive landscape for:

Our Brand: ${brand.brandName}
Tagline: ${brand.tagline || 'N/A'}
Positioning: ${brand.positioning || 'N/A'}
Target Audience: ${brand.targetAudience || 'N/A'}
Content Pillars: ${brand.contentPillars || 'N/A'}
Mission: ${brand.mission || 'N/A'}
Vision: ${brand.vision || 'N/A'}${contextBlock}

Competitors to analyze: ${target}

Using the brand profile AND operational context, analyze:
1. Where does the user's current activity create natural competitive advantages?
2. What upcoming commitments or relationships could be leveraged for differentiation?
3. What gaps exist between stated positioning and actual operational behavior?
4. What competitor moves should the user preempt given their current trajectory?

Return JSON: {
  "score": <0-100 brand differentiation score>,
  "confidence": <0-100, how confident you are given available data>,
  "findings": [{ "category": "Differentiation|Messaging|Audience Overlap|Threat Level|Opportunity|Strategic Alignment", "status": "strong|moderate|weak", "detail": "...", "recommendation": "...", "evidence": ["specific data points"], "confidence": <0-100> }],
  "conflicts": [{ "signalA": "source + data", "signalB": "source + data", "tension": "what conflict implies" }],
  "summary": "..."
}`

  const raw = await callLLM(prompt, systemPrompt, userId, 'competitor_scan', contextOverrides?.temperature)
  
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const llmConflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map((c: any) => ({ ...c, detectedBy: c.detectedBy || 'llm' as const }))
      : []
    const allConflicts = [
      ...ctx.structuralConflicts,
      ...llmConflicts.filter((lc: any) => !ctx.structuralConflicts.some(sc => sc.tension === lc.tension)),
    ]
    const result: BrandAuditResult = {
      type: 'competitor_scan',
      score: Number(parsed.score) || 0,
      confidence: ctx.confidenceScore,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      conflicts: allConflicts,
      summary: parsed.summary || '',
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }

    await prisma.brandAudit.create({
      data: {
        brandProfileId,
        type: 'competitor_scan',
        input: `Competitors: ${target}`,
        result: JSON.stringify(result),
        score: result.score,
        weightProfileVersion: WEIGHT_PROFILE_VERSION,
      },
    })

    return result
  } catch {
    return {
      type: 'competitor_scan',
      score: 0,
      confidence: ctx.confidenceScore,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: [{ category: 'Parse Error', status: 'weak', detail: 'Could not parse analysis', recommendation: 'Try again' }],
      summary: raw.slice(0, 500),
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }
  }
}

// ─── Content Strategy Generation ───────────────────────────────────

export async function generateContentStrategy(
  brandProfileId: string,
  userId: string,
  request?: Request,
  contextOverrides?: Partial<ContextOptions>
): Promise<BrandAuditResult> {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } })
  if (!brand) throw new Error('Brand profile not found')

  const ctx = await gatherOperationalContext(userId, request, { auditType: 'content_review', ...contextOverrides })
  const contextBlock = buildContextBlock(ctx)

  const systemPrompt = `You are an elite content strategist who creates data-driven, deeply personalized content plans. You have access to the user's full operational context — emails, calendar, tasks, goals, behavioral patterns, and strategic insights — which you MUST use to create a content strategy that is uniquely tailored to the user's actual life, schedule, and strategic direction.

Do not create generic content calendars. Every recommendation must connect to something specific from the operational context — an upcoming event, a relationship pattern, a strategic priority, a behavioral tendency.

Return ONLY valid JSON.`

  const prompt = `Create a deeply personalized content strategy for:

Brand: ${brand.brandName}
Mission: ${brand.mission || 'N/A'}
Vision: ${brand.vision || 'N/A'}
Target Audience: ${brand.targetAudience || 'N/A'}
Content Pillars: ${brand.contentPillars || 'N/A'}
Brand Values: ${brand.brandValues || 'N/A'}
Positioning: ${brand.positioning || 'N/A'}${contextBlock}

Using the brand profile AND operational context, create a strategy that:
1. Aligns content themes with the user's actual upcoming schedule and commitments
2. Leverages email communication patterns for content timing and tone
3. Connects to active tasks and goals for authentic, experience-based content
4. Builds on Cortex-detected behavioral patterns for consistent brand delivery
5. Addresses specific opportunities visible in the strategic insights

Return JSON: {
  "score": <0-100 content readiness score>,
  "confidence": <0-100, how confident you are given available data>,
  "findings": [{ "category": "Content Pillar|Timing Strategy|Distribution Channel|Authenticity Signal|Engagement Tactic|Calendar Alignment|Relationship Leverage", "status": "strong|moderate|weak", "detail": "...", "recommendation": "...", "evidence": ["specific data points"], "confidence": <0-100> }],
  "conflicts": [{ "signalA": "source + data", "signalB": "source + data", "tension": "what conflict implies" }],
  "summary": "One-paragraph content strategy overview tightly connected to the user's operational reality"
}`

  const raw = await callLLM(prompt, systemPrompt, userId, 'content_review', contextOverrides?.temperature)
  
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    // Merge structural + LLM conflicts, tag LLM ones
    const llmConflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map((c: any) => ({ ...c, detectedBy: c.detectedBy || 'llm' as const }))
      : []
    const allConflicts = [
      ...ctx.structuralConflicts,
      ...llmConflicts.filter((lc: any) =>
        !ctx.structuralConflicts.some(sc => sc.tension === lc.tension)
      ),
    ]

    const result: BrandAuditResult = {
      type: 'content_review',
      score: Number(parsed.score) || 0,
      confidence: ctx.confidenceScore, // evidence-derived, NOT from LLM
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      conflicts: allConflicts,
      summary: parsed.summary || '',
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }

    await prisma.brandAudit.create({
      data: {
        brandProfileId,
        type: 'content_review',
        input: 'Content strategy generation',
        result: JSON.stringify(result),
        score: result.score,
        weightProfileVersion: WEIGHT_PROFILE_VERSION,
      },
    })

    return result
  } catch {
    return {
      type: 'content_review',
      score: 0,
      confidence: ctx.confidenceScore,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: [{ category: 'Parse Error', status: 'weak', detail: 'Could not parse strategy', recommendation: 'Try again' }],
      summary: raw.slice(0, 500),
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }
  }
}

// ─── Strategic Brand Alignment (NEW — full cross-system audit) ─────

export async function runStrategicAlignment(
  brandProfileId: string,
  userId: string,
  request?: Request,
  contextOverrides?: Partial<ContextOptions>
): Promise<BrandAuditResult> {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } })
  if (!brand) throw new Error('Brand profile not found')

  const voice: BrandVoice = safeParseVoiceTone(brand.voiceTone)
  const ctx = await gatherOperationalContext(userId, request, { auditType: 'strategic_alignment', ...contextOverrides })
  const contextBlock = buildContextBlock(ctx)

  if (ctx.sources.length === 0) {
    return {
      type: 'strategic_alignment',
      score: 0,
      confidence: 0,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: [{
        category: 'No Data',
        status: 'weak',
        detail: 'No operational context available. Connect your Google account to enable email and calendar analysis, and ensure you have active tasks, memories, and goals configured.',
        recommendation: 'Sign in with Google, add tasks and memories, and configure your profile objectives to unlock full strategic alignment analysis.'
      }],
      summary: 'Insufficient data for strategic alignment analysis.',
      contextSources: [],
      telemetry: ctx.telemetry,
    }
  }

  const systemPrompt = `You are a strategic brand alignment auditor — the most senior level of brand intelligence. You have complete access to a user's operational context: their email communications, calendar, active tasks, goals, memories, behavioral patterns, and strategic insights.

Your job is to perform a CROSS-SYSTEM ALIGNMENT AUDIT: determining whether the user's daily actions, communications, relationships, and priorities are aligned with or diverging from their stated brand identity.

This is not a surface-level check. You must:
1. Identify gaps between stated brand values and actual behavior visible in the data
2. Find reinforcement opportunities where actions naturally support the brand
3. Detect timing conflicts where brand messaging contradicts operational reality
4. Surface relationship patterns that could amplify or undermine brand perception
5. Assess whether the user's cognitive and strategic patterns (from Cortex) support sustainable brand delivery

Be honest and specific. Reference actual data points from the context. This audit should feel like it was written by someone who deeply understands the user's life, not by a generic brand consultant.

Return ONLY valid JSON.`

  const prompt = `Perform a comprehensive strategic brand alignment audit:

Brand Profile:
- Name: ${brand.brandName}
- Tagline: ${brand.tagline || 'N/A'}
- Mission: ${brand.mission || 'N/A'}
- Vision: ${brand.vision || 'N/A'}
- Positioning: ${brand.positioning || 'N/A'}
- Voice Tone: ${voice.tone.join(', ') || 'Not defined'}
- Voice Personality: ${voice.personality.join(', ') || 'Not defined'}
- Target Audience: ${brand.targetAudience || 'N/A'}
- Content Pillars: ${brand.contentPillars || 'N/A'}
- Brand Values: ${brand.brandValues || 'N/A'}${contextBlock}

Deliver a strategic alignment audit:
1. Is the user LIVING their brand — do their daily actions match their stated values?
2. Are their communications consistent with their brand voice?
3. Do their priorities (tasks, calendar) support brand-building activities?
4. Are behavioral patterns reinforcing or undermining brand authenticity?
5. What specific, actionable adjustments would maximize brand-reality alignment?

Return JSON: {
  "score": <0-100 alignment score>,
  "confidence": <0-100, how confident you are in this score given the available data quality and coverage>,
  "findings": [
    { "category": "Value Alignment|Communication Consistency|Priority Alignment|Behavioral Reinforcement|Relationship Leverage|Timing Coherence|Strategic Gap|Quick Win",
      "status": "strong|moderate|weak",
      "detail": "Specific finding referencing actual data...",
      "recommendation": "Actionable recommendation...",
      "evidence": ["specific data point from context that supports this finding"],
      "confidence": <0-100> }
  ],
  "conflicts": [{ "signalA": "source + specific data", "signalB": "source + specific data", "tension": "what this conflict means for brand alignment" }],
  "summary": "Executive-level summary of brand-reality alignment with specific observations"
}`

  const raw = await callLLM(prompt, systemPrompt, userId, 'strategic_alignment', contextOverrides?.temperature)
  
  try {
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    // Merge structural + LLM conflicts, tag LLM ones
    const llmConflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map((c: any) => ({ ...c, detectedBy: c.detectedBy || 'llm' as const }))
      : []
    const allConflicts = [
      ...ctx.structuralConflicts,
      ...llmConflicts.filter((lc: any) =>
        !ctx.structuralConflicts.some(sc => sc.tension === lc.tension)
      ),
    ]

    const result: BrandAuditResult = {
      type: 'strategic_alignment',
      score: Number(parsed.score) || 0,
      confidence: ctx.confidenceScore, // evidence-derived, NOT from LLM
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      conflicts: allConflicts,
      summary: parsed.summary || '',
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }

    await prisma.brandAudit.create({
      data: {
        brandProfileId,
        type: 'strategic_alignment',
        input: `Cross-system alignment audit (sources: ${ctx.sources.join(', ')})`,
        result: JSON.stringify(result),
        score: result.score,
        weightProfileVersion: WEIGHT_PROFILE_VERSION,
      },
    })

    return result
  } catch {
    return {
      type: 'strategic_alignment',
      score: 0,
      confidence: ctx.confidenceScore,
      confidenceBreakdown: ctx.confidenceBreakdown,
      findings: [{ category: 'Parse Error', status: 'weak', detail: 'Could not parse alignment analysis', recommendation: 'Try again' }],
      summary: raw.slice(0, 500),
      contextSources: ctx.sources,
      telemetry: ctx.telemetry,
    }
  }
}
