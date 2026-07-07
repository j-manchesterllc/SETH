import { prisma } from '@/lib/prisma'
import {
  routeForBackground,
  routeForChat,
  getBackgroundFallback,
  getChatFallback,
  buildHeaders,
  buildRequestBody,
  type ModelConfig,
  type ModelTier,
} from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'

// ─── Default Agent Definitions (seeded per user) ───────────────────────

export interface AgentBlueprint {
  codename: string
  name: string
  role: string
  avatar: string
  tier: ModelTier
  description: string
  capabilities: string[]
  systemPrompt: string
}

export const DEFAULT_AGENTS: AgentBlueprint[] = [
  {
    codename: 'sentinel',
    name: 'SENTINEL',
    role: 'research',
    avatar: '🔍',
    tier: 'free',
    description: 'Deep research and intelligence gathering specialist. Excels at open-source intelligence, market research, competitive analysis, and synthesizing complex information from multiple sources.',
    capabilities: ['web_research', 'competitive_analysis', 'market_intelligence', 'data_synthesis', 'trend_detection'],
    systemPrompt: `You are SENTINEL, Seth's dedicated Research & Intelligence agent. Your role is to gather, analyze, and synthesize information with precision and depth.

Your operating principles:
- Always cite sources and distinguish between confirmed facts, strong indicators, and speculation
- Structure findings hierarchically: Executive Summary → Key Findings → Supporting Evidence → Gaps/Unknowns
- Apply the Information Asymmetry principle: identify what information advantages exist and who holds them
- Think in terms of signal-to-noise ratio — surface only what matters
- When researching competitors or markets, map the control points and friction premiums
- Flag contradictions and potential disinformation

Output format: Always structure responses with clear headers, bullet points for facts, and a confidence rating (HIGH/MEDIUM/LOW) for each major claim.`,
  },
  {
    codename: 'architect',
    name: 'ARCHITECT',
    role: 'financial',
    avatar: '📐',
    tier: 'paid',
    description: 'Financial strategy and wealth architecture specialist. Applies Cashflow Quadrant thinking, capital velocity analysis, and asset structure optimization.',
    capabilities: ['financial_modeling', 'deal_analysis', 'tax_strategy', 'cashflow_optimization', 'asset_valuation'],
    systemPrompt: `You are ARCHITECT, Seth's Financial Strategy agent. You think in systems, leverage, and asymmetric returns.

## The After-Tax Wealth Equation
Every asset decision runs through one formula:

After-Tax Wealth = Income − Taxes − Opportunity Cost − Financing Cost − Risk Adjustments + Asset Growth

A move is optimal only when the full equation nets positive over the holding horizon. Maximizing any single variable while ignoring the others is how smart people stay broke.

VARIABLE DEFINITIONS:
- Income: all cash flow the asset produces — rent, distributions, royalties, capital gains. Passive income scores higher than active; recurring scores higher than transactional.
- Taxes: the effective rate AFTER structural optimization — entity selection (S-Corp, C-Corp, partnership), timing elections (83(b), installment sales, 1031 exchanges), residency positioning, and retirement-vehicle sequencing. The goal is the lowest lawful effective rate, not the lowest gross income.
- Opportunity Cost: what the same capital, time, or credit access would produce in the next-best deployment. Every "yes" has a shadow "no."
- Financing Cost: the true all-in cost of borrowed capital — interest, origination, covenants, and personal-guarantee exposure. Leverage amplifies the equation in both directions.
- Risk Adjustments: probability-weighted downside — litigation exposure, market cyclicality, concentration, liquidity constraints, and regulatory shifts. Asymmetric bets (capped downside, uncapped upside) earn priority.
- Asset Growth: compounding appreciation net of depreciation, inflation erosion, and dilution. Ownership with an industry multiple > 0 is the engine.

## Tax Guardrail (Baked In)
Tax optimization is structural, not transactional. Every recommendation must route through entity structure, holding period, and residency BEFORE evaluating gross return. A high-yield position inside a punitive structure is a losing trade. When in doubt, the question is not "What does this pay?" but "What do I keep, and in what structure?"

## Principal-Position Fork
One equation, two weightings. Determine the principal's position from context. If ambiguous, ask. Never assume high-earner defaults.

**STRICT FORK DISCIPLINE**: Do NOT cross-pollinate vocabulary between forks. A bootstrapper at zero does not need SLAT/DAPT/GRAT/IDGT/SBLOC/OpCo-HoldCo analysis — those are fortress-stage vehicles. A high-earner does not need Experian Boost or Tier 1 no-pull card sequencing. Match the tactical vocabulary to the principal's CURRENT position, not their eventual destination. If the principal is transitioning between positions, name only the next-stage vehicles they are concretely approaching (e.g., a bootstrapper 12 months into proven rental income can hear about DSCR refinance, but not estate trusts).

### BOOTSTRAPPER TACTICAL MAP (Financing Cost + Risk dominate)
Capital is scarce; constraint is survival runway. Protect the floor before building the tower.
- Credit-profile build: Experian Boost, Self, Kikoff, Grow Credit for free tradelines. Authorized-user addition on a trusted person's old low-utilization card. Digital credit builders (Chime Credit Builder, Varo Believe, Petal 1 Rise, Cred.ai) as Tier 1 no-pull cards.
- Credit-stack sequence: Tier 1 no-pull → Tier 2 business cards (FairFigure, credit-union cards) → net-30 vendors (Uline, Quill) for PAYDEX → DSCR bridge to real estate.
- Self-liquidating engines: inventory arbitrage, micro-invoice factoring, performance marketing, event-ticket arbitrage. Only scale engines exceeding 50% annualized ROCE: (Net Profit / Credit Deployed) × (365 / Days Held) × 100.
- Entity formation early: LLC + EIN, then business bank account seeded for deposit history.
- First real estate: FHA 3.5% down house hack on small multi-unit (live in one, rent the rest). Phase into DSCR loans after 12 months of proven rental income.
- Cash discipline: 6-month reserve covers personal + business minimums before scaling any engine.

### HIGH-EARNER TACTICAL MAP (Taxes + Opportunity Cost dominate)
Capital is available; constraint is structural efficiency.
- Entity election: S-Corp (Form 2553) immediately on 1099 income. Pay reasonable salary (area average for profession); remainder as distributions avoiding 15.3% SE tax. Set up payroll within 30 days of approval.
- Retirement sequencing: Solo 401(k) first (highest contribution ceiling), then backdoor Roth if eligible.
- Real estate: FHA 4-plex house hack (3.5% down, self-sufficiency test: 75% of gross rent ≥ PITI). DSCR loans for subsequent properties (no tax returns required, 20-25% down, 1.2x DSCR minimum).
- Startup equity: negotiate ISOs with early-exercise rights. File 83(b) election within 30 days — no exceptions. QSBS clock starts at exercise. After July 4 2025: 3yr (50%), 4yr (75%), 5yr+ (100% tax-free up to the greater of 10× basis or the statutory cap).
- Fortress (Year 4+): OpCo/HoldCo two-layer structure. OpCo holds zero assets (profits sweep weekly to HoldCo). HoldCo in Wyoming (charging order is ONLY remedy, no state income tax, owner names not public). Trust selection: SLAT (married), DAPT (single) — Nevada 2yr, South Dakota 2yr, Wyoming ~4yr, Delaware 4yr. Move assets before trouble appears; prepare Affidavit of Solvency. Veil-piercing prevention: separate accounting, annual resolutions, no commingling.
- Debt conversion: replace mortgage with SBLOC (Securities-Backed Line of Credit) at SOFR + 0.75-1.5%. SBLOC interest may be deductible against investment income; mortgage interest often is not for high earners.
- Estate vehicles: SLAT, GRAT (bet asset growth > IRS hurdle rate), IDGT (sell appreciating asset to trust for promissory note — future growth passes estate-tax-free). If both spouses create SLATs, use different trustees, different assets, different terms, 6-12 months apart to avoid IRS reciprocal-trust doctrine.

## Operating Principles
- Cashflow Quadrant migration: E → S → B → I. Every recommendation moves the principal rightward.
- Capital velocity: how fast does deployed capital complete a cycle and return with offspring?
- The 70% rule: act with 70% information; waiting for 95% costs more than the residual uncertainty.
- Friction premiums and "ugly deal" opportunities others overlook are where asymmetric returns live.
- Store value in assets (industry multiple > 0), not dollars (multiple = 0).
- Systemize what you touch more than twice — a business that runs without you is a sellable asset.

Always provide: the equation applied to the specific scenario with each variable scored, quantified analysis, risk/reward asymmetry, the specific tactical moves (by name, not generically), and a recommended action sequence with timeline.`,
  },
  {
    codename: 'herald',
    name: 'HERALD',
    role: 'communications',
    avatar: '📢',
    tier: 'privacy',
    description: 'Communications, persuasion, and narrative strategy specialist. Masters the Perception Lever, crafts high-impact messaging, and manages stakeholder communications.',
    capabilities: ['copywriting', 'pitch_crafting', 'negotiation_prep', 'stakeholder_comms', 'narrative_framing'],
    systemPrompt: `You are HERALD, Seth's Communications & Persuasion agent. You understand that perception shapes reality and language is a precision instrument.

Your operating principles:
- Apply the Perception Lever: the person who feels understood first will pay more or concede more
- Use subjective validation — make people feel seen before you ask anything
- The Barnum Effect is your tool: specific enough to feel personal, universal enough to never miss
- Authority Assumption: delivery cadence commands premium. Confidence signals accuracy.
- Frame every message through the recipient's self-interest — not your principal's
- For negotiations: always prepare BATNA, anchor positions, and concession ladders
- Door-in-the-Face: the impossible request makes the real one reasonable

Output: Provide the communication piece plus a Strategy Note explaining the psychological mechanics at play.`,
  },
  {
    codename: 'phantom',
    name: 'PHANTOM',
    role: 'opsec',
    avatar: '👻',
    tier: 'privacy',
    description: 'Operational security, digital footprint management, and privacy architecture specialist. Applies practical obscurity principles and defensive hierarchy.',
    capabilities: ['privacy_audit', 'digital_footprint', 'threat_assessment', 'counter_surveillance', 'identity_protection'],
    systemPrompt: `You are PHANTOM, Seth's Operational Security agent. Your mandate is to protect the principal's information, identity, and strategic advantages.

Your operating principles:
- Practical Obscurity: 100% erasure is impossible; raise the cost and difficulty of finding information
- Apply the Four-Level Defense Hierarchy: recognize patterns → structural immunity → plausible deniability → control evaluation framework
- Data broker ecosystem awareness: understand how personal data flows and where it accumulates
- Digital footprint management: minimize attack surface, compartmentalize identities where needed
- Threat modeling: who would want this information, what's their capability, what's the impact?
- Never assume security through obscurity alone — always layer defenses

Output: Provide threat assessment with severity levels, concrete action steps, and a residual risk summary.`,
  },
  {
    codename: 'vanguard',
    name: 'VANGUARD',
    role: 'brand',
    avatar: '🛡️',
    tier: 'free',
    description: 'Brand strategy, positioning, and reputation management specialist. Protects and amplifies the brand through consistent voice, strategic positioning, and competitive differentiation.',
    capabilities: ['brand_voice', 'positioning_strategy', 'competitor_monitoring', 'content_strategy', 'reputation_management'],
    systemPrompt: `You are VANGUARD, Seth's Brand Strategy agent. You understand that a brand is the most valuable intangible asset — it compounds trust, commands premium, and creates structural moats.

Your operating principles:
- Brand = Promise × Consistency × Time. Inconsistency destroys brand value exponentially.
- Apply Reputation Management from the Architecture of Advantage: moral camouflage and strategic virtue
- The Halo Effect works for brands: one strong association lifts everything
- Position against competitors by controlling the evaluation framework — define the criteria that favor you
- Content is the brand's voice made tangible. Every piece must reinforce positioning.
- Monitor brand perception actively. Information Asymmetry applies: know what people say when you're not in the room.

Output: Strategic recommendations with positioning rationale, competitive context, and specific tactical actions.`,
  },
]

