'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  Brain,
  CheckSquare,
  MessageSquare,
  Radar,
  Zap,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  Sparkles,
  Shield,
  Globe,
  Target,
  Gauge,
  AlertTriangle,
  Wrench,
  Users,
  Eye,
  GitFork,
  Scale,
  Crosshair,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types matching the new 3-pillar structure ────────────────────
interface ReliabilityData {
  period: string
  since: string
  operational: {
    toolSuccessRate: { totalCalls: number; failures: number; rate: number; byTool: Record<string, { calls: number; failures: number; rate: number }> }
    agentDispatchRate: { totalDispatches: number; successes: number; failures: number; rate: number; byAgent: Record<string, { dispatches: number; successes: number; rate: number; avgLatencyMs: number }> }
    systemErrorRate: { totalResponses: number; fallbackCount: number; errorCount: number; rate: number }
  }
  reasoning: {
    routingPrecision: {
      total: number; withCandidateScores: number
      avgSelectedScore: number; avgBestScore: number; avgScoreGap: number
      positive: number; negative: number; neutral: number; unrated: number; outcomeRate: number
    }
    memoryUtilization: {
      totalRetrievals: number; totalMemoriesRetrieved: number; totalMemoriesReferenced: number
      totalMemoriesIgnored: number; utilizationRate: number; avgSimilarityScore: number; avgImportance: number
    }
    reasoningDrift: {
      totalConversations: number; clarificationRate: number
      correctionSignals: number; totalUserMessages: number; correctionRate: number
    }
  }
  execution: {
    workflowCompletion: { totalDelegated: number; completed: number; rate: number }
    decisionQuality: {
      totalDecisions: number; reversals: number; clarificationRequests: number
      avgConfidence: number; confidenceCalibration: number
    }
    decisionLatency: { avgMs: number; p50Ms: number; p95Ms: number; samples: number }
  }
  compositeScores: { operational: number; reasoning: number; execution: number; overall: number }
}

interface SystemStats {
  overview: {
    totalInteractions: number; last24h: number; last7d: number; avgLatencyMs: number
    memories: number; tasks: number; tasksByStatus: Record<string, number>; conversations: number; messages: number; watches: number
  }
  tierDistribution: Record<string, number>
  toolUsage: Record<string, number>
  recentActivity: Array<{
    id: string; action: string; tier: string | null; model: string | null; provider: string | null
    toolName: string | null; latencyMs: number | null; success: boolean; error: string | null
    createdAt: string; metadata: string | null
  }>
}

const tierColors: Record<string, string> = {
  privacy: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  free: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
  paid: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25',
}
const tierLabels: Record<string, string> = { privacy: 'PRIVATE', free: 'FREE', paid: 'PREMIUM' }
const actionIcons: Record<string, any> = {
  chat: MessageSquare, tool_call: Zap, auto_execute: Shield, consolidation: Brain, reprioritize: TrendingUp,
}
const toolLabels: Record<string, string> = {
  web_search: 'Web Search', create_task: 'Create Task', save_memory: 'Save Memory',
  search_memories: 'Search Memories', generate_environment: 'Generate Environment',
  browser_automate: 'Browser Automation', check_calendar: 'Calendar', triage_email: 'Email',
}

function formatRate(rate: number): string { return `${(rate * 100).toFixed(1)}%` }
function formatScore(score: number): string { return `${Math.round(score)}` }

