export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  runVoiceCheck,
  runCompetitorScan,
  generateContentStrategy,
  runStrategicAlignment,
  AVAILABLE_SOURCE_KEYS,
  WEIGHT_PROFILE_VERSION,
  type BrandAuditResult,
  type ContextOptions,
} from '@/lib/brand-manager'
import { prisma } from '@/lib/prisma'

/**
 * Ablation Instrument v3.4 — Dual-Regime, Multi-Input Panel Design
 *
 * Two coherent regimes. Pick one. They don't mix.
 *
 * REGIME: "deterministic" (temperature = 0)
 *   Output is a deterministic function of the prompt. No distribution to test.
 *
 *   Labels are OBSERVATIONS, not verdicts:
 *   - "observed-shift":     |Δ| ≥ 5 on this input. The source moved the score.
 *   - "observed-movement":  2 < |Δ| < 5 on this input. Small but nonzero.
 *   - "observed-no-effect": |Δ| ≤ 2 on this input. No movement detected.
 *
 *   These describe what happened on the tested input(s). They do NOT generalize.
 *   A source that shows no-effect on one input may shift on another.
 *
 * REGIME: "stochastic" (production temperature)
 *   Real sampling variance. Full statistical apparatus.
 *
 *   Labels are VERDICTS backed by statistical evidence:
 *   - "load-bearing":  p < 0.05 AND |d| ≥ 0.8 — statistically significant, large effect
 *   - "marginal":      p < 0.10 OR 0.5 ≤ |d| < 0.8 — suggestive but not conclusive
 *   - "inert":         p ≥ 0.10 AND |d| < 0.5 — indistinguishable from noise
 *
 * MULTI-INPUT PANEL:
 *   Both regimes accept an `inputs` array instead of a single `input` string.
 *   Each source is ablated against every input in the panel. This prevents
 *   overfitting the verdict to one test fixture.
 *
 *   Panel aggregation:
 *   - Deterministic: source classified per-input. Summary shows worst-case
 *     (if it shifted on ANY input, it's not safe to cut).
 *   - Stochastic: scores across all inputs pooled into the distribution,
 *     giving the t-test a richer sample.
 *
 *   If no `inputs` provided, falls back to the default panel for the audit type.
 *
 * Writes to BrandAblation table (NOT BrandAudit).
 * Noise floor is version-keyed to WEIGHT_PROFILE_VERSION.
 */

// ── Default input panels per audit type ─────────────────────────────

const DEFAULT_INPUT_PANELS: Record<string, string[]> = {
  voice_check: [
    'We are pleased to announce a strategic partnership that will redefine market positioning in the executive advisory space.',
    'Hey team, quick update — pushed the deadline back a week. Let me know if that works.',
    'Our Q3 results demonstrate the compounding advantage of disciplined capital allocation across asymmetric opportunities.',
  ],
  competitor_scan: [
    'general market',
    'direct competitors in executive advisory',
    'emerging digital-first competitors',
  ],
  content_review: [
    'Content strategy generation',  // content_review ignores input, but panel still validates consistency
  ],
  strategic_alignment: [
    'Cross-system alignment audit',  // strategic_alignment also ignores input
  ],
}

// ── Statistical helpers ──────────────────────────────────────────────

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0
  const m = mean(nums)
  const variance = nums.reduce((sum, n) => sum + (n - m) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(variance)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function welchTTest(a: number[], b: number[]): { t: number; df: number; p: number; degenerate: boolean } {
  const nA = a.length, nB = b.length
  if (nA < 2 || nB < 2) return { t: 0, df: 0, p: 1, degenerate: true }

  const mA = mean(a), mB = mean(b)
  const vA = a.reduce((s, x) => s + (x - mA) ** 2, 0) / (nA - 1)
  const vB = b.reduce((s, x) => s + (x - mB) ** 2, 0) / (nB - 1)
  const seA = vA / nA, seB = vB / nB
  const se = Math.sqrt(seA + seB)

  if (se === 0) return { t: 0, df: nA + nB - 2, p: 1, degenerate: true }

  const t = (mA - mB) / se
  const df = (seA + seB) ** 2 / ((seA ** 2) / (nA - 1) + (seB ** 2) / (nB - 1))
  const p = tDistPValue(Math.abs(t), df) * 2
  return { t: round4(t), df: round2(df), p: round4(Math.min(p, 1)), degenerate: false }
}

function cohensD(a: number[], b: number[]): number {
  const nA = a.length, nB = b.length
  if (nA < 2 || nB < 2) return 0
  const mA = mean(a), mB = mean(b)
  const vA = a.reduce((s, x) => s + (x - mA) ** 2, 0) / (nA - 1)
  const vB = b.reduce((s, x) => s + (x - mB) ** 2, 0) / (nB - 1)
  const pooled = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2))
  if (pooled === 0) return 0
  return round4((mA - mB) / pooled)
}

