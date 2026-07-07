import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

// ───────────────────────────────────────────
// SETH Telemetry — Distributed Cognition Observability
// ───────────────────────────────────────────
// Records structured traces for every pipeline execution:
//   chat, tts, transcribe, memory retrieval, graph context,
//   agent routing, tool execution, and failure events.
//
// Each trace is a top-level pipeline execution with nested spans.
// Spans capture sub-operations (auth, db queries, LLM calls, etc.).
// ───────────────────────────────────────────

export type Pipeline = 'chat' | 'tts' | 'transcribe' | 'memory' | 'graph' | 'routing' | 'tool'
export type TraceStatus = 'ok' | 'error' | 'timeout' | 'fallback'

export interface Span {
  name: string
  startMs: number
  endMs: number
  meta?: Record<string, any>
}

export interface TraceContext {
  traceId: string
  pipeline: Pipeline
  operation: string
  userId?: string
  authMethod?: string
  startTime: number
  spans: Span[]
  metadata: Record<string, any>
}

/**
 * Begin a new trace. Returns a TraceContext you carry through the pipeline.
 */
export function startTrace(pipeline: Pipeline, operation: string, opts?: {
  userId?: string
  authMethod?: string
  metadata?: Record<string, any>
}): TraceContext {
  return {
    traceId: `tr_${randomBytes(12).toString('hex')}`,
    pipeline,
    operation,
    userId: opts?.userId,
    authMethod: opts?.authMethod,
    startTime: Date.now(),
    spans: [],
    metadata: opts?.metadata ?? {},
  }
}

/**
 * Start a span within a trace. Returns a function to end the span.
 */
export function startSpan(ctx: TraceContext, name: string): (meta?: Record<string, any>) => void {
  const startMs = Date.now() - ctx.startTime
  return (meta?: Record<string, any>) => {
    ctx.spans.push({
      name,
      startMs,
      endMs: Date.now() - ctx.startTime,
      meta,
    })
  }
}

/**
 * Add a completed span directly (for cases where timing is external).
 */
export function addSpan(ctx: TraceContext, name: string, durationMs: number, meta?: Record<string, any>) {
  const endMs = Date.now() - ctx.startTime
  ctx.spans.push({
    name,
    startMs: endMs - durationMs,
    endMs,
    meta,
  })
}

/**
 * Merge additional metadata into the trace.
 */
export function annotate(ctx: TraceContext, data: Record<string, any>) {
  Object.assign(ctx.metadata, data)
}

/**
 * Finalize and persist the trace. Fire-and-forget — never blocks the pipeline.
 */
export function endTrace(ctx: TraceContext, status: TraceStatus = 'ok'): void {
  const latencyMs = Date.now() - ctx.startTime

  // Fire-and-forget persistence
  prisma.telemetryTrace.create({
    data: {
      traceId: ctx.traceId,
      userId: ctx.userId ?? null,
      pipeline: ctx.pipeline,
      operation: ctx.operation,
      status,
      latencyMs,
      spans: JSON.stringify(ctx.spans),
      metadata: Object.keys(ctx.metadata).length > 0 ? JSON.stringify(ctx.metadata) : null,
      authMethod: ctx.authMethod ?? null,
    },
  }).catch((err) => {
    console.error('[Telemetry] Failed to persist trace:', err?.message)
  })
}

// ─── Aggregation Queries ────────────────────────────

export interface TelemetrySummary {
  totalTraces: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  byPipeline: Record<string, { count: number; avgMs: number; errorCount: number }>
  recentFailures: Array<{
    traceId: string
    pipeline: string
    operation: string
    status: string
    latencyMs: number
    metadata: any
    createdAt: Date
  }>
  latencyBuckets: Array<{ hour: string; pipeline: string; avgMs: number; count: number }>
}

export async function getTelemetrySummary(hours: number = 24): Promise<TelemetrySummary> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [allTraces, failures] = await Promise.all([
    prisma.telemetryTrace.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.telemetryTrace.findMany({
      where: {
        createdAt: { gte: since },
        status: { not: 'ok' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        traceId: true,
        pipeline: true,
        operation: true,
        status: true,
        latencyMs: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])

  const totalTraces = allTraces.length
  const errorCount = allTraces.filter(t => t.status !== 'ok').length
  const latencies = allTraces.map(t => t.latencyMs).sort((a, b) => a - b)
  const avgLatencyMs = totalTraces > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / totalTraces) : 0
  const p95LatencyMs = totalTraces > 0 ? latencies[Math.floor(totalTraces * 0.95)] ?? 0 : 0

  // Group by pipeline
  const byPipeline: Record<string, { count: number; totalMs: number; errorCount: number; avgMs: number }> = {}
  for (const t of allTraces) {
    if (!byPipeline[t.pipeline]) {
      byPipeline[t.pipeline] = { count: 0, totalMs: 0, errorCount: 0, avgMs: 0 }
    }
    byPipeline[t.pipeline].count++
    byPipeline[t.pipeline].totalMs += t.latencyMs
    if (t.status !== 'ok') byPipeline[t.pipeline].errorCount++
  }
  for (const k of Object.keys(byPipeline)) {
    byPipeline[k].avgMs = Math.round(byPipeline[k].totalMs / byPipeline[k].count)
  }

  // Latency heatmap buckets (hourly, by pipeline)
  const bucketMap = new Map<string, { totalMs: number; count: number }>()
  for (const t of allTraces) {
    const hour = t.createdAt.toISOString().slice(0, 13) + ':00'
    const key = `${hour}|${t.pipeline}`
    const existing = bucketMap.get(key) ?? { totalMs: 0, count: 0 }
    existing.totalMs += t.latencyMs
    existing.count++
    bucketMap.set(key, existing)
  }
  const latencyBuckets = Array.from(bucketMap.entries()).map(([key, val]) => {
    const [hour, pipeline] = key.split('|')
    return { hour, pipeline, avgMs: Math.round(val.totalMs / val.count), count: val.count }
  }).sort((a, b) => a.hour.localeCompare(b.hour))

  return {
    totalTraces,
    errorRate: totalTraces > 0 ? errorCount / totalTraces : 0,
    avgLatencyMs,
    p95LatencyMs,
    byPipeline: Object.fromEntries(
      Object.entries(byPipeline).map(([k, v]) => [k, { count: v.count, avgMs: v.avgMs, errorCount: v.errorCount }])
    ),
    recentFailures: failures.map(f => ({
      ...f,
      metadata: f.metadata ? JSON.parse(f.metadata) : null,
    })),
    latencyBuckets,
  }
}

/**
 * Get detailed span breakdown for a single trace.
 */
export async function getTraceDetail(traceId: string) {
  const trace = await prisma.telemetryTrace.findUnique({ where: { traceId } })
  if (!trace) return null
  return {
    ...trace,
    spans: JSON.parse(trace.spans),
    metadata: trace.metadata ? JSON.parse(trace.metadata) : null,
  }
}
