'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { SethAvatar } from '@/components/ui/seth-avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Users,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Shield,
  Search,
  DollarSign,
  MessageSquare,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Radar,
  Save,
  BookOpen,
  Scale,
  TrendingUp,
  AlertTriangle,
  Landmark,
  BarChart3,
  GitFork,
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  codename: string
  role: string
  description: string
  systemPrompt: string
  capabilities: string | null
  tier: string
  status: string
  avatar: string | null
  totalRuns: number
  successRate: number
  lastActiveAt: string | null
  createdAt: string
  monitorEnabled: boolean
  monitorQuery: string | null
  monitorInterval: number
  lastMonitorAt: string | null
  lastMonitorResult: string | null
  _count: { dispatches: number }
}

interface DispatchResult {
  agentName: string
  agentCodename: string
  agentAvatar: string
  output: string
  tier: string
  model: string
  latencyMs: number
  success: boolean
  error?: string
}

const roleIcons: Record<string, React.ReactNode> = {
  research: <Search className="h-4 w-4" />,
  financial: <DollarSign className="h-4 w-4" />,
  communications: <MessageSquare className="h-4 w-4" />,
  opsec: <Shield className="h-4 w-4" />,
  brand: <Eye className="h-4 w-4" />,
}

const tierColors: Record<string, string> = {
  privacy: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  free: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  paid: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

const statusColors: Record<string, string> = {
  standby: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  disabled: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function AgentsPageClient() {
  const { data: session } = useSession() || {}
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [dispatchInput, setDispatchInput] = useState('')
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null)
  const [monitorEdits, setMonitorEdits] = useState<Record<string, { enabled: boolean; query: string; interval: number }>>({})
  const [savingMonitor, setSavingMonitor] = useState<string | null>(null)
  const [doctrineOpen, setDoctrineOpen] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Session expired — please sign out and sign in again')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data = await res.json()
      setAgents(data)
    } catch {
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const handleDispatch = async (codename: string) => {
    if (!dispatchInput.trim()) {
      toast.error('Enter a task for the agent')
      return
    }
    setDispatching(codename)
    setDispatchResult(null)
    try {
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCodename: codename, input: dispatchInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Dispatch failed')
      setDispatchResult(data)
      setDispatchInput('')
      fetchAgents() // refresh stats
      toast.success(`${data.agentName} completed the task`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDispatching(null)
    }
  }

  const getMonitorEdit = (agent: Agent) => {
    return monitorEdits[agent.id] ?? {
      enabled: agent.monitorEnabled,
      query: agent.monitorQuery || '',
      interval: agent.monitorInterval || 60,
    }
  }

  const updateMonitorEdit = (agentId: string, patch: Partial<{ enabled: boolean; query: string; interval: number }>) => {
    setMonitorEdits(prev => {
      const existing = prev[agentId] ?? {
        enabled: agents.find(a => a.id === agentId)?.monitorEnabled ?? false,
        query: agents.find(a => a.id === agentId)?.monitorQuery || '',
        interval: agents.find(a => a.id === agentId)?.monitorInterval || 60,
      }
      return { ...prev, [agentId]: { ...existing, ...patch } }
    })
  }

  const saveMonitorConfig = async (agentId: string) => {
    const edit = monitorEdits[agentId]
    if (!edit) return
    setSavingMonitor(agentId)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitorEnabled: edit.enabled,
          monitorQuery: edit.query,
          monitorInterval: edit.interval,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Monitor config saved')
      fetchAgents()
      setMonitorEdits(prev => { const n = { ...prev }; delete n[agentId]; return n })
    } catch {
      toast.error('Failed to save monitor config')
    } finally {
      setSavingMonitor(null)
    }
  }

  const parseCapabilities = (caps: string | null): string[] => {
    if (!caps) return []
    try { return JSON.parse(caps) } catch { return [] }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight flex items-center gap-3">
            <Users className="h-6 w-6 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
            Agent Roster
          </h1>
          <p className="text-muted-foreground mt-1">
            Specialized sub-agents standing by. Dispatch tasks directly or let Seth auto-route.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {agents.length} agents
        </Badge>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {agents.map((agent) => {
            const isExpanded = expandedAgent === agent.id
            const capabilities = parseCapabilities(agent.capabilities)
            return (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  isExpanded && 'md:col-span-2 xl:col-span-3'
                )}
              >
                <Card className={cn(
                  'border transition-all duration-300 hover:border-primary/30',
                  agent.status === 'active' && 'border-primary/20 shadow-lg shadow-primary/5',
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{agent.avatar || <SethAvatar size="md" />}</div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {agent.name}
                            {roleIcons[agent.role] || <Zap className="h-4 w-4" />}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono">/{agent.codename}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', tierColors[agent.tier])}>
                          {agent.tier.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs', statusColors[agent.status])}>
                          {agent.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5" />
                        <span>{agent.totalRuns} runs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {agent.successRate >= 90 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span>{agent.successRate.toFixed(0)}% success</span>
                      </div>
                      {agent.lastActiveAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(agent.lastActiveAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Capabilities */}
                    {capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs font-normal">
                            {cap.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* ARCHITECT Doctrine Documentation */}
                    {agent.codename === 'architect' && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setDoctrineOpen(!doctrineOpen)}
                          className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors w-full group"
                        >
                          <BookOpen className="h-4 w-4" />
                          <span>Core Doctrine: The After-Tax Wealth Equation</span>
                          <ChevronDown className={cn(
                            'h-3.5 w-3.5 ml-auto transition-transform duration-200 text-muted-foreground group-hover:text-amber-300',
                            doctrineOpen && 'rotate-180'
                          )} />
                        </button>
                        <AnimatePresence>
                          {doctrineOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                                {/* The Equation */}
                                <div className="text-center py-2">
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Every asset decision runs through one formula</p>
                                  <p className="font-mono text-sm sm:text-base text-foreground font-semibold leading-relaxed">
                                    After-Tax Wealth = Income − Taxes − Opportunity Cost − Financing Cost − Risk Adjustments + Asset Growth
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    A move is optimal only when the full equation nets positive over the holding horizon.
                                  </p>
                                </div>

                                {/* Variable Grid */}
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Income</p>
                                      <p className="text-xs text-muted-foreground">All cash flow the asset produces. Passive &gt; active; recurring &gt; transactional.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <Landmark className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Taxes</p>
                                      <p className="text-xs text-muted-foreground">Effective rate after structural optimization — entity selection, timing elections, residency.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <Scale className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Opportunity Cost</p>
                                      <p className="text-xs text-muted-foreground">What the same capital would produce in the next-best deployment. Every yes has a shadow no.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <BarChart3 className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Financing Cost</p>
                                      <p className="text-xs text-muted-foreground">True all-in cost of borrowed capital — interest, covenants, guarantee exposure.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Risk Adjustments</p>
                                      <p className="text-xs text-muted-foreground">Probability-weighted downside. Asymmetric bets (capped down, uncapped up) earn priority.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2 p-2 rounded bg-background/50">
                                    <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-violet-400 shrink-0" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Asset Growth</p>
                                      <p className="text-xs text-muted-foreground">Compounding appreciation net of depreciation, inflation, and dilution.</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Tax Guardrail */}
                                <div className="rounded border border-red-500/15 bg-red-500/5 p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Shield className="h-3.5 w-3.5 text-red-400" />
                                    <p className="text-xs font-semibold text-foreground">Tax Guardrail</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Every recommendation routes through entity structure → holding period → residency <span className="font-medium text-foreground">before</span> evaluating gross return. The question is never &quot;What does this pay?&quot; — always &quot;What do I keep, and in what structure?&quot;
                                  </p>
                                </div>

                                {/* Fork */}
                                <div className="rounded border border-primary/15 bg-primary/5 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <GitFork className="h-3.5 w-3.5 text-primary" />
                                    <p className="text-xs font-semibold text-foreground">Principal-Position Fork</p>
                                    <span className="text-xs text-muted-foreground">— One equation, two weightings</span>
                                  </div>
                                  <div className="grid sm:grid-cols-2 gap-2">
                                    <div className="p-2 rounded bg-background/50 space-y-1">
                                      <p className="text-xs font-semibold text-amber-400">High-Earner / Executive</p>
                                      <p className="text-xs text-muted-foreground">
                                        Taxes &amp; Opportunity Cost dominate. Capital available — constraint is structural efficiency. Emphasize after-tax yield per unit of complexity.
                                      </p>
                                    </div>
                                    <div className="p-2 rounded bg-background/50 space-y-1">
                                      <p className="text-xs font-semibold text-emerald-400">Working Household / Bootstrapper</p>
                                      <p className="text-xs text-muted-foreground">
                                        Financing Cost &amp; Risk dominate. Capital scarce — constraint is survival runway. Emphasize self-liquidating engines &amp; capital velocity (ROCE &gt; 50%).
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Expand/Collapse Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setExpandedAgent(isExpanded ? null : agent.id)
                        setDispatchResult(null)
                      }}
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-4 w-4 mr-1" /> Close Console</>
                      ) : (
                        <><ChevronDown className="h-4 w-4 mr-1" /> Open Console</>
                      )}
                    </Button>

                    {/* Dispatch Console */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 border-t pt-4"
                      >
                        <div className="flex gap-2">
                          <Textarea
                            placeholder={`Give ${agent.name} a task...`}
                            value={dispatchInput}
                            onChange={(e) => setDispatchInput(e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                        </div>
                        <Button
                          onClick={() => handleDispatch(agent.codename)}
                          disabled={dispatching === agent.codename || !dispatchInput.trim()}
                          className="w-full"
                        >
                          {dispatching === agent.codename ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                          ) : (
                            <><Send className="h-4 w-4 mr-2" /> Dispatch Task</>
                          )}
                        </Button>

                        {/* Dispatch Result */}
                        {dispatchResult && (
                          <Card className="bg-muted/50">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium flex items-center gap-2">
                                  {dispatchResult.agentAvatar} {dispatchResult.agentName} Response
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className={cn('text-xs', tierColors[dispatchResult.tier])}>
                                    {dispatchResult.tier}
                                  </Badge>
                                  <span>{dispatchResult.latencyMs}ms</span>
                                </div>
                              </div>
                              <ScrollArea className="max-h-[400px]">
                                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                  {dispatchResult.output}
                                </div>
                              </ScrollArea>
                            </CardContent>
                          </Card>
                        )}

                        {/* Autonomous Monitoring Config */}
                        <div className="border-t pt-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Radar className="h-4 w-4 text-primary" />
                            Autonomous Monitoring
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`monitor-${agent.id}`} className="text-sm text-muted-foreground">
                              Enable background monitoring
                            </Label>
                            <Switch
                              id={`monitor-${agent.id}`}
                              checked={getMonitorEdit(agent).enabled}
                              onCheckedChange={(checked) => updateMonitorEdit(agent.id, { enabled: checked })}
                            />
                          </div>
                          <Textarea
                            placeholder="What should this agent monitor? e.g. 'Watch for security vulnerabilities in recent tasks'"
                            value={getMonitorEdit(agent).query}
                            onChange={(e) => updateMonitorEdit(agent.id, { query: e.target.value })}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex items-center gap-3">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">Check every</Label>
                            <Input
                              type="number"
                              min={15}
                              max={1440}
                              value={getMonitorEdit(agent).interval}
                              onChange={(e) => updateMonitorEdit(agent.id, { interval: parseInt(e.target.value) || 60 })}
                              className="w-20 text-sm"
                            />
                            <span className="text-sm text-muted-foreground">minutes</span>
                          </div>
                          {agent.lastMonitorAt && (
                            <p className="text-xs text-muted-foreground">
                              Last check: {new Date(agent.lastMonitorAt).toLocaleString()}
                              {agent.lastMonitorResult && ` — ${agent.lastMonitorResult.substring(0, 100)}...`}
                            </p>
                          )}
                          {monitorEdits[agent.id] && (
                            <Button
                              size="sm"
                              onClick={() => saveMonitorConfig(agent.id)}
                              disabled={savingMonitor === agent.id}
                            >
                              {savingMonitor === agent.id ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
                              ) : (
                                <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Monitor Config</>
                              )}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
