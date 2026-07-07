/**
 * Multi-Agent Swarm Orchestrator
 * 
 * Provides autonomous agent coordination within a single Node.js runtime:
 * - Parallel agent execution (Promise.allSettled)
 * - Shared context bus (inter-agent communication)
 * - Agent working memory persistence (AgentMemory model)
 * - Autonomous handoff chains (agent can invoke another agent)
 * - Consensus/conflict resolution (synthesize multi-agent outputs)
 */

import { prisma } from '@/lib/prisma'
import { dispatchToAgent, type DispatchResult } from '@/lib/agents'
import {
  routeForBackground,
  buildHeaders,
  buildRequestBody,
  getBackgroundFallback,
  type ModelConfig,
} from '@/lib/model-router'

// ─── Types ────────────────────────────────────────────────────────────────

export interface SwarmConfig {
  maxParallel: number      // max agents running simultaneously
  maxHandoffs: number      // max autonomous handoff depth
  consensusMode: 'synthesize' | 'vote' | 'lead-agent'  // how to resolve multi-agent output
  includeWorkingMemory: boolean  // inject agent's prior findings into context
  timeout: number          // per-agent timeout in ms
}

export interface SwarmResult {
  mode: 'swarm'
  orchestrationId: string
  agents: SwarmAgentResult[]
  consensus: string | null      // synthesized output (if multiple agents)
  handoffChain: HandoffRecord[]
  totalLatencyMs: number
  workingMemoriesCreated: number
}

export interface SwarmAgentResult {
  agentName: string
  agentCodename: string
  agentAvatar: string
  output: string
  success: boolean
  latencyMs: number
  error?: string
  handoffTo?: string  // if agent requested a handoff
  findings: string[]  // key findings extracted for working memory
}

export interface HandoffRecord {
  fromAgent: string
  toAgent: string
  reason: string
  depth: number
}

interface ContextBusMessage {
  fromAgent: string
  type: 'finding' | 'question' | 'handoff_request' | 'conclusion'
  content: string
  confidence: number
  timestamp: number
}

const DEFAULT_CONFIG: SwarmConfig = {
  maxParallel: 3,
  maxHandoffs: 2,
  consensusMode: 'synthesize',
  includeWorkingMemory: true,
  timeout: 25000,
}

// ─── Shared Context Bus ─────────────────────────────────────────────────

class ContextBus {
  private messages: ContextBusMessage[] = []

  publish(msg: ContextBusMessage) {
    this.messages.push(msg)
  }

  getAll(): ContextBusMessage[] {
    return [...this.messages]
  }

  getFromAgent(codename: string): ContextBusMessage[] {
    return this.messages.filter(m => m.fromAgent === codename)
  }

  getFindings(): ContextBusMessage[] {
    return this.messages.filter(m => m.type === 'finding' || m.type === 'conclusion')
  }

  getHandoffRequests(): ContextBusMessage[] {
    return this.messages.filter(m => m.type === 'handoff_request')
  }

  formatForInjection(): string {
    if (this.messages.length === 0) return ''
    const findings = this.getFindings()
    if (findings.length === 0) return ''
    return '\n\n[INTER-AGENT INTELLIGENCE]\n' +
      findings.map(f => `• ${f.fromAgent}: ${f.content}`).join('\n')
  }
}

// ─── Agent Working Memory ───────────────────────────────────────────────

/**
 * Retrieve an agent's recent working memory for context injection.
 */
async function getAgentWorkingMemory(agentId: string, userId: string, limit = 5): Promise<string[]> {
  try {
    const memories = await prisma.agentMemory.findMany({
      where: {
        agentId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { memoryType: true, content: true, confidence: true },
    })
    return memories.map(m => `[${m.memoryType}|conf:${m.confidence}] ${m.content}`)
  } catch {
    return []
  }
}

/**
 * Persist findings from an agent dispatch as working memory.
 */
async function saveAgentFindings(
  agentId: string,
  userId: string,
  findings: string[],
  sourceTask: string
): Promise<number> {
  let saved = 0
  for (const finding of findings.slice(0, 5)) {
    try {
      await prisma.agentMemory.create({
        data: {
          agentId,
          userId,
          memoryType: 'finding',
          content: finding.slice(0, 2000),
          confidence: 0.75,
          sourceTask: sourceTask.slice(0, 500),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day TTL
        },
      })
      saved++
    } catch { /* skip duplicate or DB error */ }
  }
  return saved
}

// ─── Finding Extraction ────────────────────────────────────────────────

/**
 * Extract key findings from an agent's output for working memory + context bus.
 */
async function extractFindings(agentOutput: string, agentName: string): Promise<string[]> {
  try {
    const config = routeForBackground()
    const headers = buildHeaders(config)
    const body = buildRequestBody(config, [
      {
        role: 'system',
        content: 'Extract 2-4 key findings/conclusions from this agent\'s response. Return ONLY a JSON array of strings — each string is one finding (max 150 chars). No explanation.',
      },
      {
        role: 'user',
        content: `Agent ${agentName} responded:\n\n${agentOutput.slice(0, 2000)}`,
      },
    ], { maxTokens: 400 })

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) return []

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const match = raw.match(/\[([\s\S]*?)\]/)
    if (!match) return []
    const parsed = JSON.parse(`[${match[1]}]`)
    if (Array.isArray(parsed)) return parsed.filter((s: any) => typeof s === 'string' && s.length > 5).slice(0, 4)
    return []
  } catch {
    return []
  }
}