function tDistPValue(t: number, df: number): number {
  const x = df / (df + t * t)
  return 0.5 * regIncBeta(x, df / 2, 0.5)
}

function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; f = d
  for (let i = 1; i <= 200; i++) {
    const m2 = 2 * i
    let an = i * (b - i) * x / ((a + m2 - 1) * (a + m2))
    d = 1 + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + an / c; if (Math.abs(c) < 1e-30) c = 1e-30
    f *= d * c
    an = -(a + i) * (a + b + i) * x / ((a + m2) * (a + m2 + 1))
    d = 1 + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + an / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c; f *= delta
    if (Math.abs(delta - 1) < 1e-10) break
  }
  return front * f
}

function lgamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  z -= 1
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

// ── Types ────────────────────────────────────────────────────────────

type Regime = 'deterministic' | 'stochastic'

/**
 * Deterministic labels are OBSERVATIONS about what happened on tested inputs.
 * They explicitly do NOT generalize beyond the panel.
 */
type DeterministicLabel = 'observed-shift' | 'observed-movement' | 'observed-no-effect'

/**
 * Stochastic labels are VERDICTS backed by statistical evidence.
 * They generalize to the production distribution.
 */
type StochasticLabel = 'load-bearing' | 'marginal' | 'inert'

interface ConditionStats {
  label: string
  scores: number[]
  mean: number
  stddev: number
  sourceExclusions?: string[]
  shuffled?: boolean
  inputIndex?: number // which panel input produced these scores
}

/** Per-input observation for deterministic regime */
interface DeterministicInputObservation {
  input: string
  baselineScore: number
  ablatedScore: number
  delta: number
  absDelta: number
  label: DeterministicLabel
}

interface DeterministicVerdictEntry {
  source: string
  perInput: DeterministicInputObservation[]
  worstCaseDelta: number      // max |delta| across inputs
  worstCaseLabel: DeterministicLabel  // label from the input with largest |delta|
  panelConsensus: DeterministicLabel  // conservative: if ANY input shows shift, it's shift
  inputCount: number
  regime: 'deterministic'
  _note: string  // explicit reminder that these are observations, not verdicts
}

interface StochasticVerdictEntry {
  source: string
  baselineMean: number
  baselineStddev: number
  ablatedMean: number
  ablatedStddev: number
  delta: number
  absDelta: number
  cohenD: number
  absCohenD: number
  welch: { t: number; df: number; p: number; degenerate: boolean }
  noiseStddev: number
  classification: StochasticLabel
  signal: boolean
  regime: 'stochastic'
  inputCount: number
}

type VerdictEntry = DeterministicVerdictEntry | StochasticVerdictEntry

// ── Deterministic observation thresholds ───────────────────────────

// These are arbitrary thresholds for labeling observed deltas.
// They carry NO statistical authority. They exist solely to bucket
// the magnitude of a deterministic delta into human-readable labels.
const OBSERVATION_THRESHOLDS = {
  SHIFT: 5,     // |Δ| ≥ 5 — noticeable score movement
  MOVEMENT: 2,  // 2 < |Δ| < 5 — small movement
  // |Δ| ≤ 2 — no observed effect
}

function labelDelta(absDelta: number): DeterministicLabel {
  if (absDelta >= OBSERVATION_THRESHOLDS.SHIFT) return 'observed-shift'
  if (absDelta > OBSERVATION_THRESHOLDS.MOVEMENT) return 'observed-movement'
  return 'observed-no-effect'
}

// ── Audit runner ─────────────────────────────────────────────────────

async function runAudit(
  type: string,
  brandProfileId: string,
  userId: string,
  request: Request,
  input: string | undefined,
  overrides: Partial<ContextOptions> = {}
): Promise<BrandAuditResult> {
  switch (type) {
    case 'voice_check':
      return runVoiceCheck(brandProfileId, userId, input || 'Ablation calibration probe', request, overrides)
    case 'competitor_scan':
      return runCompetitorScan(brandProfileId, userId, input || 'general', request, overrides)
    case 'content_review':
      return generateContentStrategy(brandProfileId, userId, request, overrides)
    case 'strategic_alignment':
      return runStrategicAlignment(brandProfileId, userId, request, overrides)
    default:
      throw new Error(`Unknown audit type: ${type}`)
  }
}

