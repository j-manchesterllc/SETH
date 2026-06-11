'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Brain,
  Loader2,
  Zap,
  Target,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  Gauge,
  Send,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

interface RoutingAnalytics {
  totalDecisions: number
  methodBreakdown: Record<string, number>
  domainBreakdown: Record<string, number>
  agentSelectionFrequency: Record<string, number>
  averageConfidence: number
  outcomeBreakdown: Record<string, number>
  recentDecisions: Array<{
    id: string
    taskDomain: string | null
    routingMethod: string
    confidence: number
    outcome: string | null
    selectedAgent: { name: string; codename: string; avatar: string | null } | null
    createdAt: string
  }>
}

interface RoutingPreview {
  domain: { domain: string | null; confidence: number }
  routing: {
    method: string
    confidence: number
    selectedAgent: {
      name: string
      codename: string
      avatar: string
      score: number
      reasons: string[]
      breakdown: {
        capabilityMatch: number
        historicalSuccess: number
        domainExpertise: number
        latencyProfile: number
        recencyBonus: number
      }
    } | null
    allScores: Array<{
      name: string
      codename: string
      avatar: string
      score: number
      reasons: string[]
      breakdown: {
        capabilityMatch: number
        historicalSuccess: number
        domainExpertise: number
        latencyProfile: number
        recencyBonus: number
      }
    }>
    reasoning: string
    latencyMs: number
  }
}

// ─── Main Component ────────────────────────────────────────────────