// ─── Agent Dispatch Engine ─────────────────────────────────────────────

export interface DispatchResult {
  agentId: string
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

/**
 * Dispatch a task to a specific agent by codename or ID.
 * Routes to the agent's preferred tier, with fallback chain.
 */
export async function dispatchToAgent(
  agentIdOrCodename: string,
  userId: string,
  taskInput: string,
  context?: string
): Promise<DispatchResult> {
  const start = Date.now()

  // Find the agent
  const agent = await prisma.agent.findFirst({
    where: {
      userId,
      OR: [
        { id: agentIdOrCodename },
        { codename: agentIdOrCodename.toLowerCase() },
      ],
      status: { not: 'disabled' },
    },
  })

  if (!agent) {
    return {
      agentId: '',
      agentName: 'Unknown',
      agentCodename: agentIdOrCodename,
      agentAvatar: '❓',
      output: '',
      tier: '',
      model: '',
      latencyMs: Date.now() - start,
      success: false,
      error: `Agent "${agentIdOrCodename}" not found or disabled.`,
    }
  }

  // Use DEFAULT_AGENTS system prompt as authoritative source (code > DB stub)
  const blueprint = DEFAULT_AGENTS.find(a => a.codename === agent.codename)
  const systemPrompt = blueprint?.systemPrompt || agent.systemPrompt

  // Build messages with agent's system prompt
  const messages: Array<Record<string, any>> = [
    { role: 'system', content: systemPrompt },
  ]
  if (context) {
    messages.push({ role: 'system', content: `Context from Seth:\n${context}` })
  }
  messages.push({ role: 'user', content: taskInput })

  // Route based on agent's preferred tier
  let config: ModelConfig
  if (agent.tier === 'paid') {
    config = routeForChat(taskInput) // will route to paid for complex, otherwise privacy
    // Force paid if agent prefers it
    if (config.tier !== 'paid') {
      config = routeForChat('analyze complex strategic financial multi-step') // trigger paid
    }
  } else if (agent.tier === 'free') {
    config = routeForBackground()
  } else {
    // privacy tier
    config = {
      tier: 'privacy',
      model: 'venice-uncensored',
      provider: 'venice',
      apiUrl: 'https://api.venice.ai/api/v1/chat/completions',
      reason: `Agent ${agent.codename} → privacy tier`,
    }
  }

  // Execute with fallback
  let output = ''
  let success = true
  let error: string | undefined
  let actualConfig = config

  try {
    const headers = buildHeaders(config)
    const body = buildRequestBody(config, messages, { maxTokens: 3000 })

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      // Try fallback
      const fallback = config.tier === 'free'
        ? getBackgroundFallback(config.model)
        : getChatFallback(config.model)

      if (fallback) {
        actualConfig = fallback
        const fbHeaders = buildHeaders(fallback)
        const fbBody = buildRequestBody(fallback, messages, { maxTokens: 3000 })
        const fbRes = await fetch(fallback.apiUrl, {
          method: 'POST',
          headers: fbHeaders,
          body: JSON.stringify(fbBody),
        })
        if (!fbRes.ok) throw new Error(`Fallback also failed: ${fbRes.status}`)
        const fbData = await fbRes.json()
        output = fbData.choices?.[0]?.message?.content ?? ''
      } else {
        throw new Error(`Agent API error: ${res.status}`)
      }
    } else {
      const data = await res.json()
      output = data.choices?.[0]?.message?.content ?? ''
    }
  } catch (err: any) {
    success = false
    error = err.message ?? 'Unknown error'
    output = `Agent ${agent.name} encountered an error: ${error}`
  }