/** Run a single condition N times (across reps), return stats */
async function runCondition(
  label: string,
  reps: number,
  type: string,
  brandProfileId: string,
  userId: string,
  request: Request,
  input: string | undefined,
  overrides: Partial<ContextOptions> = {},
  onProgress?: (msg: string) => void
): Promise<ConditionStats> {
  const scores: number[] = []
  for (let i = 0; i < reps; i++) {
    const result = await runAudit(type, brandProfileId, userId, request, input, overrides)
    scores.push(result.score)
    console.log(`[Ablation] ${label} rep ${i + 1}/${reps}: score=${result.score}`)
    onProgress?.(`${label} rep ${i + 1}/${reps}: score=${result.score}`)
  }
  return {
    label,
    scores,
    mean: round2(mean(scores)),
    stddev: round2(stddev(scores)),
    sourceExclusions: overrides.sourceExclusions,
    shuffled: overrides.shuffleOrder,
  }
}

/**
 * Run a condition across a panel of inputs (stochastic regime).
 * All scores from all inputs are pooled into one distribution.
 * This gives the t-test cross-input variance to work with.
 */
async function runConditionPanel(
  label: string,
  repsPerInput: number,
  type: string,
  brandProfileId: string,
  userId: string,
  request: Request,
  inputs: string[],
  overrides: Partial<ContextOptions> = {},
  onProgress?: (msg: string) => void
): Promise<ConditionStats> {
  const scores: number[] = []
  const totalCalls = inputs.length * repsPerInput
  let callIndex = 0
  for (let pi = 0; pi < inputs.length; pi++) {
    for (let r = 0; r < repsPerInput; r++) {
      callIndex++
      const result = await runAudit(type, brandProfileId, userId, request, inputs[pi], overrides)
      scores.push(result.score)
      console.log(`[Ablation] ${label} input[${pi}] rep ${r + 1}/${repsPerInput}: score=${result.score}`)
      onProgress?.(`${label} [${callIndex}/${totalCalls}] score=${result.score}`)
    }
  }
  return {
    label,
    scores,
    mean: round2(mean(scores)),
    stddev: round2(stddev(scores)),
    sourceExclusions: overrides.sourceExclusions,
    shuffled: overrides.shuffleOrder,
  }
}

// ── Verdict matrix builders ──────────────────────────────────────────

/**
 * Deterministic verdict: per-input observations + panel consensus.
 * Panel consensus is CONSERVATIVE: if the source shifted on ANY input,
 * the consensus is 'observed-shift'. A source is only 'observed-no-effect'
 * if it showed no effect on EVERY input in the panel.
 */
function buildDeterministicVerdict(
  perInputResults: { input: string; baselineScore: number; ablatedScore: number }[],
  source: string
): DeterministicVerdictEntry {
  const observations: DeterministicInputObservation[] = perInputResults.map(r => {
    const delta = round2(r.ablatedScore - r.baselineScore)
    const absDelta = round2(Math.abs(delta))
    return {
      input: r.input.slice(0, 100),
      baselineScore: r.baselineScore,
      ablatedScore: r.ablatedScore,
      delta,
      absDelta,
      label: labelDelta(absDelta),
    }
  })

  const worstCase = observations.reduce((worst, o) =>
    o.absDelta > worst.absDelta ? o : worst, observations[0])

  // Conservative consensus: promote to worst label seen
  let panelConsensus: DeterministicLabel = 'observed-no-effect'
  if (observations.some(o => o.label === 'observed-shift')) panelConsensus = 'observed-shift'
  else if (observations.some(o => o.label === 'observed-movement')) panelConsensus = 'observed-movement'

  return {
    source,
    perInput: observations,
    worstCaseDelta: worstCase.absDelta,
    worstCaseLabel: worstCase.label,
    panelConsensus,
    inputCount: observations.length,
    regime: 'deterministic' as const,
    _note: 'These are observations on tested inputs, not generalizable verdicts. ' +
      'A different input may produce different results. ' +
      'Use stochastic regime for production-grade verdicts.',
  }
}

