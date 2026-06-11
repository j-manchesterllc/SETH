'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  ChevronRight,
  Zap,
  XCircle,
  CheckCircle2,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PipelineStat {
  count: number
  avgMs: number
  errorCount: number
}

interface LatencyBucket {
  hour: string
  pipeline: string
  avgMs: number
  count: number
}

interface FailureEntry {
  traceId: string
  pipeline: string
  operation: string
  status: string
  latencyMs: number
  metadata: any
  createdAt: string
}

interface TelemetrySummary {
  totalTraces: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  byPipeline: Record<string, PipelineStat>
  recentFailures: FailureEntry[]
  latencyBuckets: LatencyBucket[]
}

interface TraceDetail {
  traceId: string
  pipeline: string
  operation: string
  status: string
  latencyMs: number
  authMethod: string | null
  spans: Array<{ name: string; startMs: number; endMs: number; meta?: any }>
  metadata: any
  createdAt: string
}

const PIPELINE_COLORS: Record<string, string> = {
  chat: 'bg-blue-500',
  tts: 'bg-emerald-500',
  transcribe: 'bg-violet-500',
  memory: 'bg-amber-500',
  graph: 'bg-cyan-500',
  routing: 'bg-rose-500',
  tool: 'bg-orange-500',
}

const PIPELINE_LABELS: Record<string, string> = {
  chat: 'Chat Pipeline',
  tts: 'Voice Synthesis',
  transcribe: 'Speech Recognition',
  memory: 'Memory Retrieval',
  graph: 'Graph Context',
  routing: 'Agent Routing',
  tool: 'Tool Execution',
}

function latencyColor(ms: number): string {
  if (ms < 500) return 'text-emerald-400'
  if (ms < 1500) return 'text-amber-400'
  if (ms < 3000) return 'text-orange-400'
  return 'text-red-400'
}

function heatmapColor(avgMs: number): string {
  if (avgMs < 300) return 'bg-emerald-500/20'
  if (avgMs < 800) return 'bg-emerald-500/40'
  if (avgMs < 1500) return 'bg-amber-500/40'
  if (avgMs < 3000) return 'bg-orange-500/40'
  return 'bg-red-500/50'
}

