import { prisma } from '@/lib/prisma'
import {
  routeForBackground,
  buildHeaders,
  buildRequestBody,
  getBackgroundFallback,
  type ModelConfig,
} from '@/lib/model-router'

// ─── Types ──────────────────────────────────────────────────────────────

export interface AgentScore {
  agentId: string
  codename: string
  name: string
  avatar: string
  score: number          // 0-100 composite
  reasons: string[]      // human-readable score explanations
  breakdown: {
    capabilityMatch: number   // 0-30: how well capabilities match
    historicalSuccess: number // 0-25: success rate weighted by recency
    domainExpertise: number   // 0-20: learned domain scores
    latencyProfile: number    // 0-15: speed factor
    recencyBonus: number      // 0-10: recently active agents get bonus
  }
}

export interface RoutingResult {
  method: 'keyword' | 'adaptive' | 'llm' | 'multi-agent'
  selectedAgent: AgentScore | null
  allScores: AgentScore[]
  confidence: number
  domain: string | null
  multiAgentTeam?: AgentScore[]
  reasoning: string
  latencyMs: number
}

// ─── Domain Detection ───────────────────────────────────────────────────

const DOMAIN_PATTERNS: Record<string, RegExp> = {
  research: /\b(research|investigate|find out|look up|intelligence|analysis|market research|competitor|trend|data|report on|gather info|study|explore|survey|examine)\b/i,
  financial: /\b(financ|invest|portfolio|cashflow|revenue|valuation|deal|roi|tax|budget|capital|wealth|asset|profit|pricing|cost|margin)\b/i,
  communications: /\b(write|draft|email|pitch|communicate|message|persuad|negotiat|speech|press|copy|announce|stakeholder|narrative|outreach|proposal)\b/i,
  opsec: /\b(security|privacy|footprint|threat|protect|encrypt|opsec|surveillance|identity|breach|data broker|vpn|anonymous|audit|risk)\b/i,
  brand: /\b(brand|reputation|positioning|voice|content strategy|competitor monitor|logo|tagline|audience|perception|rebrand|marketing)\b/i,
}

export function detectTaskDomain(taskInput: string): { domain: string | null; confidence: number } {
  const lower = taskInput.toLowerCase()
  const matches: { domain: string; matchCount: number }[] = []

  for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
    const allMatches = lower.match(new RegExp(pattern.source, 'gi'))
    if (allMatches) {
      matches.push({ domain, matchCount: allMatches.length })
    }
  }

  if (matches.length === 0) return { domain: null, confidence: 0 }

  // Sort by match count
  matches.sort((a, b) => b.matchCount - a.matchCount)

  // Confidence: high if one domain dominates, lower if ambiguous
  const topCount = matches[0].matchCount
  const secondCount = matches.length > 1 ? matches[1].matchCount : 0
  const confidence = secondCount > 0
    ? Math.min(0.9, (topCount - secondCount) / topCount * 0.5 + 0.5)
    : Math.min(0.95, 0.6 + topCount * 0.1)

  return { domain: matches[0].domain, confidence }
}

// ─── Agent Scoring Engine ───────────────────────────────────────────────

const ROLE_DOMAIN_MAP: Record<string, string> = {
  research: 'research',
  financial: 'financial',
  communications: 'communications',
  opsec: 'opsec',
  brand: 'brand',
}