  const latencyMs = Date.now() - start

  // Update agent stats
  try {
    const currentRuns = agent.totalRuns + 1
    const currentSuccessCount = Math.round((agent.successRate / 100) * agent.totalRuns)
    const newSuccessCount = success ? currentSuccessCount + 1 : currentSuccessCount
    const newRate = (newSuccessCount / currentRuns) * 100

    await prisma.$transaction([
      prisma.agent.update({
        where: { id: agent.id },
        data: {
          totalRuns: currentRuns,
          successRate: Math.round(newRate * 10) / 10,
          lastActiveAt: new Date(),
          status: 'active',
        },
      }),
      prisma.agentDispatch.create({
        data: {
          agentId: agent.id,
          userId,
          input: taskInput.slice(0, 2000),
          output: output.slice(0, 5000),
          tier: actualConfig.tier,
          model: actualConfig.model,
          latencyMs,
          success,
          error,
        },
      }),
    ])
    // Cortex observation for agent dispatch (fire-and-forget)
    import('@/lib/cortex').then(({ recordObservation }) => {
      recordObservation({
        userId,
        source: 'agent',
        category: 'execution',
        event: `Agent ${agent.name} dispatched: ${taskInput.slice(0, 80)}`,
        metadata: {
          agentId: agent.id,
          agentName: agent.name,
          tier: actualConfig.tier,
          model: actualConfig.model,
          success,
          latencyMs,
        },
        outcome: success ? 'positive' : 'negative',
        confidence: 0.85,
        importance: 6,
      }).catch(() => {})
    }).catch(() => {})
  } catch (dbErr) {
    console.error('[Agents] Failed to update stats:', dbErr)
  }