// ─── Handoff Detection ─────────────────────────────────────────────────

const HANDOFF_PATTERNS: Record<string, RegExp> = {
  sentinel: /\b(need(?:s)?\s+(?:more\s+)?research|investigate\s+further|gather\s+(?:more\s+)?(?:intel|data|information)|OSINT|market\s+research)\b/i,
  architect: /\b(financial\s+(?:analysis|model)|deal\s+structure|tax\s+(?:strategy|implications)|ROI\s+calculation|capital\s+allocation)\b/i,
  herald: /\b(draft\s+(?:a\s+)?(?:message|email|pitch|communication)|narrative\s+(?:strategy|framing)|stakeholder\s+(?:comms|communication))\b/i,
  phantom: /\b(security\s+(?:audit|review)|privacy\s+(?:concern|risk)|digital\s+footprint|threat\s+(?:assessment|model))\b/i,
  vanguard: /\b(brand\s+(?:analysis|strategy|positioning)|reputation\s+(?:management|assessment)|competitive\s+positioning)\b/i,
}

/**
 * Detect if an agent's output suggests a handoff to another agent.
 */
function detectHandoff(output: string, currentAgent: string): { toAgent: string; reason: string } | null {
  for (const [codename, pattern] of Object.entries(HANDOFF_PATTERNS)) {
    if (codename === currentAgent) continue // don't handoff to self
    const match = output.match(pattern)
    if (match) {
      return { toAgent: codename, reason: match[0] }
    }
  }
  return null
}

// ─── Consensus / Conflict Resolution ───────────────────────────────────

/**
 * Synthesize multiple agent outputs into a unified response.
 */
async function synthesizeConsensus(
  results: SwarmAgentResult[],
  task: string,
  mode: SwarmConfig['consensusMode']
): Promise<string | null> {
  const successful = results.filter(r => r.success && r.output)
  if (successful.length === 0) return null
  if (successful.length === 1) return null // single agent, no synthesis needed

  if (mode === 'lead-agent') {
    return null // lead agent's output is used directly
  }

  if (mode === 'vote') {
    // Simple: return the longest successful response (proxy for thoroughness)
    const sorted = [...successful].sort((a, b) => b.output.length - a.output.length)
    return null // voting just selects the best, no synthesis needed
  }

  // mode === 'synthesize'
  try {
    let config: ModelConfig = routeForBackground()
    const headers = buildHeaders(config)

    const agentOutputs = successful.map(r =>
      `=== ${r.agentName} (${r.agentCodename}) ===\n${r.output.slice(0, 1500)}`
    ).join('\n\n')

    const body = buildRequestBody(config, [
      {
        role: 'system',
        content: `You are Seth's Swarm Consensus Engine. Multiple specialist agents have independently analyzed a task. Synthesize their outputs into a single, coherent, and actionable response.

Rules:
- Identify areas of agreement and reinforce them
- Flag any contradictions between agents and explain the most likely correct position
- Preserve domain-specific insights from each agent
- Structure the synthesis with clear sections
- Be concise but comprehensive — max 600 words
- Credit agents for unique contributions (e.g., "SENTINEL's research indicates...")
- End with a clear recommended action`,
      },
      {
        role: 'user',
        content: `TASK: ${task.slice(0, 500)}\n\nAGENT RESPONSES:\n\n${agentOutputs}`,
      },
    ], { maxTokens: 2000 })

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const fallback = getBackgroundFallback(config.model)
      if (fallback) {
        const fbHeaders = buildHeaders(fallback)
        const fbBody = buildRequestBody(fallback, [
          { role: 'system', content: 'Synthesize the following agent outputs into a brief unified response. Highlight agreements and resolve contradictions.' },
          { role: 'user', content: `TASK: ${task.slice(0, 300)}\n\n${agentOutputs}` },
        ], { maxTokens: 1500 })
        const fbRes = await fetch(fallback.apiUrl, { method: 'POST', headers: fbHeaders, body: JSON.stringify(fbBody) })
        if (fbRes.ok) {
          const fbData = await fbRes.json()
          return fbData.choices?.[0]?.message?.content || null
        }
      }
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error('[Swarm] Consensus synthesis failed:', err)
    return null
  }
}