function buildStochasticVerdict(
  baselineStats: ConditionStats,
  ablationStats: ConditionStats[],
  noiseStddev: number,
  inputCount: number
): StochasticVerdictEntry[] {
  return ablationStats.map(cond => {
    const delta = round2(cond.mean - baselineStats.mean)
    const absDelta = round2(Math.abs(delta))
    const d = cohensD(baselineStats.scores, cond.scores)
    const absD = round4(Math.abs(d))
    const welch = welchTTest(baselineStats.scores, cond.scores)

    let classification: StochasticLabel
    if (welch.degenerate) {
      // Degenerate: label as observation, same as deterministic
      // but through the stochastic type (for structural compatibility)
      if (absDelta >= OBSERVATION_THRESHOLDS.SHIFT) classification = 'load-bearing'
      else if (absDelta > OBSERVATION_THRESHOLDS.MOVEMENT) classification = 'marginal'
      else classification = 'inert'
    } else {
      if (welch.p < 0.05 && absD >= 0.8) classification = 'load-bearing'
      else if (welch.p < 0.10 || absD >= 0.5) classification = 'marginal'
      else classification = 'inert'
    }

    return {
      source: cond.label.replace('without_', ''),
      baselineMean: baselineStats.mean,
      baselineStddev: baselineStats.stddev,
      ablatedMean: cond.mean,
      ablatedStddev: cond.stddev,
      delta,
      absDelta,
      cohenD: d,
      absCohenD: absD,
      welch,
      noiseStddev: round2(noiseStddev),
      classification,
      signal: classification === 'load-bearing',
      regime: 'stochastic' as const,
      inputCount,
    }
  })
}

// ── Resilient DB helper (survives idle-session timeout) ────────────────

async function resilientDbWrite<T>(operation: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isConnectionError = /idle.session.timeout|connection.*closed|connection.*terminated|connection.*reset|prepared statement|ECONNRESET|Connection pool timeout/i.test(msg)
      console.warn(`[Ablation DB ${label}] Attempt ${attempt}/${maxRetries} failed: ${msg}`)
      if (!isConnectionError || attempt === maxRetries) throw err
      // Force Prisma to reconnect by disconnecting + small delay
      try { await prisma.$disconnect() } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  throw new Error(`resilientDbWrite(${label}): exhausted retries`)
}

// ── Streaming helpers ─────────────────────────────────────────────────