async function getRecentPerformance(agentId: string, days = 30): Promise<{
  recentRuns: number
  recentSuccessRate: number
  avgLatency: number
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const dispatches = await prisma.agentDispatch.findMany({
    where: { agentId, createdAt: { gte: since } },
    select: { success: true, latencyMs: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  if (dispatches.length === 0) {
    return { recentRuns: 0, recentSuccessRate: 100, avgLatency: 0 }
  }

  const successCount = dispatches.filter(d => d.success).length
  const latencies = dispatches.filter(d => d.latencyMs).map(d => d.latencyMs!)
  const avgLatency = latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : 0

  return {
    recentRuns: dispatches.length,
    recentSuccessRate: (successCount / dispatches.length) * 100,
    avgLatency: Math.round(avgLatency),
  }
}

async function getCortexPatternSignals(
  userId: string,
  agentCodename: string
): Promise<{ patternBoost: number; insights: string[] }> {
  try {
    // Look for Cortex patterns that mention this agent
    const patterns = await prisma.cortexPattern.findMany({
      where: {
        userId,
        status: 'active',
        OR: [
          { title: { contains: agentCodename } },
          { description: { contains: agentCodename } },
        ],
      },
      select: { title: true, confidence: true, frequency: true },
      take: 5,
    })

    if (patterns.length === 0) return { patternBoost: 0, insights: [] }

    // Average confidence of agent-related patterns
    const avgConfidence = patterns.reduce((s, p) => s + p.confidence, 0) / patterns.length
    const patternBoost = Math.round(avgConfidence * 5) // up to 5 points

    return {
      patternBoost,
      insights: patterns.map(p => p.title),
    }
  } catch {
    return { patternBoost: 0, insights: [] }
  }
}

export async function scoreAgentForTask(
  agent: {
    id: string
    codename: string
    name: string
    avatar: string | null
    role: string
    capabilities: string | null
    successRate: number
    totalRuns: number
    avgLatencyMs: number | null
    domainScores: string | null
    lastActiveAt: Date | null
  },
  taskInput: string,
  detectedDomain: string | null,
  userId: string
): Promise<AgentScore> {
  const reasons: string[] = []
  let capabilityMatch = 0
  let historicalSuccess = 0
  let domainExpertise = 0
  let latencyProfile = 0
  let recencyBonus = 0

  // 1. Capability Match (0-30)
  const capabilities: string[] = agent.capabilities ? JSON.parse(agent.capabilities) : []
  const lower = taskInput.toLowerCase()

  // Role-domain alignment
  const agentDomain = ROLE_DOMAIN_MAP[agent.role] || agent.role
  if (detectedDomain && agentDomain === detectedDomain) {
    capabilityMatch += 15
    reasons.push(`Primary domain match: ${detectedDomain}`)
  }

  // Capability keyword matching
  let capHits = 0
  for (const cap of capabilities) {
    const capWords = cap.replace(/_/g, ' ').toLowerCase()
    if (lower.includes(capWords) || capWords.split(' ').some(w => w.length > 3 && lower.includes(w))) {
      capHits++
    }
  }
  const capScore = Math.min(15, capHits * 5)
  capabilityMatch += capScore
  if (capHits > 0) reasons.push(`${capHits} capability keyword${capHits > 1 ? 's' : ''} matched`)

  // 2. Historical Success (0-25)
  const performance = await getRecentPerformance(agent.id)
  if (performance.recentRuns > 0) {
    // Weight recent performance more heavily
    const recentWeight = Math.min(1, performance.recentRuns / 10)
    const blendedRate = performance.recentSuccessRate * recentWeight + agent.successRate * (1 - recentWeight)
    historicalSuccess = Math.round((blendedRate / 100) * 25)
    if (blendedRate >= 90) reasons.push(`Excellent success rate: ${blendedRate.toFixed(0)}%`)
    else if (blendedRate < 70) reasons.push(`Below-average success rate: ${blendedRate.toFixed(0)}%`)
  } else {
    // No recent data — use overall rate with dampening
    historicalSuccess = Math.round((agent.successRate / 100) * 20)
    reasons.push('No recent dispatches — using historical rate')
  }

  // 3. Domain Expertise (0-20)
  if (detectedDomain && agent.domainScores) {
    try {
      const scores: Record<string, number> = JSON.parse(agent.domainScores)
      const domScore = scores[detectedDomain] ?? 0
      domainExpertise = Math.round((domScore / 100) * 20)
      if (domScore > 70) reasons.push(`Learned domain expertise: ${domScore.toFixed(0)}%`)
    } catch { /* ignore parse errors */ }
  }
  // Cortex pattern signals
  const cortexSignals = await getCortexPatternSignals(userId, agent.codename)
  domainExpertise = Math.min(20, domainExpertise + cortexSignals.patternBoost)
  if (cortexSignals.insights.length > 0) {
    reasons.push(`Cortex patterns: ${cortexSignals.insights[0]}`)
  }

  // 4. Latency Profile (0-15)
  const avgLat = performance.avgLatency || agent.avgLatencyMs || 0
  if (avgLat > 0) {
    // Under 3s is excellent, over 10s is poor
    const latScore = avgLat < 3000 ? 15 : avgLat < 5000 ? 12 : avgLat < 8000 ? 8 : avgLat < 12000 ? 4 : 2
    latencyProfile = latScore
    if (avgLat < 3000) reasons.push('Fast responder')
    else if (avgLat > 10000) reasons.push('Slow response profile')
  } else {
    latencyProfile = 8 // neutral default
  }

  // 5. Recency Bonus (0-10)
  if (agent.lastActiveAt) {
    const hoursSince = (Date.now() - new Date(agent.lastActiveAt).getTime()) / (1000 * 60 * 60)
    if (hoursSince < 1) { recencyBonus = 10; reasons.push('Active in last hour') }
    else if (hoursSince < 24) recencyBonus = 7
    else if (hoursSince < 72) recencyBonus = 4
    else recencyBonus = 1
  } else {
    recencyBonus = 0
    reasons.push('Never dispatched')
  }

  const score = capabilityMatch + historicalSuccess + domainExpertise + latencyProfile + recencyBonus

  return {
    agentId: agent.id,
    codename: agent.codename,
    name: agent.name,
    avatar: agent.avatar ?? '⚡',
    score,
    reasons,
    breakdown: {
      capabilityMatch,
      historicalSuccess,
      domainExpertise,
      latencyProfile,
      recencyBonus,
    },
  }
}

// ─── Adaptive Selection ─────────────────────────────────────────────────

export async function adaptiveSelectAgent(
  userId: string,
  taskInput: string,
  options?: { preferSpeed?: boolean; excludeAgents?: string[]; forceLLM?: boolean }
): Promise<RoutingResult> {
  const start = Date.now()
  const { domain, confidence: domainConfidence } = detectTaskDomain(taskInput)

  // Get all active agents
  const agents = await prisma.agent.findMany({
    where: {
      userId,
      status: { not: 'disabled' },
      ...(options?.excludeAgents?.length ? { codename: { notIn: options.excludeAgents } } : {}),
    },
    select: {
      id: true, codename: true, name: true, avatar: true, role: true,
      capabilities: true, successRate: true, totalRuns: true,
      avgLatencyMs: true, domainScores: true, lastActiveAt: true, tier: true,
    },
  })

  if (agents.length === 0) {
    return {
      method: 'adaptive',
      selectedAgent: null,
      allScores: [],
      confidence: 0,
      domain,
      reasoning: 'No active agents found.',
      latencyMs: Date.now() - start,
    }
  }

  // Score all agents
  const scores = await Promise.all(
    agents.map(a => scoreAgentForTask(a, taskInput, domain, userId))
  )

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score)

  const topScore = scores[0]
  const runnerUp = scores.length > 1 ? scores[1] : null
  const scoreGap = runnerUp ? topScore.score - runnerUp.score : 100

  // Determine routing method based on confidence
  let method: RoutingResult['method'] = 'adaptive'
  let selectedAgent = topScore
  let confidence = Math.min(0.98, topScore.score / 100)
  let reasoning = `Selected ${topScore.name} (score: ${topScore.score}) — ${topScore.reasons.slice(0, 3).join('; ')}`

  // If scores are very close and domain is ambiguous, use LLM for tiebreaking
  if ((scoreGap < 8 && domainConfidence < 0.7) || options?.forceLLM) {
    const llmResult = await llmTiebreak(taskInput, scores.slice(0, 3), domain)
    if (llmResult) {
      method = 'llm'
      const llmAgent = scores.find(s => s.codename === llmResult.codename)
      if (llmAgent) {
        selectedAgent = llmAgent
        confidence = llmResult.confidence
        reasoning = `LLM tiebreak selected ${llmAgent.name}: ${llmResult.reasoning}`
      }
    }
  }

  // Speed preference adjustment
  if (options?.preferSpeed && selectedAgent) {
    const fastest = [...scores].sort((a, b) => a.breakdown.latencyProfile - b.breakdown.latencyProfile)
    if (fastest[0].codename !== selectedAgent.codename && fastest[0].score > selectedAgent.score * 0.8) {
      selectedAgent = fastest[0]
      reasoning += ` (speed-adjusted to ${fastest[0].name})`
    }
  }

  const latencyMs = Date.now() - start

  // Record routing decision
  try {
    await prisma.routingDecision.create({
      data: {
        userId,
        taskInput: taskInput.slice(0, 2000),
        taskDomain: domain,
        selectedAgentId: selectedAgent.agentId,
        candidateScores: JSON.stringify(scores.map(s => ({
          agentId: s.agentId,
          codename: s.codename,
          score: s.score,
          reasons: s.reasons.slice(0, 3),
        }))),
        routingMethod: method,
        confidence,
        latencyMs,
      },
    })
  } catch (err) {
    console.error('[AgentRouter] Failed to record routing decision:', err)
  }

  return {
    method,
    selectedAgent,
    allScores: scores,
    confidence,
    domain,
    reasoning,
    latencyMs,
  }
}

// ─── Multi-Agent Team Selection ─────────────────────────────────────────

export async function selectMultiAgentTeam(
  userId: string,
  taskInput: string,
  teamSize = 2
): Promise<RoutingResult> {
  const start = Date.now()
  const baseResult = await adaptiveSelectAgent(userId, taskInput)

  if (baseResult.allScores.length < 2) {
    return { ...baseResult, method: 'multi-agent', multiAgentTeam: baseResult.selectedAgent ? [baseResult.selectedAgent] : [] }
  }

  // Select complementary agents (different roles/domains)
  const team: AgentScore[] = []
  const usedRoles = new Set<string>()

  for (const agent of baseResult.allScores) {
    if (team.length >= teamSize) break
    // For multi-agent, we want diverse capabilities
    const agentRole = agent.codename
    if (!usedRoles.has(agentRole) && agent.score > 20) {
      team.push(agent)
      usedRoles.add(agentRole)
    }
  }

  const latencyMs = Date.now() - start

  // Record multi-agent routing decision
  try {
    await prisma.routingDecision.create({
      data: {
        userId,
        taskInput: taskInput.slice(0, 2000),
        taskDomain: baseResult.domain,
        selectedAgentId: team[0]?.agentId || null,
        candidateScores: JSON.stringify(baseResult.allScores.map(s => ({
          agentId: s.agentId,
          codename: s.codename,
          score: s.score,
          reasons: s.reasons.slice(0, 3),
        }))),
        routingMethod: 'multi-agent',
        multiAgent: true,
        teamAgentIds: JSON.stringify(team.map(t => t.agentId)),
        confidence: baseResult.confidence,
        latencyMs,
      },
    })
  } catch (err) {
    console.error('[AgentRouter] Failed to record multi-agent decision:', err)
  }

  return {
    method: 'multi-agent',
    selectedAgent: team[0] || null,
    allScores: baseResult.allScores,
    confidence: baseResult.confidence,
    domain: baseResult.domain,
    multiAgentTeam: team,
    reasoning: `Multi-agent team: ${team.map(t => t.name).join(' + ')} for comprehensive coverage`,
    latencyMs,
  }
}

// ─── LLM Tiebreaker ────────────────────────────────────────────────────

async function llmTiebreak(
  taskInput: string,
  candidates: AgentScore[],
  domain: string | null
): Promise<{ codename: string; confidence: number; reasoning: string } | null> {
  try {
    let config: ModelConfig = routeForBackground()

    const systemPrompt = `You are the Adaptive Agent Router for Seth, a strategic executive intelligence system.
Your job: given a task and candidate agents with scores, pick the BEST agent.

Return ONLY valid JSON:
{"codename": "agent_codename", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`

    const userPrompt = `TASK: ${taskInput.slice(0, 500)}
DETECTED DOMAIN: ${domain || 'ambiguous'}

CANDIDATES:
${candidates.map(c => `- ${c.name} (${c.codename}): Score ${c.score}/100. ${c.reasons.join('. ')}`).join('\n')}

Which agent is the best fit? Consider task nuance beyond keyword matching.`

    const headers = buildHeaders(config)
    const body = buildRequestBody(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { maxTokens: 300 })

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      // Try fallback
      const fallback = getBackgroundFallback(config.model)
      if (fallback) {
        config = fallback
        const fbHeaders = buildHeaders(fallback)
        const fbBody = buildRequestBody(fallback, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], { maxTokens: 300 })
        const fbRes = await fetch(fallback.apiUrl, { method: 'POST', headers: fbHeaders, body: JSON.stringify(fbBody) })
        if (!fbRes.ok) return null
        const fbData = await fbRes.json()
        const content = fbData.choices?.[0]?.message?.content || ''
        const match = content.match(/\{[\s\S]*\}/)
        if (!match) return null
        return JSON.parse(match[0])
      }
      return null
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[AgentRouter] LLM tiebreak failed:', err)
    return null
  }
}

// ─── Feedback Loop: Update Domain Scores After Dispatch ─────────────────

export async function recordRoutingOutcome(
  routingDecisionId: string,
  outcome: 'positive' | 'negative' | 'neutral',
  feedback?: string
): Promise<void> {
  try {
    const decision = await prisma.routingDecision.update({
      where: { id: routingDecisionId },
      data: { outcome, feedback },
    })

    // Update agent's domain scores based on outcome
    if (decision.selectedAgentId && decision.taskDomain) {
      const agent = await prisma.agent.findUnique({
        where: { id: decision.selectedAgentId },
        select: { domainScores: true },
      })

      if (agent) {
        const scores: Record<string, number> = agent.domainScores
          ? JSON.parse(agent.domainScores)
          : {}

        const current = scores[decision.taskDomain] ?? 50
        const delta = outcome === 'positive' ? 5 : outcome === 'negative' ? -8 : 0
        scores[decision.taskDomain] = Math.max(0, Math.min(100, current + delta))

        await prisma.agent.update({
          where: { id: decision.selectedAgentId },
          data: { domainScores: JSON.stringify(scores) },
        })
      }
    }
  } catch (err) {
    console.error('[AgentRouter] Failed to record outcome:', err)
  }
}

// ─── Update Agent Latency (call after dispatch) ─────────────────────────

export async function updateAgentLatency(agentId: string, latencyMs: number): Promise<void> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { avgLatencyMs: true, totalRuns: true },
    })
    if (!agent) return

    const currentAvg = agent.avgLatencyMs || latencyMs
    const weight = Math.min(agent.totalRuns, 20)
    const newAvg = Math.round((currentAvg * weight + latencyMs) / (weight + 1))

    await prisma.agent.update({
      where: { id: agentId },
      data: { avgLatencyMs: newAvg },
    })
  } catch (err) {
    console.error('[AgentRouter] Failed to update latency:', err)
  }
}

