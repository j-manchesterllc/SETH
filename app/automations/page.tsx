'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Play,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Code2,
  ChevronDown,
  Globe,
  Zap,
  RotateCcw,
  Shield,
  AlertTriangle,
  BarChart3,
  Activity,
  TrendingUp,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { SethAvatar } from '@/components/ui/seth-avatar'

interface Automation {
  id: string
  taskDesc: string
  targetUrl: string | null
  status: string
  result: string | null
  partialResult: string | null
  error: string | null
  errorType: string | null
  durationMs: number | null
  retryCount: number
  executionPhase: string | null
  stepsTotal: number | null
  stepsCompleted: number | null
  createdAt: string
}

interface Metrics {
  total: number
  completed: number
  failed: number
  partial: number
  running: number
  successRate: number
  retryRate: number
  medianDurationMs: number
  avgStepCompletion: number
  failureBreakdown: Record<string, number>
  duplicatesBlocked: number
  ssrfBlocked: number
  last7Days: { total: number; completed: number; successRate: number }
  last30Days: { total: number; completed: number; successRate: number }
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showMetrics, setShowMetrics] = useState(false)

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations')
      if (res.ok) {
        const data = await res.json()
        setAutomations(data.automations ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/automations/metrics')
      if (res.ok) {
        setMetrics(await res.json())
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchAutomations()
    fetchMetrics()
  }, [fetchAutomations, fetchMetrics])

  // Elapsed timer while running
  useEffect(() => {
    if (!running) {
      setElapsedSeconds(0)
      return
    }
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [running])

  const runAutomation = async (task?: string, url?: string) => {
    const finalTask = task ?? taskInput.trim()
    const finalUrl = url ?? urlInput.trim()

    if (!finalTask) {
      toast.error('Please describe what you want to automate')
      return
    }

    setRunning(true)
    setElapsedSeconds(0)
    try {
      const res = await fetch('/api/browser-automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: finalTask,
          url: finalUrl || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const stepInfo = data.stepsTotal ? ` (${data.stepsCompleted}/${data.stepsTotal} steps)` : ''
        toast.success(`Automation completed successfully${stepInfo}`)
        setExpandedId(data.automationId)
      } else if (data.errorType === 'duplicate') {
        toast.info('This automation is already running or recently completed')
      } else {
        toast.error(data.error ?? 'Automation failed')
      }

      if (!task) {
        setTaskInput('')
        setUrlInput('')
      }
      fetchAutomations()
      fetchMetrics()
    } catch (err: any) {
      toast.error(err?.message ?? 'Automation request failed')
    } finally {
      setRunning(false)
    }
  }

  const retryAutomation = async (auto: Automation) => {
    await runAutomation(auto.taskDesc, auto.targetUrl ?? undefined)
  }

  const deleteAutomation = async (id: string) => {
    try {
      const res = await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAutomations(prev => prev.filter(a => a.id !== id))
        toast.success('Automation deleted')
        fetchMetrics()
      }
    } catch (err) {
      toast.error('Failed to delete')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'partial': return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />
      case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400'
      case 'partial': return 'text-amber-400'
      case 'failed': return 'text-red-400'
      case 'running': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return null
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const parseResult = (result: string | null): any => {
    if (!result) return null
    try {
      return JSON.parse(result)
    } catch {
      return result
    }
  }

  const getErrorIcon = (error: string | null) => {
    if (!error) return null
    if (error.includes('security') || error.includes('blocked')) return <Shield className="w-3 h-3" />
    if (error.includes('timed out') || error.includes('timeout')) return <Clock className="w-3 h-3" />
    return <AlertTriangle className="w-3 h-3" />
  }

  const getPhaseLabel = (phase: string | null) => {
    switch (phase) {
      case 'planning': return 'Planning'
      case 'navigating': return 'Navigating'
      case 'acting': return 'Executing'
      case 'extracting': return 'Extracting'
      case 'screenshot': return 'Capturing'
      case 'completed': return 'Done'
      default: return phase ?? 'Unknown'
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SethAvatar size="sm" glow />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Browser Automations</h1>
            <p className="text-sm text-muted-foreground">Remote headless browser for forms, scraping, and web tasks</p>
          </div>
        </div>
        {metrics && metrics.total > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowMetrics(!showMetrics)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {showMetrics ? 'Hide' : 'Metrics'}
          </Button>
        )}
      </div>

      {/* Metrics Panel */}
      {showMetrics && metrics && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Operational Metrics</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Success Rate', value: `${metrics.successRate}%`, icon: TrendingUp, color: metrics.successRate >= 80 ? 'text-emerald-400' : metrics.successRate >= 50 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Total Runs', value: metrics.total, icon: Layers, color: 'text-primary' },
              { label: 'Median Duration', value: formatDuration(metrics.medianDurationMs) ?? '—', icon: Clock, color: 'text-muted-foreground' },
              { label: 'Step Completion', value: `${metrics.avgStepCompletion}%`, icon: CheckCircle2, color: 'text-blue-400' },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon className={cn('w-3.5 h-3.5', stat.color)} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Last 7 Days</p>
              <p className="text-sm font-medium">
                {metrics.last7Days.completed}/{metrics.last7Days.total} successful
                <span className="text-xs text-muted-foreground ml-1">({metrics.last7Days.successRate}%)</span>
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Retry Rate</p>
              <p className="text-sm font-medium">
                {metrics.retryRate}%
                <span className="text-xs text-muted-foreground ml-1">of automations required retry</span>
              </p>
            </div>
          </div>

          {/* Safety metrics */}
          {(metrics.duplicatesBlocked > 0 || metrics.ssrfBlocked > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Duplicates Blocked</p>
                <p className="text-sm font-medium text-amber-400">{metrics.duplicatesBlocked}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> SSRF Blocked</p>
                <p className="text-sm font-medium text-red-400">{metrics.ssrfBlocked}</p>
              </div>
            </div>
          )}

          {Object.keys(metrics.failureBreakdown).length > 0 && (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground mb-2">Failure Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.failureBreakdown).map(([type, count]) => (
                  <span key={type} className="text-xs px-2 py-0.5 rounded-full border bg-red-950/10 text-red-400">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Automation Form */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">New Automation</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Task Description</label>
            <textarea
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              placeholder="Describe what you want to automate... e.g., 'Go to google.com, search for AI news, and extract the top 5 headlines'"
              className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              disabled={running}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Target URL (optional)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-9"
                  disabled={running}
                />
              </div>
              <Button
                onClick={() => runAutomation()}
                disabled={running || !taskInput.trim()}
                className="gap-2"
              >
                {running ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                ) : (
                  <><Play className="w-4 h-4" /> Execute</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Running Status */}
        {running && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-xs font-medium text-primary">Automation in progress</p>
              <p className="text-xs text-muted-foreground">
                Generating action plan and executing on remote browser... ({elapsedSeconds}s)
              </p>
            </div>
          </div>
        )}

        {/* Quick Examples */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-xs text-muted-foreground">Examples:</span>
          {[
            { task: 'Go to Hacker News and extract the top 10 post titles and links', url: 'https://news.ycombinator.com' },
            { task: 'Search Google for "best productivity tools 2025" and get the top 5 results with URLs', url: 'https://google.com' },
            { task: 'Check the current Bitcoin price on CoinGecko', url: 'https://www.coingecko.com' },
          ].map((ex, i) => (
            <button
              key={i}
              onClick={() => { setTaskInput(ex.task); setUrlInput(ex.url) }}
              className="text-xs px-2.5 py-1 rounded-full border bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              disabled={running}
            >
              {ex.task.slice(0, 45)}...
            </button>
          ))}
        </div>
      </div>

      {/* Automation History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">History</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : automations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="mx-auto mb-3 opacity-30"><SethAvatar size="lg" /></div>
            <p className="text-sm">No automations yet. Run your first one above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map(auto => {
              const isExpanded = expandedId === auto.id
              const result = parseResult(auto.result)
              const partialResult = parseResult(auto.partialResult)
              const hasSteps = auto.stepsTotal && auto.stepsTotal > 0
              return (
                <div key={auto.id} className="rounded-lg border bg-card overflow-hidden">
                  {/* Row header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                  >
                    {getStatusIcon(auto.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{auto.taskDesc}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {auto.targetUrl && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {auto.targetUrl}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(auto.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {auto.durationMs != null && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(auto.durationMs)}
                          </span>
                        )}
                        {hasSteps && (
                          <span className="text-xs text-muted-foreground">
                            {auto.stepsCompleted}/{auto.stepsTotal} steps
                          </span>
                        )}
                        {auto.retryCount > 0 && (
                          <span className="text-xs text-amber-400">
                            {auto.retryCount} retry
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {auto.executionPhase && auto.status === 'running' && (
                        <span className="text-xs text-muted-foreground">
                          {getPhaseLabel(auto.executionPhase)}
                        </span>
                      )}
                      <span className={cn('text-xs font-medium capitalize', getStatusColor(auto.status))}>
                        {auto.status}
                      </span>
                    </div>
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  </div>

                  {/* Step progress bar */}
                  {hasSteps && (
                    <div className="px-4 pb-1">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            auto.status === 'completed' ? 'bg-emerald-400' :
                            auto.status === 'partial' ? 'bg-amber-400' :
                            auto.status === 'failed' ? 'bg-red-400' : 'bg-primary'
                          )}
                          style={{ width: `${Math.round(((auto.stepsCompleted ?? 0) / auto.stepsTotal!) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-3 bg-accent/10">
                      {/* Result data */}
                      {result && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> Result
                          </p>
                          <pre className="text-xs bg-background rounded-md p-3 overflow-x-auto max-h-[300px] overflow-y-auto border">
                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Partial result (for partial completions) */}
                      {!result && partialResult && (
                        <div>
                          <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Partial Result ({auto.stepsCompleted}/{auto.stepsTotal} steps completed)
                          </p>
                          <pre className="text-xs bg-amber-950/10 text-amber-200 rounded-md p-3 overflow-x-auto max-h-[200px] overflow-y-auto border border-amber-900/20">
                            {typeof partialResult === 'string' ? partialResult : JSON.stringify(partialResult, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Error */}
                      {auto.error && (
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1.5">
                            {getErrorIcon(auto.error)} Error
                            {auto.errorType && (
                              <span className="font-normal text-red-400/70">({auto.errorType})</span>
                            )}
                          </p>
                          <pre className="text-xs bg-red-950/20 text-red-300 rounded-md p-3 overflow-x-auto border border-red-900/30 whitespace-pre-wrap">
                            {auto.error}
                          </pre>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {auto.targetUrl && (
                          <a
                            href={auto.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Open URL
                          </a>
                        )}
                        {(auto.status === 'failed' || auto.status === 'partial') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary hover:bg-primary/10 gap-1"
                            onClick={(e) => { e.stopPropagation(); retryAutomation(auto) }}
                            disabled={running}
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 ml-auto"
                          onClick={(e) => { e.stopPropagation(); deleteAutomation(auto.id) }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