function createStreamingResponse(
  runner: (send: (event: Record<string, unknown>) => void) => Promise<Record<string, unknown>>
): Response {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Run the ablation in background, writing progress events to the stream
  ;(async () => {
    const send = (event: Record<string, unknown>) => {
      writer.write(encoder.encode(JSON.stringify(event) + '\n')).catch(() => {})
    }
    try {
      const result = await runner(send)
      // Write the final result
      send({ type: 'result', ...result })
    } catch (err: unknown) {
      send({ type: 'error', error: err instanceof Error ? err.message : String(err) })
    } finally {
      writer.close().catch(() => {})
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  })
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    brandProfileId,
    auditType = 'voice_check',
    mode = 'full',
    regime = 'stochastic' as Regime,
    reps: requestedReps,
    sourceExclusions = [],
    noiseFloorId,
    input,
    inputs: rawInputs,
  } = body

  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 })
  }

  const validRegime: Regime = regime === 'deterministic' ? 'deterministic' : 'stochastic'

  // Resolve input panel
  let inputPanel: string[]
  if (Array.isArray(rawInputs) && rawInputs.length > 0) {
    inputPanel = rawInputs.slice(0, 5)
  } else if (input) {
    inputPanel = [input]
  } else {
    inputPanel = DEFAULT_INPUT_PANELS[auditType] || ['Ablation calibration probe']
  }

  let safeReps: number
  if (validRegime === 'deterministic') {
    safeReps = 1
  } else {
    const maxReps = (mode === 'null' || mode === 'shuffle') ? 20 : 15
    safeReps = Math.max(3, Math.min(requestedReps || 10, maxReps))
  }

  const temperature = validRegime === 'deterministic' ? 0 : undefined

  // Verify ownership (fast — do before streaming)
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } })
  if (!brand || brand.userId !== session.user.id) {
    return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
  }

  // Fast-path validations before streaming
  if (mode === 'shuffle' && validRegime === 'deterministic') {
    return NextResponse.json({ error: 'Shuffle mode requires stochastic regime.' }, { status: 400 })
  }
  if (mode === 'ablate') {
    const validExclusions = sourceExclusions.filter((k: string) => AVAILABLE_SOURCE_KEYS.includes(k))
    if (validExclusions.length === 0) {
      return NextResponse.json({ error: 'No valid source keys', validKeys: AVAILABLE_SOURCE_KEYS }, { status: 400 })
    }
  }
  if (!['null', 'ablate', 'shuffle', 'full'].includes(mode)) {
    return NextResponse.json({ error: `Unknown mode: ${mode}. Valid: null, ablate, shuffle, full` }, { status: 400 })
  }

  // For deterministic null, return immediately (no work needed)
  if (mode === 'null' && validRegime === 'deterministic') {
    const rec = await prisma.brandAblation.create({
      data: { brandProfileId, mode, auditType, repsPerCondition: 1, temperature: 0, profileVersion: WEIGHT_PROFILE_VERSION, conditions: '[]', status: 'completed', completedAt: new Date() },
    })
    return NextResponse.json({
      type: 'result', id: rec.id, mode: 'null', regime: 'deterministic', auditType,
      profileVersion: WEIGHT_PROFILE_VERSION,
      noiseFloor: { mean: 0, stddev: 0, scores: [], reps: 0 },
      interpretation: 'Null mode is unnecessary in deterministic regime. Skip to mode="full".',
      _skipped: true,
    })
  }

  // ── Stream the long-running ablation ─────────────────────────────
  return createStreamingResponse(async (send) => {
    const ablationRecord = await prisma.brandAblation.create({
      data: { brandProfileId, mode, auditType, repsPerCondition: safeReps, temperature: validRegime === 'deterministic' ? 0 : -1, profileVersion: WEIGHT_PROFILE_VERSION, conditions: '[]', status: 'running' },
    })

    send({ type: 'progress', message: `Starting ${mode}/${validRegime} ablation for ${auditType}`, ablationId: ablationRecord.id })

    const onProgress = (msg: string) => send({ type: 'progress', message: msg })

    try {
      if (mode === 'null') {
        // Stochastic null
        console.log(`[Ablation NULL/stochastic] ${safeReps} reps × ${inputPanel.length} inputs for ${auditType}`)
        const nullStats = await runConditionPanel('null_baseline', safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { temperature }, onProgress)
        const noiseFloor = { mean: nullStats.mean, stddev: nullStats.stddev, scores: nullStats.scores, reps: safeReps, inputCount: inputPanel.length, totalSamples: nullStats.scores.length, regime: 'stochastic' }
        console.log(`[Ablation NULL/stochastic] Noise floor: mean=${noiseFloor.mean}, σ=${noiseFloor.stddev}, samples=${noiseFloor.totalSamples}`)
        await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify([nullStats]), noiseFloor: JSON.stringify(noiseFloor), status: 'completed', completedAt: new Date() } }), 'null-stochastic-complete')
        return {
          id: ablationRecord.id, mode: 'null', regime: 'stochastic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, reps: safeReps, inputPanel, noiseFloor,
          interpretation: noiseFloor.stddev < 2 ? `Tight noise floor (σ=${noiseFloor.stddev}, n=${noiseFloor.totalSamples}). Good instrument precision.` : noiseFloor.stddev < 5 ? `Moderate noise (σ=${noiseFloor.stddev}). Ablation deltas must exceed ${round2(noiseFloor.stddev * 2)} to reliably separate from noise.` : `High noise (σ=${noiseFloor.stddev}). Consider more reps or a different audit type.`,
        }

      } else if (mode === 'shuffle') {
        const noiseFloor = await loadNoiseFloor(noiseFloorId, brandProfileId, auditType)
        const shuffleStats = await runConditionPanel('shuffled', safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { shuffleOrder: true, temperature }, onProgress)
        const positionSensitive = shuffleStats.stddev > noiseFloor.stddev * 2
        await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify([shuffleStats]), noiseFloor: JSON.stringify(noiseFloor), verdictMatrix: JSON.stringify([{ source: 'position_order', shuffleStddev: shuffleStats.stddev, nullStddev: noiseFloor.stddev, ratio: round2(shuffleStats.stddev / Math.max(noiseFloor.stddev, 0.01)), positionSensitive, regime: 'stochastic' }]), status: 'completed', completedAt: new Date() } }), 'shuffle-complete')
        return {
          id: ablationRecord.id, mode: 'shuffle', regime: 'stochastic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, reps: safeReps, inputPanel,
          shuffleStats: { mean: shuffleStats.mean, stddev: shuffleStats.stddev, scores: shuffleStats.scores }, noiseFloor, positionSensitive,
          interpretation: positionSensitive ? `Position-sensitive: shuffle σ=${shuffleStats.stddev} >> null σ=${noiseFloor.stddev}. Context ordering matters.` : `Position-insensitive: shuffle σ=${shuffleStats.stddev} ≈ null σ=${noiseFloor.stddev}. Ordering is noise.`,
        }

      } else if (mode === 'ablate') {
        const validExclusions = sourceExclusions.filter((k: string) => AVAILABLE_SOURCE_KEYS.includes(k))
        if (validRegime === 'deterministic') {
          const perInputResults: { input: string; baselineScore: number; ablatedScore: number }[] = []
          for (let i = 0; i < inputPanel.length; i++) {
            const inp = inputPanel[i]
            send({ type: 'progress', message: `Ablate/det input ${i + 1}/${inputPanel.length}: baseline...` })
            const base = await runAudit(auditType, brandProfileId, session.user.id, request, inp, { temperature: 0 })
            send({ type: 'progress', message: `Ablate/det input ${i + 1}/${inputPanel.length}: ablated...` })
            const abl = await runAudit(auditType, brandProfileId, session.user.id, request, inp, { sourceExclusions: validExclusions, temperature: 0 })
            perInputResults.push({ input: inp, baselineScore: base.score, ablatedScore: abl.score })
          }
          const verdict = buildDeterministicVerdict(perInputResults, validExclusions.join('+'))
          await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify(perInputResults), verdictMatrix: JSON.stringify([verdict]), status: 'completed', completedAt: new Date() } }), 'ablate-deterministic-complete')
          return { id: ablationRecord.id, mode: 'ablate', regime: 'deterministic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, inputPanel, excluded: validExclusions, verdict }
        } else {
          const noiseFloor = await loadNoiseFloor(noiseFloorId, brandProfileId, auditType)
          send({ type: 'progress', message: 'Running baseline...' })
          const baselineStats = await runConditionPanel('baseline', safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { temperature }, onProgress)
          send({ type: 'progress', message: `Running ablated (without ${validExclusions.join('+')})...` })
          const ablatedStats = await runConditionPanel(`without_${validExclusions.join('+')}`, safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { sourceExclusions: validExclusions, temperature }, onProgress)
          const verdict = buildStochasticVerdict(baselineStats, [ablatedStats], noiseFloor.stddev, inputPanel.length)
          await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify([baselineStats, ablatedStats]), noiseFloor: JSON.stringify(noiseFloor), verdictMatrix: JSON.stringify(verdict), status: 'completed', completedAt: new Date() } }), 'ablate-stochastic-complete')
          return { id: ablationRecord.id, mode: 'ablate', regime: 'stochastic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, reps: safeReps, inputPanel, baseline: { mean: baselineStats.mean, stddev: baselineStats.stddev, scores: baselineStats.scores }, ablated: { mean: ablatedStats.mean, stddev: ablatedStats.stddev, scores: ablatedStats.scores, excluded: validExclusions }, noiseFloor, verdict: verdict[0] }
        }

      } else {
        // mode === 'full'
        if (validRegime === 'deterministic') {
          console.log(`[Ablation FULL/det] ${inputPanel.length} inputs × ${AVAILABLE_SOURCE_KEYS.length + 1} conditions for ${auditType}`)
          const baselineScores: Record<string, number> = {}
          for (let i = 0; i < inputPanel.length; i++) {
            send({ type: 'progress', message: `Baseline input ${i + 1}/${inputPanel.length}...` })
            const result = await runAudit(auditType, brandProfileId, session.user.id, request, inputPanel[i], { temperature: 0 })
            baselineScores[inputPanel[i]] = result.score
          }
          const verdictEntries: DeterministicVerdictEntry[] = []
          const conditionRecords: any[] = [{ label: 'baselines', perInput: baselineScores }]
          for (let ki = 0; ki < AVAILABLE_SOURCE_KEYS.length; ki++) {
            const key = AVAILABLE_SOURCE_KEYS[ki]
            send({ type: 'progress', message: `Ablating source ${ki + 1}/${AVAILABLE_SOURCE_KEYS.length}: ${key}` })
            const perInputResults: { input: string; baselineScore: number; ablatedScore: number }[] = []
            for (const inp of inputPanel) {
              const result = await runAudit(auditType, brandProfileId, session.user.id, request, inp, { sourceExclusions: [key], temperature: 0 })
              perInputResults.push({ input: inp, baselineScore: baselineScores[inp], ablatedScore: result.score })
            }
            verdictEntries.push(buildDeterministicVerdict(perInputResults, key))
            conditionRecords.push({ source: key, perInput: perInputResults })
          }
          const shifted = verdictEntries.filter(v => v.panelConsensus === 'observed-shift').map(v => v.source)
          const moved = verdictEntries.filter(v => v.panelConsensus === 'observed-movement').map(v => v.source)
          const noEffect = verdictEntries.filter(v => v.panelConsensus === 'observed-no-effect').map(v => v.source)
          await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify(conditionRecords), verdictMatrix: JSON.stringify(verdictEntries), status: 'completed', completedAt: new Date() } }), 'full-deterministic-complete')
          return {
            id: ablationRecord.id, mode: 'full', regime: 'deterministic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, inputPanel, inputCount: inputPanel.length,
            totalCalls: (AVAILABLE_SOURCE_KEYS.length + 1) * inputPanel.length, verdictMatrix: verdictEntries,
            summary: {
              observedShift: shifted, observedMovement: moved, observedNoEffect: noEffect, thresholds: OBSERVATION_THRESHOLDS,
              _important: `These are OBSERVATIONS on the tested inputs, not generalizable verdicts. Sources in observedNoEffect showed no effect across ${inputPanel.length} input(s), but may still matter for inputs not in this panel.`,
              recommendation: shifted.length === 0 && moved.length === 0 ? `No sources produced observable movement across ${inputPanel.length} input(s). Either the context machinery is inert for this audit type on this data, or the test inputs lack the richness to differentiate.` : `${shifted.length} source(s) showed observable shifts, ${moved.length} showed movement. Sources with no effect across all ${inputPanel.length} inputs (${noEffect.join(', ')}) are weaker candidates for the context budget.`,
            },
          }
        } else {
          const noiseFloor = await loadNoiseFloor(noiseFloorId, brandProfileId, auditType)
          console.log(`[Ablation FULL/stochastic] ${safeReps} reps × ${inputPanel.length} inputs × ${AVAILABLE_SOURCE_KEYS.length + 1} conditions for ${auditType}`)
          send({ type: 'progress', message: 'Running baseline panel...' })
          const baselineStats = await runConditionPanel('baseline', safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { temperature }, onProgress)
          const ablationResults: ConditionStats[] = []
          for (let ki = 0; ki < AVAILABLE_SOURCE_KEYS.length; ki++) {
            const key = AVAILABLE_SOURCE_KEYS[ki]
            send({ type: 'progress', message: `Ablating source ${ki + 1}/${AVAILABLE_SOURCE_KEYS.length}: ${key}` })
            const stats = await runConditionPanel(`without_${key}`, safeReps, auditType, brandProfileId, session.user.id, request, inputPanel, { sourceExclusions: [key], temperature }, onProgress)
            ablationResults.push(stats)
          }
          const verdict = buildStochasticVerdict(baselineStats, ablationResults, noiseFloor.stddev, inputPanel.length)
          const loadBearing = verdict.filter(v => v.classification === 'load-bearing').map(v => v.source)
          const marginal = verdict.filter(v => v.classification === 'marginal').map(v => v.source)
          const inert = verdict.filter(v => v.classification === 'inert').map(v => v.source)
          const degenerate = verdict.filter(v => v.welch?.degenerate).map(v => v.source)
          await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { conditions: JSON.stringify([baselineStats, ...ablationResults]), noiseFloor: JSON.stringify(noiseFloor), verdictMatrix: JSON.stringify(verdict), status: 'completed', completedAt: new Date() } }), 'full-stochastic-complete')
          return {
            id: ablationRecord.id, mode: 'full', regime: 'stochastic', auditType, profileVersion: WEIGHT_PROFILE_VERSION, reps: safeReps, inputPanel,
            inputCount: inputPanel.length, totalSamplesPerCondition: safeReps * inputPanel.length,
            baseline: { mean: baselineStats.mean, stddev: baselineStats.stddev, scores: baselineStats.scores }, noiseFloor, verdictMatrix: verdict,
            summary: {
              loadBearing, marginal, inert,
              degenerate: degenerate.length > 0 ? `WARNING: ${degenerate.length} conditions had zero variance — t-test fell back to observation thresholds for these: [${degenerate.join(', ')}].` : undefined,
              recommendation: loadBearing.length === 0 && marginal.length === 0 ? `No sources show statistically significant signal across ${inputPanel.length} input(s) and ${safeReps} reps.` : `${loadBearing.length} load-bearing, ${marginal.length} marginal across ${inputPanel.length} input(s). Inert sources (${inert.join(', ')}) are candidates for removal.`,
            },
          }
        }
      }
    } catch (runError: unknown) {
      await resilientDbWrite(() => prisma.brandAblation.update({ where: { id: ablationRecord.id }, data: { status: 'failed', error: runError instanceof Error ? runError.message : String(runError), completedAt: new Date() } }), 'ablation-failure-record').catch(() => {})
      throw runError
    }
  })
}