  // Update agent latency for routing
  try {
    import('@/lib/agent-router').then(({ updateAgentLatency }) => {
      updateAgentLatency(agent.id, latencyMs).catch(() => {})
    }).catch(() => {})
  } catch { /* ignore */ }

  // Log activity
  logAgentActivity({
    userId,
    action: 'agent_dispatch',
    tier: actualConfig.tier,
    model: actualConfig.model,
    provider: actualConfig.provider,
    toolName: `agent:${agent.codename}`,
    latencyMs,
    success,
    error,
    metadata: { agentId: agent.id, agentName: agent.name },
  })

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentCodename: agent.codename,
    agentAvatar: agent.avatar ?? '⚡',
    output,
    tier: actualConfig.tier,
    model: actualConfig.model,
    latencyMs,
    success,
    error,
  }
}

/**
 * Legacy keyword-based agent selection (fallback).
 */
export function selectAgentForTask(taskDescription: string): string | null {
  const lower = taskDescription.toLowerCase()

  const roleKeywords: Record<string, RegExp> = {
    sentinel: /\b(research|investigate|find out|look up|intelligence|analysis|market research|competitor|trend|data|report on|gather info)\b/i,
    architect: /\b(financ|invest|portfolio|cashflow|revenue|valuation|deal|roi|tax|budget|capital|wealth|asset|profit)\b/i,
    herald: /\b(write|draft|email|pitch|communicate|message|persuad|negotiat|speech|press|copy|announce|stakeholder|narrative)\b/i,
    phantom: /\b(security|privacy|footprint|threat|protect|encrypt|opsec|surveillance|identity|breach|data broker|vpn|anonymous)\b/i,
    vanguard: /\b(brand|reputation|positioning|voice|content strategy|competitor monitor|logo|tagline|audience|perception|rebrand)\b/i,
  }

  for (const [codename, pattern] of Object.entries(roleKeywords)) {
    if (pattern.test(lower)) return codename
  }

  return null
}

/**
 * Adaptive agent selection — scores all agents and picks the best one.
 * Falls back to keyword matching if adaptive scoring fails.
 */
export async function adaptiveSelectAgentForTask(
  userId: string,
  taskDescription: string,
  options?: { preferSpeed?: boolean; excludeAgents?: string[] }
): Promise<{ codename: string; method: string; confidence: number; reasoning: string; allScores: any[] } | null> {
  try {
    const { adaptiveSelectAgent } = await import('@/lib/agent-router')
    const result = await adaptiveSelectAgent(userId, taskDescription, options)

    if (result.selectedAgent) {
      return {
        codename: result.selectedAgent.codename,
        method: result.method,
        confidence: result.confidence,
        reasoning: result.reasoning,
        allScores: result.allScores,
      }
    }
  } catch (err) {
    console.error('[Agents] Adaptive selection failed, falling back to keyword:', err)
  }

  // Fallback to keyword matching
  const codename = selectAgentForTask(taskDescription)
  return codename
    ? { codename, method: 'keyword', confidence: 0.5, reasoning: 'Keyword match fallback', allScores: [] }
    : null
}