// ─── Main Swarm Orchestrator ───────────────────────────────────────────

/**
 * Execute a swarm dispatch: multiple agents work in parallel with shared context,
 * working memory injection, autonomous handoffs, and consensus synthesis.
 */
export async function executeSwarm(
  agentCodenames: string[],
  userId: string,
  task: string,
  context?: string,
  config: Partial<SwarmConfig> = {}
): Promise<SwarmResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const orchestrationId = `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const startTime = Date.now()
  const bus = new ContextBus()
  const handoffChain: HandoffRecord[] = []
  let workingMemoriesCreated = 0

  // Resolve agent IDs for working memory lookup
  const agents = await prisma.agent.findMany({
    where: {
      userId,
      codename: { in: agentCodenames.map(c => c.toLowerCase()) },
      status: { not: 'disabled' },
    },
    select: { id: true, codename: true, name: true },
  })
  const agentMap = new Map(agents.map(a => [a.codename, a]))

  // Phase 1: Parallel dispatch with working memory injection
  const dispatchPromises = agentCodenames.slice(0, cfg.maxParallel).map(async (codename): Promise<SwarmAgentResult> => {
    const cn = codename.toLowerCase()
    const agentInfo = agentMap.get(cn)
    let contextWithMemory = context || ''

    // Inject working memory if enabled
    if (cfg.includeWorkingMemory && agentInfo) {
      const memories = await getAgentWorkingMemory(agentInfo.id, userId)
      if (memories.length > 0) {
        contextWithMemory += '\n\n[PRIOR WORKING MEMORY]\n' + memories.join('\n')
      }
    }

    // Dispatch with timeout
    const result = await Promise.race([
      dispatchToAgent(cn, userId, task, contextWithMemory),
      new Promise<DispatchResult>((_, reject) =>
        setTimeout(() => reject(new Error('Agent timeout')), cfg.timeout)
      ),
    ]).catch((err): DispatchResult => ({
      agentId: agentInfo?.id || '',
      agentName: agentInfo?.name || cn.toUpperCase(),
      agentCodename: cn,
      agentAvatar: '⚡',
      output: '',
      tier: '',
      model: '',
      latencyMs: cfg.timeout,
      success: false,
      error: err.message || 'Agent execution failed',
    }))

    // Extract findings for context bus + working memory
    let findings: string[] = []
    if (result.success && result.output) {
      findings = await extractFindings(result.output, result.agentName)

      // Publish to context bus
      for (const finding of findings) {
        bus.publish({
          fromAgent: cn,
          type: 'finding',
          content: finding,
          confidence: 0.75,
          timestamp: Date.now(),
        })
      }

      // Persist to working memory
      if (agentInfo && findings.length > 0) {
        const saved = await saveAgentFindings(agentInfo.id, userId, findings, task)
        workingMemoriesCreated += saved
      }
    }

    // Detect handoff requests
    const handoff = result.success ? detectHandoff(result.output, cn) : null
    if (handoff) {
      bus.publish({
        fromAgent: cn,
        type: 'handoff_request',
        content: `${cn} requests handoff to ${handoff.toAgent}: ${handoff.reason}`,
        confidence: 0.6,
        timestamp: Date.now(),
      })
    }

    return {
      agentName: result.agentName,
      agentCodename: result.agentCodename,
      agentAvatar: result.agentAvatar,
      output: result.output,
      success: result.success,
      latencyMs: result.latencyMs,
      error: result.error,
      handoffTo: handoff?.toAgent,
      findings,
    }
  })

  const initialResults = await Promise.allSettled(dispatchPromises)
  const agentResults: SwarmAgentResult[] = initialResults.map(r =>
    r.status === 'fulfilled' ? r.value : {
      agentName: 'Unknown',
      agentCodename: 'unknown',
      agentAvatar: '❓',
      output: '',
      success: false,
      latencyMs: 0,
      error: r.reason?.message || 'Promise rejected',
      findings: [],
    }
  )

  // Phase 2: Autonomous handoff chains
  const handoffRequests = bus.getHandoffRequests()
  const processedHandoffs = new Set<string>()

  for (let depth = 0; depth < cfg.maxHandoffs && handoffRequests.length > 0; depth++) {
    for (const req of handoffRequests) {
      const match = req.content.match(/handoff to (\w+)/)
      const toAgent = match?.[1]
      if (!toAgent || processedHandoffs.has(toAgent)) continue
      if (agentCodenames.includes(toAgent)) continue // already dispatched

      processedHandoffs.add(toAgent)

      // Build handoff context with findings from all prior agents
      const handoffContext = [
        context || '',
        bus.formatForInjection(),
        `\n[HANDOFF from ${req.fromAgent}]: ${req.content}`,
      ].filter(Boolean).join('\n')

      handoffChain.push({
        fromAgent: req.fromAgent,
        toAgent,
        reason: req.content,
        depth: depth + 1,
      })

      try {
        const handoffResult = await dispatchToAgent(toAgent, userId, task, handoffContext)

        let findings: string[] = []
        if (handoffResult.success) {
          findings = await extractFindings(handoffResult.output, handoffResult.agentName)
          for (const f of findings) {
            bus.publish({ fromAgent: toAgent, type: 'finding', content: f, confidence: 0.7, timestamp: Date.now() })
          }
          const agentInfo = agentMap.get(toAgent)
          if (agentInfo && findings.length > 0) {
            workingMemoriesCreated += await saveAgentFindings(agentInfo.id, userId, findings, task)
          }
        }

        agentResults.push({
          agentName: handoffResult.agentName,
          agentCodename: handoffResult.agentCodename,
          agentAvatar: handoffResult.agentAvatar,
          output: handoffResult.output,
          success: handoffResult.success,
          latencyMs: handoffResult.latencyMs,
          error: handoffResult.error,
          findings,
        })
      } catch (err: any) {
        console.error(`[Swarm] Handoff to ${toAgent} failed:`, err)
      }
    }
  }

  // Phase 3: Consensus synthesis
  const consensus = agentResults.filter(r => r.success).length > 1
    ? await synthesizeConsensus(agentResults, task, cfg.consensusMode)
    : null

  return {
    mode: 'swarm',
    orchestrationId,
    agents: agentResults,
    consensus,
    handoffChain,
    totalLatencyMs: Date.now() - startTime,
    workingMemoriesCreated,
  }
}

/**
 * Execute a single-agent dispatch with working memory + context bus awareness.
 * Enhanced version of dispatchToAgent that maintains agent state.
 */
export async function executeAgentWithMemory(
  agentCodename: string,
  userId: string,
  task: string,
  context?: string
): Promise<SwarmAgentResult> {
  const cn = agentCodename.toLowerCase()

  const agent = await prisma.agent.findFirst({
    where: { userId, codename: cn, status: { not: 'disabled' } },
    select: { id: true, codename: true, name: true },
  })

  let contextWithMemory = context || ''
  if (agent) {
    const memories = await getAgentWorkingMemory(agent.id, userId)
    if (memories.length > 0) {
      contextWithMemory += '\n\n[PRIOR WORKING MEMORY]\n' + memories.join('\n')
    }
  }

  const result = await dispatchToAgent(cn, userId, task, contextWithMemory)

  let findings: string[] = []
  if (result.success && result.output) {
    findings = await extractFindings(result.output, result.agentName)
    if (agent && findings.length > 0) {
      await saveAgentFindings(agent.id, userId, findings, task)
    }
  }

  return {
    agentName: result.agentName,
    agentCodename: result.agentCodename,
    agentAvatar: result.agentAvatar,
    output: result.output,
    success: result.success,
    latencyMs: result.latencyMs,
    error: result.error,
    handoffTo: result.success ? detectHandoff(result.output, cn)?.toAgent : undefined,
    findings,
  }
}

/**
 * Get swarm status / working memory for a user's agents.
 */
export async function getSwarmStatus(userId: string): Promise<{
  agents: Array<{ codename: string; name: string; memoryCount: number; lastActive: Date | null }>
  totalWorkingMemories: number
  recentHandoffs: HandoffRecord[]
}> {
  const agents = await prisma.agent.findMany({
    where: { userId, status: { not: 'disabled' } },
    select: { id: true, codename: true, name: true, lastActiveAt: true },
  })

  const memoryCounts = await prisma.agentMemory.groupBy({
    by: ['agentId'],
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _count: true,
  })
  const countMap = new Map(memoryCounts.map(c => [c.agentId, c._count]))

  const totalMemories = await prisma.agentMemory.count({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  return {
    agents: agents.map(a => ({
      codename: a.codename,
      name: a.name,
      memoryCount: countMap.get(a.id) || 0,
      lastActive: a.lastActiveAt,
    })),
    totalWorkingMemories: totalMemories,
    recentHandoffs: [], // TODO: persist handoff records if needed
  }
}