// ── Noise floor loader (stochastic regime only) ──────────────────────

async function loadNoiseFloor(
  noiseFloorId: string | undefined,
  brandProfileId: string,
  auditType: string
): Promise<{ mean: number; stddev: number; scores: number[]; reps: number }> {
  if (noiseFloorId) {
    const record = await prisma.brandAblation.findUnique({ where: { id: noiseFloorId } })
    if (!record || !record.noiseFloor) {
      throw new Error(`Noise floor record ${noiseFloorId} not found or has no noise floor data`)
    }
    if (record.profileVersion !== WEIGHT_PROFILE_VERSION) {
      throw new Error(
        `Noise floor ${noiseFloorId} was computed under profile version ${record.profileVersion}, ` +
        `but current version is ${WEIGHT_PROFILE_VERSION}. Re-run mode="null" with regime="stochastic".`
      )
    }
    return JSON.parse(record.noiseFloor)
  }

  const latest = await prisma.brandAblation.findFirst({
    where: {
      brandProfileId,
      auditType,
      mode: 'null',
      status: 'completed',
      noiseFloor: { not: null },
      profileVersion: WEIGHT_PROFILE_VERSION,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!latest || !latest.noiseFloor) {
    const stale = await prisma.brandAblation.findFirst({
      where: {
        brandProfileId,
        auditType,
        mode: 'null',
        status: 'completed',
        noiseFloor: { not: null },
        profileVersion: { not: WEIGHT_PROFILE_VERSION },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (stale) {
      throw new Error(
        `Found noise floor from profile version ${stale.profileVersion}, but current version is ${WEIGHT_PROFILE_VERSION}. ` +
        `Re-run mode="null" with regime="stochastic".`
      )
    }

    throw new Error(
      'No noise floor established for current profile version. Run mode="null" with regime="stochastic" first. ' +
      '(Or switch to regime="deterministic" which does not require a noise floor.)'
    )
  }

  return JSON.parse(latest.noiseFloor)
}

// ── GET handler ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandProfileId = searchParams.get('brandProfileId')

  const meta: Record<string, unknown> = {
    currentProfileVersion: WEIGHT_PROFILE_VERSION,
    availableSourceKeys: AVAILABLE_SOURCE_KEYS,
    supportedModes: ['null', 'ablate', 'shuffle', 'full'],
    supportedAuditTypes: ['voice_check', 'competitor_scan', 'content_review', 'strategic_alignment'],
    supportedRegimes: ['deterministic', 'stochastic'],
    defaultInputPanels: DEFAULT_INPUT_PANELS,
    protocol: {
      deterministic: {
        description: 'Temperature=0. Output is deterministic. Labels are OBSERVATIONS, not verdicts.',
        labels: {
          'observed-shift': '|Δ|≥5 — noticeable score movement on this input',
          'observed-movement': '2<|Δ|<5 — small movement on this input',
          'observed-no-effect': '|Δ|≤2 — no movement detected on this input',
        },
        panelAggregation: 'Conservative worst-case: if source shifted on ANY input, consensus is observed-shift.',
        step1: 'Skip mode="null".',
        step2: 'Run mode="full" with regime="deterministic" and inputs=[panel of representative texts].',
        reps: '1 rep (deterministic — repeating is redundant).',
        limitation: 'These labels describe what happened, not what will happen on other inputs. ' +
          'A source with no-effect on your panel may shift on an input you didn\'t test.',
      },
      stochastic: {
        description: 'Production temperature. Real variance. Labels are VERDICTS backed by statistics.',
        labels: {
          'load-bearing': 'p<0.05 AND |d|≥0.8 — statistically significant, large effect',
          'marginal': 'p<0.10 OR |d|≥0.5 — suggestive but not conclusive',
          'inert': 'p≥0.10 AND |d|<0.5 — indistinguishable from noise',
        },
        panelAggregation: 'Scores from all inputs pooled into the distribution for the t-test.',
        step1: 'Run mode="null" with regime="stochastic", reps=15, inputs=[panel].',
        step2: 'Run mode="full" with regime="stochastic", reps=10, inputs=[same panel].',
        reps: '10-20 reps per condition for reliable statistics.',
      },
      inputPanel: 'Both regimes accept an `inputs` array. If omitted, uses the default panel for the audit type. ' +
        'A source is only a removal candidate if it shows no effect across the FULL panel. ' +
        'Single-input ablation overfits the verdict to one test fixture.',
    },
  }

  if (brandProfileId) {
    const history = await prisma.brandAblation.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        mode: true,
        auditType: true,
        repsPerCondition: true,
        temperature: true,
        profileVersion: true,
        status: true,
        noiseFloor: true,
        verdictMatrix: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    })

    meta.history = history.map(h => ({
      ...h,
      regime: h.temperature === 0 ? 'deterministic' : 'stochastic',
      noiseFloor: h.noiseFloor ? JSON.parse(h.noiseFloor) : null,
      verdictMatrix: h.verdictMatrix ? JSON.parse(h.verdictMatrix) : null,
    }))
  }

  return NextResponse.json(meta)
}