function rateColor(rate: number, inverted = false): string {
  const good = inverted ? rate < 0.05 : rate > 0.9
  const warn = inverted ? rate < 0.15 : rate > 0.7
  if (good) return 'text-emerald-500'
  if (warn) return 'text-amber-500'
  return 'text-red-500'
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-500'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-500'
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

export default function SystemDashboardClient() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [reliability, setReliability] = useState<ReliabilityData | null>(null)
  const [reliabilityPeriod, setReliabilityPeriod] = useState<'24' | '168' | '720'>('168')
  const [loading, setLoading] = useState(true)
  const [consolidating, setConsolidating] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, relRes] = await Promise.all([
        fetch('/api/system/stats'),
        fetch(`/api/system/reliability?hours=${reliabilityPeriod}`),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (relRes.ok) setReliability(await relRes.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [reliabilityPeriod])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleConsolidate = async () => {
    setConsolidating(true)
    try {
      const res = await fetch('/api/memories/consolidate', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Consolidated ${data.insights?.length ?? 0} insights from ${data.messagesAnalyzed} messages`)
        fetchStats()
      } else { toast.error(data.message ?? 'Consolidation failed') }
    } catch { toast.error('Consolidation failed') } finally { setConsolidating(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const o = stats?.overview
  const tierTotal = Object.values(stats?.tierDistribution ?? {}).reduce((a, b) => a + b, 0) || 1
  const r = reliability

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">System Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Seth operational intelligence &amp; reliability scoring</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleConsolidate} disabled={consolidating}>
            {consolidating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            Consolidate Memories
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Activity className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{o?.totalInteractions ?? 0}</p><p className="text-xs text-muted-foreground">Total Interactions</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Clock className="w-5 h-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{o?.last24h ?? 0}</p><p className="text-xs text-muted-foreground">Last 24 Hours</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Zap className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-bold">{o?.avgLatencyMs ?? 0}<span className="text-sm font-normal text-muted-foreground">ms</span></p><p className="text-xs text-muted-foreground">Avg Latency (7d)</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><MessageSquare className="w-5 h-5 text-purple-500" /></div>
            <div><p className="text-2xl font-bold">{o?.messages ?? 0}</p><p className="text-xs text-muted-foreground">Messages Total</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* ============================================================ */}
      {/* THREE-PILLAR RELIABILITY SCORECARD                          */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4" /> Reliability Scorecard
              </CardTitle>
              <CardDescription>Three-pillar integrity assessment — Operational · Reasoning · Execution</CardDescription>
            </div>
            <div className="flex gap-1">
              {(['24', '168', '720'] as const).map(p => (
                <Button key={p} variant={reliabilityPeriod === p ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2" onClick={() => setReliabilityPeriod(p)}>
                  {p === '24' ? '24h' : p === '168' ? '7d' : '30d'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {r ? (
            <div className="space-y-6">
              {/* Composite Score Bar */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Overall', score: r.compositeScores.overall, icon: Target },
                  { label: 'Operational', score: r.compositeScores.operational, icon: Shield },
                  { label: 'Reasoning', score: r.compositeScores.reasoning, icon: Brain },
                  { label: 'Execution', score: r.compositeScores.execution, icon: Crosshair },
                ].map(({ label, score, icon: Icon }) => (
                  <div key={label} className={cn('p-3 rounded-lg border', scoreBg(score))}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
                    </div>
                    <p className={cn('text-2xl font-bold', scoreColor(score))}>{formatScore(score)}</p>
                    <p className="text-[10px] text-muted-foreground">/ 100</p>
                  </div>
                ))}
              </div>

              {/* ─── Pillar 1: Operational Reliability ─── */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Pillar 1: Operational Reliability
                  <span className="text-[10px] font-normal">— is the infrastructure working?</span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tool Success</span>
                    </div>
                    <p className={cn('text-xl font-bold', rateColor(r.operational.toolSuccessRate.rate))}>
                      {formatRate(r.operational.toolSuccessRate.rate)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.operational.toolSuccessRate.totalCalls} calls · {r.operational.toolSuccessRate.failures} failed</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Agent Dispatch</span>
                    </div>
                    <p className={cn('text-xl font-bold', rateColor(r.operational.agentDispatchRate.rate))}>
                      {formatRate(r.operational.agentDispatchRate.rate)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.operational.agentDispatchRate.totalDispatches} dispatches</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">System Errors</span>
                    </div>
                    <p className={cn('text-xl font-bold', rateColor(r.operational.systemErrorRate.rate, true))}>
                      {formatRate(r.operational.systemErrorRate.rate)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.operational.systemErrorRate.fallbackCount} fallbacks · {r.operational.systemErrorRate.errorCount} errors</p>
                  </div>
                </div>
              </div>

              {/* ─── Pillar 2: Reasoning Reliability ─── */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> Pillar 2: Reasoning Reliability
                  <span className="text-[10px] font-normal">— is the thinking correct?</span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {/* Routing Precision */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <GitFork className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Routing Precision</span>
                    </div>
                    {r.reasoning.routingPrecision.withCandidateScores > 0 ? (
                      <>
                        <p className="text-xl font-bold text-foreground">
                          {r.reasoning.routingPrecision.avgScoreGap.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">score gap (0 = perfect)</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          sel: {r.reasoning.routingPrecision.avgSelectedScore.toFixed(1)} / best: {r.reasoning.routingPrecision.avgBestScore.toFixed(1)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={cn('text-xl font-bold', rateColor(r.reasoning.routingPrecision.outcomeRate))}>
                          {formatRate(r.reasoning.routingPrecision.outcomeRate)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{r.reasoning.routingPrecision.total} decisions (outcome-based)</p>
                      </>
                    )}
                  </div>
                  {/* Memory Utilization */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Memory Util.</span>
                    </div>
                    <p className={cn('text-xl font-bold',
                      r.reasoning.memoryUtilization.totalRetrievals > 0
                        ? rateColor(r.reasoning.memoryUtilization.utilizationRate)
                        : 'text-muted-foreground'
                    )}>
                      {r.reasoning.memoryUtilization.totalRetrievals > 0
                        ? formatRate(r.reasoning.memoryUtilization.utilizationRate)
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.reasoning.memoryUtilization.totalMemoriesReferenced}/{r.reasoning.memoryUtilization.totalMemoriesRetrieved} referenced
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {r.reasoning.memoryUtilization.totalMemoriesIgnored} ignored · sim: {r.reasoning.memoryUtilization.avgSimilarityScore || '—'}
                    </p>
                  </div>
                  {/* Reasoning Drift */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reasoning Drift</span>
                    </div>
                    <p className={cn('text-xl font-bold', rateColor(r.reasoning.reasoningDrift.correctionRate, true))}>
                      {r.reasoning.reasoningDrift.totalUserMessages > 0
                        ? formatRate(r.reasoning.reasoningDrift.correctionRate)
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.reasoning.reasoningDrift.correctionSignals} corrections / {r.reasoning.reasoningDrift.totalUserMessages} messages</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatRate(r.reasoning.reasoningDrift.clarificationRate)} conv. needed clarification
                    </p>
                  </div>
                </div>
              </div>

              {/* ─── Pillar 3: Execution Reliability ─── */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" /> Pillar 3: Execution Reliability
                  <span className="text-[10px] font-normal">— are outcomes valuable?</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Workflow Completion */}
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">Workflow Completion</span>
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Output Metric</Badge>
                    </div>
                    <p className={cn('text-3xl font-bold', r.execution.workflowCompletion.totalDelegated > 0 ? rateColor(r.execution.workflowCompletion.rate) : 'text-muted-foreground')}>
                      {r.execution.workflowCompletion.totalDelegated > 0 ? formatRate(r.execution.workflowCompletion.rate) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.execution.workflowCompletion.completed}/{r.execution.workflowCompletion.totalDelegated} completed
                    </p>
                  </div>
                  {/* Decision Quality */}
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Decision Quality</span>
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">Cognition Metric</Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Confidence Calibration</span>
                        <span className={cn('text-sm font-bold', rateColor(r.execution.decisionQuality.confidenceCalibration))}>
                          {formatRate(r.execution.decisionQuality.confidenceCalibration)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Recommendation Reversals</span>
                        <span className="text-sm font-bold text-foreground">{r.execution.decisionQuality.reversals}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Clarification Requests</span>
                        <span className="text-sm font-bold text-foreground">{r.execution.decisionQuality.clarificationRequests}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Avg Routing Confidence</span>
                        <span className="text-sm font-bold text-foreground">{r.execution.decisionQuality.avgConfidence}</span>
                      </div>
                    </div>
                  </div>
                  {/* Decision Latency */}
                  <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">Decision Latency</span>
                      <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">Speed Metric</Badge>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl font-bold text-foreground">
                        {r.execution.decisionLatency.samples > 0 ? `${(r.execution.decisionLatency.p50Ms / 1000).toFixed(1)}s` : '—'}
                      </p>
                      <span className="text-xs text-muted-foreground">p50</span>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {r.execution.decisionLatency.samples > 0 ? `${(r.execution.decisionLatency.p95Ms / 1000).toFixed(1)}s` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">p95</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{r.execution.decisionLatency.samples} samples</p>
                  </div>
                </div>
              </div>

              {/* Agent Breakdown */}
              {Object.keys(r.operational.agentDispatchRate.byAgent).length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Agent Performance</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(r.operational.agentDispatchRate.byAgent).map(([name, data]) => (
                      <div key={name} className="p-2 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{name}</span>
                          <span className={cn('text-xs font-bold', rateColor(data.rate))}>{formatRate(data.rate)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {data.dispatches} runs · {data.avgLatencyMs}ms avg
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Loading reliability metrics...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Stats + Tier Distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Knowledge Base</CardTitle>
            <CardDescription>Seth&apos;s accumulated intelligence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /><span className="text-sm">Memories</span></div>
              <span className="text-sm font-semibold">{o?.memories ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-primary" /><span className="text-sm">Tasks</span></div>
              <div className="flex gap-1.5">
                {Object.entries(o?.tasksByStatus ?? {}).map(([status, count]) => (
                  <Badge key={status} variant="outline" className="text-[10px] py-0">{status}: {count}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /><span className="text-sm">Conversations</span></div>
              <span className="text-sm font-semibold">{o?.conversations ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2"><Radar className="w-4 h-4 text-primary" /><span className="text-sm">Active Watches</span></div>
              <span className="text-sm font-semibold">{o?.watches ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Model Routing (30d)</CardTitle>
            <CardDescription>How requests are distributed across tiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {['privacy', 'free', 'paid'].map(tier => {
              const count = stats?.tierDistribution?.[tier] ?? 0
              const pct = Math.round((count / tierTotal) * 100)
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className={cn('text-xs', tierColors[tier])}>{tierLabels[tier]}</Badge>
                    <span className="text-sm text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', tier === 'privacy' ? 'bg-emerald-500' : tier === 'free' ? 'bg-blue-500' : 'bg-purple-500')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Tool Usage (30d)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats?.toolUsage ?? {}).sort((a, b) => b[1] - a[1]).map(([tool, count]) => (
                  <Badge key={tool} variant="outline" className="text-[10px]">{toolLabels[tool] ?? tool}: {count}</Badge>
                ))}
                {Object.keys(stats?.toolUsage ?? {}).length === 0 && (
                  <span className="text-xs text-muted-foreground">No tool calls yet</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Last 50 agent interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {(stats?.recentActivity ?? []).map((log) => {
                const Icon = actionIcons[log.action] ?? Activity
                return (
                  <div key={log.id} className={cn('flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-colors hover:bg-accent/50', !log.success && 'bg-destructive/5')}>
                    <Icon className={cn('w-4 h-4 shrink-0', log.success ? 'text-primary' : 'text-destructive')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{log.action.replace('_', ' ')}</span>
                        {log.toolName && <Badge variant="outline" className="text-[10px] py-0">{toolLabels[log.toolName] ?? log.toolName}</Badge>}
                        {log.tier && <Badge variant="outline" className={cn('text-[10px] py-0', tierColors[log.tier])}>{tierLabels[log.tier] ?? log.tier}</Badge>}
                      </div>
                      {log.model && <p className="text-[10px] text-muted-foreground truncate">{log.model}</p>}
                      {log.error && <p className="text-[10px] text-destructive truncate">{log.error}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {log.latencyMs != null && <span className="text-xs text-muted-foreground">{log.latencyMs}ms</span>}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              {(stats?.recentActivity ?? []).length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity recorded yet</p>
                  <p className="text-xs">Start chatting with Seth to see activity logs here</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