export function AgentRoutingPanel() {
  const [analytics, setAnalytics] = useState<RoutingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [testTask, setTestTask] = useState('')
  const [preview, setPreview] = useState<RoutingPreview | null>(null)
  const [testing, setTesting] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/cortex/agent-routing?days=30')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAnalytics(data)
    } catch {
      toast.error('Failed to load routing analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  const testRouting = async () => {
    if (!testTask.trim()) return
    setTesting(true)
    setPreview(null)
    try {
      const res = await fetch('/api/cortex/agent-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskInput: testTask }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPreview(data)
    } catch {
      toast.error('Routing preview failed')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          icon={Zap}
          label="Total Decisions"
          value={analytics?.totalDecisions ?? 0}
        />
        <MiniStat
          icon={Target}
          label="Avg Confidence"
          value={`${((analytics?.averageConfidence ?? 0) * 100).toFixed(0)}%`}
        />
        <MiniStat
          icon={CheckCircle2}
          label="Positive Outcomes"
          value={analytics?.outcomeBreakdown?.positive ?? 0}
          accent="text-emerald-400"
        />
        <MiniStat
          icon={Activity}
          label="Methods Used"
          value={Object.keys(analytics?.methodBreakdown ?? {}).length}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Routing Method Distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Routing Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(analytics?.methodBreakdown ?? {}).length === 0 ? (
              <p className="text-xs text-muted-foreground">No routing decisions yet</p>
            ) : (
              Object.entries(analytics?.methodBreakdown ?? {}).map(([method, count]) => (
                <div key={method} className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(
                    'text-[10px] w-20 justify-center',
                    method === 'adaptive' && 'border-primary/50 text-primary',
                    method === 'llm' && 'border-purple-500/50 text-purple-400',
                    method === 'multi-agent' && 'border-amber-500/50 text-amber-400',
                    method === 'keyword' && 'border-muted-foreground/50',
                  )}>
                    {method}
                  </Badge>
                  <Progress
                    value={(count / (analytics?.totalDecisions || 1)) * 100}
                    className="h-2 flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Agent Selection Frequency */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Agent Selection Frequency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(analytics?.agentSelectionFrequency ?? {}).length === 0 ? (
              <p className="text-xs text-muted-foreground">No agents selected yet</p>
            ) : (
              Object.entries(analytics?.agentSelectionFrequency ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([codename, count]) => (
                  <div key={codename} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-20 text-muted-foreground uppercase">{codename}</span>
                    <Progress
                      value={(count / (analytics?.totalDecisions || 1)) * 100}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Domain Distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Domain Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(analytics?.domainBreakdown ?? {}).length === 0 ? (
              <p className="text-xs text-muted-foreground">No domain data yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(analytics?.domainBreakdown ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([domain, count]) => (
                    <Badge key={domain} variant="secondary" className="text-xs gap-1.5">
                      {domain}
                      <span className="text-primary font-bold">{count}</span>
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outcome Distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(analytics?.outcomeBreakdown ?? {}).length === 0 ? (
              <p className="text-xs text-muted-foreground">No outcome data yet — outcomes are recorded after dispatches</p>
            ) : (
              <div className="flex gap-3">
                {['positive', 'neutral', 'negative'].map(outcome => {
                  const count = analytics?.outcomeBreakdown?.[outcome] ?? 0
                  const total = Object.values(analytics?.outcomeBreakdown ?? {}).reduce((s, v) => s + v, 0) || 1
                  return (
                    <div key={outcome} className="flex-1 text-center">
                      <div className={cn(
                        'text-2xl font-bold',
                        outcome === 'positive' && 'text-emerald-400',
                        outcome === 'neutral' && 'text-amber-400',
                        outcome === 'negative' && 'text-red-400',
                      )}>
                        {count}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{outcome}</div>
                      <Progress
                        value={(count / total) * 100}
                        className={cn(
                          'h-1 mt-1.5',
                          outcome === 'positive' && '[&>div]:bg-emerald-400',
                          outcome === 'neutral' && '[&>div]:bg-amber-400',
                          outcome === 'negative' && '[&>div]:bg-red-400',
                        )}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Routing Simulator */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Routing Simulator
          </CardTitle>
          <CardDescription>Test how adaptive routing would score agents for a task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Describe a task to simulate routing..."
              value={testTask}
              onChange={e => setTestTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && testRouting()}
              className="flex-1 bg-background/50"
            />
            <Button
              size="sm"
              onClick={testRouting}
              disabled={testing || !testTask.trim()}
              className="gap-1.5"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Simulate
            </Button>
          </div>

          {preview && (
            <div className="space-y-3 pt-2">
              {/* Domain detection */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Detected domain:</span>
                {preview.domain.domain ? (
                  <Badge variant="outline" className="text-xs">{preview.domain.domain}</Badge>
                ) : (
                  <span className="text-muted-foreground italic">ambiguous</span>
                )}
                <span className="text-muted-foreground">
                  ({(preview.domain.confidence * 100).toFixed(0)}% confidence)
                </span>
              </div>

              {/* Selected agent */}
              {preview.routing.selectedAgent && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{preview.routing.selectedAgent.avatar}</span>
                    <span className="font-semibold text-sm">{preview.routing.selectedAgent.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      Score: {preview.routing.selectedAgent.score}/100
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                      {preview.routing.method}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{preview.routing.reasoning}</p>
                  {/* Score breakdown */}
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(preview.routing.selectedAgent.breakdown).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="text-xs font-bold text-primary">{val}</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All agent scores */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">All Agent Scores</p>
                {preview.routing.allScores.map(agent => (
                  <div
                    key={agent.codename}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md border',
                      agent.codename === preview.routing.selectedAgent?.codename
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/40 bg-card/30',
                    )}
                  >
                    <span className="text-sm">{agent.avatar}</span>
                    <span className="text-xs font-medium w-24">{agent.name}</span>
                    <Progress value={agent.score} className="h-1.5 flex-1" />
                    <span className="text-xs font-mono w-8 text-right">{agent.score}</span>
                    <div className="hidden md:flex gap-1 flex-wrap">
                      {agent.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="text-[9px] text-muted-foreground">{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Routing completed in {preview.routing.latencyMs}ms
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Routing Decisions */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Routing Decisions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchAnalytics} className="h-7 w-7 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!analytics?.recentDecisions?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No routing decisions recorded yet. Use &quot;auto&quot; or &quot;team&quot; mode when delegating to agents.
            </p>
          ) : (
            <div className="space-y-2">
              {analytics.recentDecisions.map(d => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-md bg-card/30 border border-border/40">
                  {d.selectedAgent && (
                    <span className="text-sm" title={d.selectedAgent.name}>
                      {d.selectedAgent.avatar || '⚡'}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">
                        {d.selectedAgent?.name || 'Unknown'}
                      </span>
                      <Badge variant="outline" className={cn(
                        'text-[9px] px-1 py-0',
                        d.routingMethod === 'adaptive' && 'border-primary/50 text-primary',
                        d.routingMethod === 'llm' && 'border-purple-500/50 text-purple-400',
                        d.routingMethod === 'multi-agent' && 'border-amber-500/50 text-amber-400',
                      )}>
                        {d.routingMethod}
                      </Badge>
                      {d.taskDomain && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{d.taskDomain}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                    {d.outcome === 'positive' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    {d.outcome === 'negative' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    {d.outcome === 'neutral' && <Activity className="h-3.5 w-3.5 text-amber-400" />}
                    {!d.outcome && <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function MiniStat({ icon: Icon, label, value, accent }: {
  icon: typeof Zap
  label: string
  value: number | string
  accent?: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={cn('h-4 w-4', accent || 'text-primary')} />
        <div>
          <div className="text-lg font-bold leading-tight">{value}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