export function TelemetryPanel() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null)
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/telemetry?hours=${hours}`)
      if (res.ok) {
        setSummary(await res.json())
      }
    } catch (err) {
      toast.error('Failed to load telemetry')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const fetchTraceDetail = async (traceId: string) => {
    try {
      const res = await fetch(`/api/telemetry?traceId=${traceId}`)
      if (res.ok) {
        setSelectedTrace(await res.json())
      }
    } catch {
      toast.error('Failed to load trace detail')
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pipelines = Object.entries(summary?.byPipeline ?? {})
    .sort((a, b) => b[1].count - a[1].count)

  // Build heatmap grid from latency buckets
  const buckets = summary?.latencyBuckets ?? []
  const uniqueHours = [...new Set(buckets.map(b => b.hour))].sort()
  const uniquePipelines = [...new Set(buckets.map(b => b.pipeline))]
  const recentHours = uniqueHours.slice(-12) // last 12 hours

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[6, 12, 24, 48, 168].map(h => (
            <Button
              key={h}
              size="sm"
              variant={hours === h ? 'default' : 'outline'}
              onClick={() => setHours(h)}
              className="text-xs"
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={fetchSummary} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Traces"
          value={summary?.totalTraces ?? 0}
          icon={<Activity className="h-4 w-4 text-blue-400" />}
        />
        <StatCard
          label="Avg Latency"
          value={`${summary?.avgLatencyMs ?? 0}ms`}
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          valueClass={latencyColor(summary?.avgLatencyMs ?? 0)}
        />
        <StatCard
          label="P95 Latency"
          value={`${summary?.p95LatencyMs ?? 0}ms`}
          icon={<Zap className="h-4 w-4 text-orange-400" />}
          valueClass={latencyColor(summary?.p95LatencyMs ?? 0)}
        />
        <StatCard
          label="Error Rate"
          value={`${((summary?.errorRate ?? 0) * 100).toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          valueClass={(summary?.errorRate ?? 0) > 0.05 ? 'text-red-400' : 'text-emerald-400'}
        />
      </div>

      {/* Pipeline Breakdown + Latency Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="h-4 w-4 text-blue-400" />
              Pipeline Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pipelines.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No traces recorded yet</p>
              )}
              {pipelines.map(([name, stat]) => (
                <div key={name} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full', PIPELINE_COLORS[name] ?? 'bg-gray-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{PIPELINE_LABELS[name] ?? name}</span>
                      <span className="text-xs text-muted-foreground">{stat.count} calls</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={cn('text-xs font-mono', latencyColor(stat.avgMs))}>
                        avg {stat.avgMs}ms
                      </span>
                      {stat.errorCount > 0 && (
                        <span className="text-xs text-red-400">
                          {stat.errorCount} error{stat.errorCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', PIPELINE_COLORS[name] ?? 'bg-gray-500')}
                        style={{ width: `${Math.min(100, (stat.avgMs / (summary?.p95LatencyMs || 3000)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Latency Heatmap */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Latency Heatmap (last 12h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentHours.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-1">
                {/* Header row */}
                <div className="flex gap-0.5">
                  <div className="w-20 shrink-0" />
                  {recentHours.map(h => (
                    <div key={h} className="flex-1 text-[9px] text-muted-foreground text-center truncate">
                      {h.slice(11, 16)}
                    </div>
                  ))}
                </div>
                {/* Pipeline rows */}
                {uniquePipelines.map(pipeline => (
                  <div key={pipeline} className="flex gap-0.5 items-center">
                    <div className="w-20 shrink-0 text-[10px] text-muted-foreground truncate">
                      {PIPELINE_LABELS[pipeline]?.split(' ')[0] ?? pipeline}
                    </div>
                    {recentHours.map(hour => {
                      const bucket = buckets.find(b => b.hour === hour && b.pipeline === pipeline)
                      return (
                        <div
                          key={`${pipeline}-${hour}`}
                          className={cn(
                            'flex-1 h-5 rounded-sm transition-colors',
                            bucket ? heatmapColor(bucket.avgMs) : 'bg-muted/30'
                          )}
                          title={bucket ? `${bucket.avgMs}ms avg (${bucket.count} calls)` : 'No data'}
                        />
                      )
                    })}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-2 justify-end">
                  <span className="text-[9px] text-muted-foreground">Fast</span>
                  <div className="flex gap-0.5">
                    {['bg-emerald-500/20', 'bg-emerald-500/40', 'bg-amber-500/40', 'bg-orange-500/40', 'bg-red-500/50'].map((c, i) => (
                      <div key={i} className={cn('w-3 h-3 rounded-sm', c)} />
                    ))}
                  </div>
                  <span className="text-[9px] text-muted-foreground">Slow</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Failures */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            Failure Telemetry
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(summary?.recentFailures?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-muted-foreground">No failures in the selected window</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {summary!.recentFailures.map(f => (
                  <div
                    key={f.traceId}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => fetchTraceDetail(f.traceId)}
                  >
                    <div className={cn('w-2 h-2 rounded-full', PIPELINE_COLORS[f.pipeline] ?? 'bg-gray-500')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.operation}</span>
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{f.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={latencyColor(f.latencyMs)}>{f.latencyMs}ms</span>
                        <span>·</span>
                        <span>{new Date(f.createdAt).toLocaleString()}</span>
                        {f.metadata?.error && (
                          <>
                            <span>·</span>
                            <span className="text-red-400 truncate max-w-[200px]">{f.metadata.error}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Trace Detail Modal */}
      {selectedTrace && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Trace: {selectedTrace.operation}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTrace(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Trace metadata */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{selectedTrace.pipeline}</Badge>
                <Badge variant={selectedTrace.status === 'ok' ? 'default' : 'destructive'}>{selectedTrace.status}</Badge>
                <span className={cn('font-mono', latencyColor(selectedTrace.latencyMs))}>{selectedTrace.latencyMs}ms</span>
                {selectedTrace.authMethod && (
                  <Badge variant="secondary">{selectedTrace.authMethod}</Badge>
                )}
              </div>

              {/* Span waterfall */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2">Span Waterfall</p>
                {selectedTrace.spans.map((span, i) => {
                  const totalMs = selectedTrace.latencyMs || 1
                  const leftPct = (span.startMs / totalMs) * 100
                  const widthPct = Math.max(1, ((span.endMs - span.startMs) / totalMs) * 100)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-28 shrink-0 text-[10px] text-muted-foreground truncate text-right">
                        {span.name}
                      </div>
                      <div className="flex-1 h-4 bg-muted/30 rounded-sm relative overflow-hidden">
                        <div
                          className={cn(
                            'absolute h-full rounded-sm',
                            span.meta?.success === false ? 'bg-red-500/60' :
                            span.name.startsWith('tool.') ? 'bg-orange-500/60' :
                            span.name.startsWith('context') ? 'bg-cyan-500/60' :
                            'bg-blue-500/60'
                          )}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-14 text-right">
                        {span.endMs - span.startMs}ms
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Metadata */}
              {selectedTrace.metadata && Object.keys(selectedTrace.metadata).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Metadata</p>
                  <pre className="bg-muted/30 rounded-md p-2 overflow-auto max-h-[150px] text-[10px] font-mono">
                    {JSON.stringify(selectedTrace.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, valueClass, subtext }: {
  label: string
  value: string | number
  icon: React.ReactNode
  valueClass?: string
  subtext?: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={cn('text-lg font-bold font-mono', valueClass)}>{value}</div>
        {subtext && <div className="text-[10px] text-muted-foreground mt-0.5">{subtext}</div>}
      </CardContent>
    </Card>
  )
}