// ─── Get Routing Analytics ──────────────────────────────────────────────

export async function getRoutingAnalytics(userId: string, days = 30): Promise<{
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
    createdAt: Date
  }>
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const decisions = await prisma.routingDecision.findMany({
    where: { userId, createdAt: { gte: since } },
    include: { selectedAgent: { select: { name: true, codename: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const methodBreakdown: Record<string, number> = {}
  const domainBreakdown: Record<string, number> = {}
  const agentSelectionFrequency: Record<string, number> = {}
  const outcomeBreakdown: Record<string, number> = {}
  let totalConfidence = 0

  for (const d of decisions) {
    methodBreakdown[d.routingMethod] = (methodBreakdown[d.routingMethod] || 0) + 1
    if (d.taskDomain) domainBreakdown[d.taskDomain] = (domainBreakdown[d.taskDomain] || 0) + 1
    if (d.selectedAgent) {
      const key = d.selectedAgent.codename
      agentSelectionFrequency[key] = (agentSelectionFrequency[key] || 0) + 1
    }
    if (d.outcome) outcomeBreakdown[d.outcome] = (outcomeBreakdown[d.outcome] || 0) + 1
    totalConfidence += d.confidence
  }

  return {
    totalDecisions: decisions.length,
    methodBreakdown,
    domainBreakdown,
    agentSelectionFrequency,
    averageConfidence: decisions.length > 0 ? totalConfidence / decisions.length : 0,
    outcomeBreakdown,
    recentDecisions: decisions.slice(0, 20).map(d => ({
      id: d.id,
      taskDomain: d.taskDomain,
      routingMethod: d.routingMethod,
      confidence: d.confidence,
      outcome: d.outcome,
      selectedAgent: d.selectedAgent,
      createdAt: d.createdAt,
    })),
  }
}
