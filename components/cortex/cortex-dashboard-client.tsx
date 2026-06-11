'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  TrendingUp,
  Zap,
  Target,
  RefreshCw,
  Loader2,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Shield,
  Pin,
  Trash2,
  RotateCcw,
  Network,
  FolderOpen,
  Eye,
  Gauge,
  Compass,
  SunMedium,
  Plus,
  Link2,
  Route,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AgentRoutingPanel } from '@/components/cortex/agent-routing-panel'
import { TelemetryPanel } from '@/components/cortex/telemetry-panel'

// ─── Types ───────────────────────────────────────────────────────────

interface CortexOverview {
  stats: {
    recentObservations: number
    totalObservations: number
    activePatternCount: number
    completionRate: number
    completedTasks: number
    totalTasks: number
    activeContradictionCount: number
    memoryCount: number
    avgMemoryStrength: number
    avgMemoryImportance: number
    entityCount: number
    relationCount: number
    projectCount: number
    activeInsightCount: number
  }
  patterns: CortexPattern[]
  contradictions: CortexContradiction[]
  latestReflection: CortexReflection | null
  sourceCounts: Array<{ source: string; count: number }>
  insights: CortexInsight[]
}

interface CortexPattern {
  id: string
  title: string
  description: string
  patternType: string
  frequency: number
  confidence: number
  impactScore: number
  recommendation: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface CortexReflection {
  id: string
  timeframe: string
  summary: string
  wins: string[]
  bottlenecks: string[]
  recurringThemes: string[]
  optimizationSuggestions: string[]
  executionScore: number
  focusScore: number
  consistencyScore: number
  createdAt: string
}

interface CortexContradiction {
  id: string
  category: string
  title: string
  description: string
  evidenceA: string
  evidenceB: string
  confidence: number
  severity: string
  status: string
  resolution: string | null
  createdAt: string
}

interface CortexEntity {
  id: string
  nodeType: string
  name: string
  description: string | null
  metadata: string | null
  mentionCount: number
  lastMentionedAt: string
}

interface CortexRelationEdge {
  id: string
  sourceId: string
  targetId: string
  edgeType: string
  weight: number
  source: { name: string; nodeType: string }
  target: { name: string; nodeType: string }
}

interface CortexInsight {
  id: string
  insightType: string
  title: string
  description: string
  severity: string
  confidence: number
  evidence: string | null
  status: string
  createdAt: string
}

interface CortexProjectItem {
  id: string
  name: string
  description: string | null
  status: string
  links: Array<{ id: string; entityType: string; entityId: string; context: string | null; linkedAt: string }>
}

// ─── Constants ───────────────────────────────────────────────────────

const patternTypeColors: Record<string, string> = {
  habit: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  workflow: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  avoidance: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  productivity: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  communication: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  'decision-making': 'bg-rose-500/15 text-rose-400 border-rose-500/25',
}

const nodeTypeColors: Record<string, string> = {
  person: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  project: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  goal: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  concept: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  organization: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
}

const insightTypeIcons: Record<string, typeof Brain> = {
  cognitive_load: Gauge,
  strategic_drift: Compass,
  environmental_correlation: SunMedium,
  temporal_pattern: Clock,
}

const sourceIcons: Record<string, typeof Brain> = {
  chat: Brain,
  task: CheckCircle2,
  agent: Zap,
  memory: Sparkles,
  calendar: Clock,
  email: Activity,
  automation: Target,
}

// ─── Component ───────────────────────────────────────────────────────

export default function CortexDashboardClient() {
  const [overview, setOverview] = useState<CortexOverview | null>(null)
  const [reflections, setReflections] = useState<CortexReflection[]>([])
  const [patterns, setPatterns] = useState<CortexPattern[]>([])
  const [contradictions, setContradictions] = useState<CortexContradiction[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [detectingConflicts, setDetectingConflicts] = useState(false)
  const [runningDecay, setRunningDecay] = useState(false)
  const [entities, setEntities] = useState<CortexEntity[]>([])
  const [relations, setRelations] = useState<CortexRelationEdge[]>([])
  const [projects, setProjects] = useState<CortexProjectItem[]>([])
  const [generatingInsights, setGeneratingInsights] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/overview')
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err)
    }
  }, [])

  const fetchReflections = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/reflections?limit=10')
      if (res.ok) {
        const data = await res.json()
        setReflections(data.reflections || [])
      }
    } catch (err) {
      console.error('Failed to fetch reflections:', err)
    }
  }, [])

  const fetchPatterns = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/patterns?status=all')
      if (res.ok) {
        const data = await res.json()
        setPatterns(data.patterns || [])
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err)
    }
  }, [])

  const fetchContradictions = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/contradictions?status=all')
      if (res.ok) {
        const data = await res.json()
        setContradictions(data.contradictions || [])
      }
    } catch (err) {
      console.error('Failed to fetch contradictions:', err)
    }
  }, [])

  const fetchRelationships = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/relationships')
      if (res.ok) {
        const data = await res.json()
        setEntities(data.entities || [])
        setRelations(data.relations || [])
      }
    } catch (err) {
      console.error('Failed to fetch relationships:', err)
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchReflections(), fetchPatterns(), fetchContradictions(), fetchRelationships(), fetchProjects()])
      setLoading(false)
    }
    init()
  }, [fetchOverview, fetchReflections, fetchPatterns, fetchContradictions, fetchRelationships, fetchProjects])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/cortex/analyze', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Analysis complete: ${data.newPatterns} new pattern${data.newPatterns !== 1 ? 's' : ''} detected`)
        await Promise.all([fetchOverview(), fetchPatterns()])
      } else {
        toast.error(data.error || 'Analysis failed')
      }
    } catch {
      toast.error('Failed to run analysis')
    } finally {
      setAnalyzing(false)
    }
  }

  const generateReflection = async (timeframe: 'daily' | 'weekly' | 'monthly') => {
    setReflecting(true)
    try {
      const res = await fetch('/api/cortex/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe }),
      })
      if (res.ok) {
        toast.success(`${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} reflection generated`)
        await fetchReflections()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Insufficient data')
      }
    } catch {
      toast.error('Failed to generate reflection')
    } finally {
      setReflecting(false)
    }
  }

  const sendFeedback = async (type: string, targetId: string) => {
    try {
      const res = await fetch('/api/cortex/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, targetType: 'pattern', targetId }),
      })
      if (res.ok) {
        toast.success(`Feedback recorded: ${type}`)
        await Promise.all([fetchOverview(), fetchPatterns()])
      }
    } catch {
      toast.error('Failed to send feedback')
    }
  }

  const runContradictionDetection = async () => {
    setDetectingConflicts(true)
    try {
      const res = await fetch('/api/cortex/contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Scan complete: ${data.newContradictions} contradiction${data.newContradictions !== 1 ? 's' : ''} found`)
        await Promise.all([fetchOverview(), fetchContradictions()])
      } else {
        toast.error(data.error || 'Detection failed')
      }
    } catch {
      toast.error('Failed to run contradiction detection')
    } finally {
      setDetectingConflicts(false)
    }
  }

  const resolveContradiction = async (id: string, action: 'resolve' | 'dismiss') => {
    try {
      const res = await fetch('/api/cortex/contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, contradictionId: id }),
      })
      if (res.ok) {
        toast.success(`Contradiction ${action}d`)
        await Promise.all([fetchOverview(), fetchContradictions()])
      }
    } catch {
      toast.error('Failed to process')
    }
  }

  const runDecayPass = async () => {
    setRunningDecay(true)
    try {
      const res = await fetch('/api/cortex/decay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Decay pass: ${data.processed} processed, ${data.archived} archived`)
        await fetchOverview()
      }
    } catch {
      toast.error('Failed to run decay')
    } finally {
      setRunningDecay(false)
    }
  }

  const runInsightGeneration = async () => {
    setGeneratingInsights(true)
    try {
      const res = await fetch('/api/cortex/insights', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Analysis complete: ${data.newInsights} new insight${data.newInsights !== 1 ? 's' : ''} generated`)
        await fetchOverview()
      } else {
        toast.error(data.error || 'Insight generation failed')
      }
    } catch {
      toast.error('Failed to generate insights')
    } finally {
      setGeneratingInsights(false)
    }
  }

  const dismissInsight = async (insightId: string, action: 'acknowledge' | 'dismiss') => {
    try {
      const res = await fetch('/api/cortex/insights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action }),
      })
      if (res.ok) {
        toast.success(`Insight ${action}d`)
        await fetchOverview()
      }
    } catch {
      toast.error('Failed to update insight')
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const res = await fetch('/api/cortex/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })
      if (res.ok) {
        toast.success(`Project "${newProjectName.trim()}" created`)
        setNewProjectName('')
        await fetchProjects()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create project')
      }
    } catch {
      toast.error('Failed to create project')
    } finally {
      setCreatingProject(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cortex initializing...</p>
        </div>
      </div>
    )
  }

  const stats = overview?.stats

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Cortex
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Adaptive learning engine — observing, analyzing, optimizing
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runAnalysis}
            disabled={analyzing}
            className="gap-1.5"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Analyze
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => Promise.all([fetchOverview(), fetchReflections(), fetchPatterns(), fetchContradictions(), fetchRelationships(), fetchProjects()])}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Activity}
          label="Observations (7d)"
          value={stats?.recentObservations ?? 0}
          subtext={`${stats?.totalObservations ?? 0} total`}
        />
        <StatCard
          icon={Target}
          label="Active Patterns"
          value={stats?.activePatternCount ?? 0}
          subtext="detected"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completion Rate"
          value={`${stats?.completionRate ?? 0}%`}
          subtext={`${stats?.completedTasks ?? 0}/${stats?.totalTasks ?? 0} tasks`}
        />
        <StatCard
          icon={TrendingUp}
          label="Execution Score"
          value={overview?.latestReflection?.executionScore ?? '—'}
          subtext="latest"
        />
        <StatCard
          icon={AlertTriangle}
          label="Contradictions"
          value={stats?.activeContradictionCount ?? 0}
          subtext="active"
        />
        <StatCard
          icon={Brain}
          label="Memory Health"
          value={`${((stats?.avgMemoryStrength ?? 1) * 100).toFixed(0)}%`}
          subtext={`${stats?.memoryCount ?? 0} memories`}
        />
        <StatCard
          icon={Network}
          label="Knowledge Graph"
          value={stats?.entityCount ?? 0}
          subtext={`${stats?.relationCount ?? 0} connections`}
        />
        <StatCard
          icon={Eye}
          label="Active Insights"
          value={stats?.activeInsightCount ?? 0}
          subtext={`${stats?.projectCount ?? 0} projects`}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border/60">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="reflections">Reflections</TabsTrigger>
          <TabsTrigger value="contradictions" className="gap-1.5">
            Contradictions
            {contradictions.filter(c => c.status === 'active').length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {contradictions.filter(c => c.status === 'active').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            Insights
            {(overview?.insights?.filter(i => i.status === 'active').length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {overview?.insights?.filter(i => i.status === 'active').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-1.5">
            <Route className="h-3.5 w-3.5" />
            Routing
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Telemetry
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Latest Reflection */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Latest Reflection
                </CardTitle>
                {overview?.latestReflection && (
                  <CardDescription>
                    {overview.latestReflection.timeframe} — {new Date(overview.latestReflection.createdAt).toLocaleDateString()}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {overview?.latestReflection ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed">{overview.latestReflection.summary}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <ScoreGauge label="Execution" value={overview.latestReflection.executionScore} />
                      <ScoreGauge label="Focus" value={overview.latestReflection.focusScore} />
                      <ScoreGauge label="Consistency" value={overview.latestReflection.consistencyScore} />
                    </div>
                    {overview.latestReflection.optimizationSuggestions.length > 0 && (
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Recommendations</p>
                        {overview.latestReflection.optimizationSuggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm py-1">
                            <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    message="No reflections yet. Generate one to see strategic insights."
                    action={
                      <Button size="sm" variant="outline" onClick={() => generateReflection('weekly')} disabled={reflecting}>
                        {reflecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                        Generate Weekly Reflection
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            {/* Top Patterns */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Active Patterns
                </CardTitle>
                <CardDescription>
                  Behavioral patterns detected from your interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.patterns && overview.patterns.length > 0 ? (
                  <ScrollArea className="h-[280px] pr-2">
                    <div className="space-y-2">
                      {overview.patterns.slice(0, 6).map((p) => (
                        <PatternCard key={p.id} pattern={p} onFeedback={sendFeedback} compact />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <EmptyState
                    message="No patterns detected yet. Use Seth more and run analysis to discover behavioral patterns."
                    action={
                      <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analyzing}>
                        {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                        Run Pattern Analysis
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Observation Sources */}
          {overview?.sourceCounts && overview.sourceCounts.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Observation Sources (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {overview.sourceCounts.map((s) => {
                    const Icon = sourceIcons[s.source] || Activity
                    return (
                      <div key={s.source} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/40">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium capitalize">{s.source}</span>
                        <Badge variant="secondary" className="text-xs">{s.count}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Memory Health Controls */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Memory Health
              </CardTitle>
              <CardDescription>
                Manage memory decay and strength across {overview?.stats?.memoryCount ?? 0} stored memories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Strength</span>
                    <span className="font-medium">{((overview?.stats?.avgMemoryStrength ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(overview?.stats?.avgMemoryStrength ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Importance</span>
                    <span className="font-medium">{((overview?.stats?.avgMemoryImportance ?? 0) / 10 * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${(overview?.stats?.avgMemoryImportance ?? 0) * 10}%` }}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runDecayPass}
                  disabled={runningDecay}
                  className="gap-1.5 shrink-0"
                >
                  {runningDecay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Run Decay Pass
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} detected
            </p>
            <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analyzing} className="gap-1.5">
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Run Analysis
            </Button>
          </div>
          {patterns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} onFeedback={sendFeedback} />
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-12">
                <EmptyState message="No patterns yet. Continue using Seth and run analysis to detect behavioral patterns." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reflections Tab */}
        <TabsContent value="reflections" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {reflections.length} reflection{reflections.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <Button
                  key={tf}
                  size="sm"
                  variant="outline"
                  onClick={() => generateReflection(tf)}
                  disabled={reflecting}
                  className="gap-1.5 capitalize"
                >
                  {reflecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {tf}
                </Button>
              ))}
            </div>
          </div>
          {reflections.length > 0 ? (
            <div className="space-y-4">
              {reflections.map((r) => (
                <ReflectionCard key={r.id} reflection={r} />
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-12">
                <EmptyState message="No reflections generated yet. Generate your first reflection to see strategic insights and performance analysis." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Relationships Tab */}
        <TabsContent value="relationships" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {entities.length} entities, {relations.length} connections
            </p>
            <Button size="sm" variant="outline" onClick={fetchRelationships} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Graph
            </Button>
          </div>

          {entities.length > 0 ? (
            <div className="space-y-4">
              {/* Entity Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {entities.slice(0, 18).map((entity) => (
                  <Card key={entity.id} className="border-border/60">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={cn('capitalize text-[10px]', nodeTypeColors[entity.nodeType] || '')}>
                              {entity.nodeType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{entity.mentionCount} mentions</span>
                          </div>
                          <h4 className="font-medium text-sm">{entity.name}</h4>
                          {entity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entity.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Relations */}
              {relations.length > 0 && (
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      Connections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] pr-2">
                      <div className="space-y-2">
                        {relations.slice(0, 30).map((rel) => (
                          <div key={rel.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-muted/50">
                            <span className="font-medium">{rel.source.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{rel.edgeType.replace(/_/g, ' ')}</Badge>
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-medium">{rel.target.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">w:{rel.weight.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Projects Section */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    Projects
                  </CardTitle>
                  <CardDescription>
                    Link entities, memories, and tasks to strategic projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="New project name..."
                      className="flex-1 bg-muted/50 border border-border/60 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                    <Button size="sm" onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()} className="gap-1.5">
                      {creatingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Create
                    </Button>
                  </div>
                  {projects.length > 0 ? (
                    <div className="space-y-2">
                      {projects.map((project) => (
                        <div key={project.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border/40">
                          <div>
                            <span className="text-sm font-medium">{project.name}</span>
                            {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize">{project.status}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{project.links.length} links</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No projects yet. Create one to start linking intelligence.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-12">
                <EmptyState message="No entities detected yet. As you use Seth, entities (people, projects, goals) will be automatically extracted from your conversations and memories." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Cognitive load, strategic drift, and environmental correlations
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={runInsightGeneration}
              disabled={generatingInsights}
              className="gap-1.5"
            >
              {generatingInsights ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Generate Insights
            </Button>
          </div>
          {(overview?.insights?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {overview?.insights?.map((insight) => {
                const InsightIcon = insightTypeIcons[insight.insightType] || Eye
                return (
                  <Card key={insight.id} className={`border-border/60 ${insight.status !== 'active' ? 'opacity-60' : ''}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          insight.severity === 'critical' ? 'bg-red-500/10' : insight.severity === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                        )}>
                          <InsightIcon className={cn(
                            'h-4 w-4',
                            insight.severity === 'critical' ? 'text-red-400' : insight.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                          )} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}
                              className={insight.severity === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : ''}
                            >
                              {insight.severity}
                            </Badge>
                            <Badge variant="outline" className="capitalize text-[10px]">{insight.insightType.replace(/_/g, ' ')}</Badge>
                            <span className="text-xs text-muted-foreground ml-auto">{Math.round(insight.confidence * 100)}% confidence</span>
                          </div>
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{insight.description}</p>
                        </div>
                      </div>
                      {insight.status === 'active' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/40 ml-11">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissInsight(insight.id, 'acknowledge')}
                            className="gap-1.5 text-blue-400 hover:text-blue-300"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissInsight(insight.id, 'dismiss')}
                            className="gap-1.5 text-muted-foreground"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-12">
                <EmptyState
                  message="No insights generated yet. Run analysis to detect cognitive load, strategic drift, and environmental patterns."
                  action={
                    <Button size="sm" variant="outline" onClick={runInsightGeneration} disabled={generatingInsights}>
                      {generatingInsights ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                      Generate Insights
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contradictions Tab */}
        <TabsContent value="contradictions" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {contradictions.filter(c => c.status === 'active').length} active contradiction{contradictions.filter(c => c.status === 'active').length !== 1 ? 's' : ''} detected
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={runContradictionDetection}
              disabled={detectingConflicts}
              className="gap-1.5"
            >
              {detectingConflicts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              Scan for Contradictions
            </Button>
          </div>
          {contradictions.length > 0 ? (
            <div className="space-y-3">
              {contradictions.map((c) => (
                <Card key={c.id} className={`border-border/60 ${c.status !== 'active' ? 'opacity-60' : ''}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={c.severity === 'critical' ? 'destructive' : c.severity === 'high' ? 'destructive' : 'secondary'}
                            className={c.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : ''}
                          >
                            {c.severity}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{c.category.replace('_', ' ')}</Badge>
                          {c.status !== 'active' && (
                            <Badge variant="secondary" className="capitalize">{c.status}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {Math.round(c.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{c.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                            <p className="text-xs font-medium text-red-400 mb-1">Evidence A</p>
                            <p className="text-sm">{c.evidenceA}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <p className="text-xs font-medium text-blue-400 mb-1">Evidence B</p>
                            <p className="text-sm">{c.evidenceB}</p>
                          </div>
                        </div>
                        {c.resolution && (
                          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                            <p className="text-xs font-medium text-green-400 mb-1">Resolution</p>
                            <p className="text-sm">{c.resolution}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {c.status === 'active' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveContradiction(c.id, 'resolve')}
                          className="gap-1.5 text-green-400 hover:text-green-300"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveContradiction(c.id, 'dismiss')}
                          className="gap-1.5 text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="py-12">
                <EmptyState message="No contradictions detected. Run a scan to check for conflicting preferences, decisions, or goals." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Agent Routing Tab */}
        <TabsContent value="routing" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Adaptive agent selection, performance-based scoring, and routing analytics
            </p>
          </div>
          <AgentRoutingPanel />
        </TabsContent>

        <TabsContent value="telemetry" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Pipeline traces, latency heatmaps, context injection visibility, and failure diagnostics
            </p>
          </div>
          <TelemetryPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, subtext }: {
  icon: typeof Brain
  label: string
  value: number | string
  subtext: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
      </CardContent>
    </Card>
  )
}

function ScoreGauge({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'text-emerald-400' : value >= 40 ? 'text-amber-400' : 'text-rose-400'
  const bgColor = value >= 70 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="text-center">
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-1.5">
        <div className={cn('absolute left-0 top-0 h-full rounded-full transition-all', bgColor)} style={{ width: `${value}%` }} />
      </div>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  )
}

function PatternCard({ pattern, onFeedback, compact }: {
  pattern: CortexPattern
  onFeedback: (type: string, id: string) => void
  compact?: boolean
}) {
  const typeColor = patternTypeColors[pattern.patternType] || patternTypeColors.workflow
  const confidencePct = Math.round(pattern.confidence * 100)
  const isActive = pattern.status === 'active'

  return (
    <div className={cn(
      'rounded-lg border border-border/60 p-3 transition-colors',
      isActive ? 'bg-card' : 'bg-muted/30 opacity-70',
    )}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-[10px] shrink-0', typeColor)}>
              {pattern.patternType}
            </Badge>
            <span className="text-xs text-muted-foreground">{confidencePct}% confidence</span>
          </div>
          <h4 className="text-sm font-medium leading-tight truncate">{pattern.title}</h4>
        </div>
        {isActive && (
          <div className="flex gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback('accept', pattern.id)} title="Confirms this pattern">
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback('reject', pattern.id)} title="Disagree with this pattern">
              <ThumbsDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFeedback('suppress', pattern.id)} title="Hide this pattern">
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {!compact && <p className="text-xs text-muted-foreground leading-relaxed mb-2">{pattern.description}</p>}
      {pattern.recommendation && (
        <div className="flex items-start gap-1.5 text-xs bg-primary/5 rounded px-2 py-1.5 border border-primary/10">
          <Lightbulb className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
          <span className={compact ? 'line-clamp-2' : ''}>{pattern.recommendation}</span>
        </div>
      )}
    </div>
  )
}

function ReflectionCard({ reflection }: { reflection: CortexReflection }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize text-xs">{reflection.timeframe}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(reflection.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </div>
        <p className="text-sm leading-relaxed mt-2">{reflection.summary}</p>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Scores */}
          <div className="grid grid-cols-3 gap-3">
            <ScoreGauge label="Execution" value={reflection.executionScore} />
            <ScoreGauge label="Focus" value={reflection.focusScore} />
            <ScoreGauge label="Consistency" value={reflection.consistencyScore} />
          </div>

          {/* Wins */}
          {reflection.wins.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald-400 mb-1">Wins</p>
              {reflection.wins.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm py-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottlenecks */}
          {reflection.bottlenecks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-400 mb-1">Bottlenecks</p>
              {reflection.bottlenecks.map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-sm py-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Optimization Suggestions */}
          {reflection.optimizationSuggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-primary mb-1">Optimization Suggestions</p>
              {reflection.optimizationSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm py-0.5">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recurring Themes */}
          {reflection.recurringThemes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {reflection.recurringThemes.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Brain className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
