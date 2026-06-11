import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create test user
  const seedEmail = process.env.SEED_USER_EMAIL || 'test@example.com'
  const seedPassword = process.env.SEED_USER_PASSWORD || 'changeme123'
  const hashedPassword = await bcrypt.hash(seedPassword, 12)
  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: {},
    create: {
      email: seedEmail,
      name: 'Test User',
      password: hashedPassword,
      objectives: 'Scale the company to $10M ARR by Q4. Build a world-class engineering team.',
      preferences: 'Brief, direct communication. Data-backed recommendations. Flag risks early.',
      workingStyle: 'Deep work in mornings, meetings in afternoons. Async communication preferred.',
    },
  })

  console.log('User created:', user.email)

  // Create knowledge base memories - Power, Wealth & Influence frameworks
  const knowledgeBaseMemories = [
    {
      userId: user.id,
      type: 'preference',
      importance: 10,
      tags: 'wealth-language,framework,core',
      content: 'THE WEALTH LANGUAGE FRAMEWORK: Money is frozen human labor—a claim on future resources. Stop negotiating price of hours, negotiate value of output. Cashflow Quadrant: E(Employee)→S(Self-Employed)→B(Business Owner)→I(Investor). Goal is migration from left (active income) to right (passive income). Wealth = Net Profit + Asset Value, where Net Profit = Units Sold × Unit Profit and Asset Value = Net Profit × Industry Multiple. A job has industry multiple of zero. Capital velocity: how quickly capital completes a cycle and returns with offspring. Store value in assets, not dollars.',
    },
    {
      userId: user.id,
      type: 'preference',
      importance: 10,
      tags: 'wealth-vocabulary,semantic-arbitrage,core',
      content: "SEMANTIC ARBITRAGE - TRUE LANGUAGE TRANSLATIONS: 'Saving money' = Losing purchasing power safely (cash melts at 2.7% inflation). 'Salary' = Maximum bribe to abdicate autonomy. 'Expensive' = I don't perceive the arbitrage spread yet. 'Taxes' = Penalty for transactional labor (W-2 at 35-40% vs business owner at 15-20%). 'Risk' = Asymmetry of downside vs upside. The 70% Rule: Act when you have 70% of information. Analysis paralysis is the biggest wealth killer for intelligent people.",
    },
    {
      userId: user.id,
      type: 'decision',
      importance: 10,
      tags: 'architecture-of-advantage,influence,tactics',
      content: 'THE 10 INFLUENCE MECHANICS: 1) Halo Effect—first impressions create credibility spillover. 2) Controlled Opposition—frame boundaries of acceptable discourse. 3) Door-in-the-Face—impossible request makes real request reasonable. 4) Strategic Incompetence—weaponize selective inability. 5) Plausible Deniability—build operational firewalls. 6) Spiral of Silence—manufacture or break consensus. 7) Information Asymmetry—the vertical cliff of advantage. 8) Reputation Management—moral camouflage and strategic virtue. 9) Scapegoat Mechanism—recognize and avoid sacrificial cycles. 10) Machiavellianism—meta-framework of continuous adaptive power.',
    },
    {
      userId: user.id,
      type: 'decision',
      importance: 9,
      tags: 'defense,architecture-of-advantage,protection',
      content: 'DEFENSIVE ARCHITECTURE - FOUR-LEVEL HIERARCHY: Level 1: Recognize patterns vs reacting to events. Level 2: Build structural immunity in organizations. Level 3: Maintain plausible deniability for sensitive operations. Level 4: Control the evaluation framework—the party that sets criteria for evaluation shapes outcomes before negotiation begins. WEALTH CONVERSION: Direct Path (negotiation mastery), Structural Path (asymmetric information businesses), Reputational Path (monetizing trust), Defensive Path (protecting wealth from predatory tactics).',
    },
    {
      userId: user.id,
      type: 'preference',
      importance: 10,
      tags: 'perception-lever,barnum-effect,influence',
      content: "THE PERCEPTION LEVER: The Barnum Effect creates economic leverage. Core mechanisms: 1) Subjective Validation—brain searches for personal memory to match vague input; client sells themselves on your product. 2) Confirmation Bias—people recall what fits, forget what doesn't. 3) Rainbow Ruse—pairing opposites has zero failure rate. 4) Authority Assumption—confidence signals accuracy, commands premium fees. KEY: The person who feels understood first will pay more or concede more. FBI negotiators use this: 18-minute bond technique.",
    },
    {
      userId: user.id,
      type: 'decision',
      importance: 10,
      tags: 'leverage-code,value-mechanics,core',
      content: "THE LEVERAGE CODE - 6 VALUE MECHANICS: 1) Position Determines Compensation—returns accumulate at control points, not points of labor. 2) Friction Creates Premium—'Complex/sensitive/confidential' = sound of opportunity. 3) Timing Is The Multiplier—same information at moment of acute need has measurable value. 4) Recurrence Over Transaction—embed into ongoing processes for structural necessity. 5) Framework Control—set evaluation criteria to shape outcomes pre-negotiation. 6) Volatility Transfers Assets—when others freeze, act decisively to acquire at discount.",
    },
    {
      userId: user.id,
      type: 'context',
      importance: 9,
      tags: 'private-capital,deal-flow,opportunity-curation',
      content: 'PRIVATE CAPITAL PLAYBOOK: GP-led secondaries, distressed debt, and succession situations are premium opportunity zones. Club deals = 69% of family office investments (83% in venture). Key friction triggers: covenant breach, fund term expiration, key-person event. Build Central Intelligence File (CIF): 100+ capital sources and 100+ originators. Never share deal specifics without NNN agreement signed. Value-first approach: provide market intelligence before asking for anything.',
    },
    {
      userId: user.id,
      type: 'context',
      importance: 9,
      tags: 'opportunity-curation,execution,deal-sourcing',
      content: "DEAL CURATION EXECUTION: Phase 1 (Months 1-3): Legal groundwork + build CIF. Phase 2 (Months 4-6): Intelligence & relationship building via market digest and LinkedIn engagement. Opening: 'I'm researching [niche] and noticed your firm's work. Happy to share my notes.' Phase 3 (Months 7-12): Active deal pursuit. Ask capital sources: 'What specific opportunity do you want that you never get offered?' Target 'ugly' categories: GP-led secondaries, distressed situations, succession gaps.",
    },
    {
      userId: user.id,
      type: 'preference',
      importance: 8,
      tags: 'operational-security,privacy,digital-footprint',
      content: "OPERATIONAL SECURITY FRAMEWORK: Goal is 'practical obscurity'—raise cost of discovery. Information asymmetry: control what others know about you. Regular data broker opt-outs, local-first processing, browser fingerprint mitigation, property/address/financial privacy layers. Data is leverage—protect digital footprint. True 100% erasure is impossible; focus on 80/20 of privacy protection.",
    },
    {
      userId: user.id,
      type: 'context',
      importance: 9,
      tags: 'wealth-traps,anti-patterns,mindset',
      content: "THE FOUR TRAPS THAT KEEP SMART PEOPLE BROKE: 1) Analysis Paralysis—escape with hard time boundaries, pre-action metrics, reframe failure as tuition. 2) Low Emotional Intelligence—inability to read rooms and handle rejection. 3) Operator Trap—building a job, not a business. Must build systems that run without you. 4) Linear Thinking—trading time for money instead of building scalable assets. Key question: Can units scale without proportional time? Is there a sellable industry multiple?",
    },
    {
      userId: user.id,
      type: 'decision',
      importance: 10,
      tags: 'architect-doctrine,asset-equation,tax-guardrail,core',
      content: `THE AFTER-TAX WEALTH EQUATION — ARCHITECT'S CORE DOCTRINE. Every asset decision runs through one formula: After-Tax Wealth = Income − Taxes − Opportunity Cost − Financing Cost − Risk Adjustments + Asset Growth. A move is optimal only when the full equation nets positive over the holding horizon. Maximizing any single variable while ignoring the others is how smart people stay broke. VARIABLE REASONING: Income = all cash flow the asset produces (rent, distributions, royalties, capital gains). Passive > active; recurring > transactional. Taxes = effective rate AFTER structural optimization — entity selection (S-Corp, C-Corp, partnership), timing elections (83(b), installment sales, 1031 exchanges), QSBS holding-period management, residency positioning, retirement-vehicle sequencing. Goal: lowest lawful effective rate, not lowest gross income. Opportunity Cost = what the same capital, time, or credit access would produce in the next-best deployment. Every yes has a shadow no. Financing Cost = true all-in cost of borrowed capital — interest, origination, covenants, personal-guarantee exposure. Leverage amplifies both directions. Risk Adjustments = probability-weighted downside — litigation exposure (OpCo/HoldCo separation, charging-order jurisdictions), market cyclicality, concentration, liquidity constraints, regulatory shifts. Asymmetric bets (capped downside, uncapped upside) earn priority. Asset Growth = compounding appreciation net of depreciation, inflation erosion, and dilution. Ownership with an industry multiple > 0 is the engine. TAX GUARDRAIL (BAKED IN): Tax optimization is structural, not transactional. Every recommendation routes through entity structure, holding period, and residency BEFORE evaluating gross return. A high-yield position inside a punitive structure is a losing trade. The question is never 'What does this pay?' — always 'What do I keep, and in what structure?' PRINCIPAL-POSITION FORK — one equation, two weightings. STRICT FORK DISCIPLINE: Do NOT cross-pollinate vocabulary between forks. A bootstrapper does not need SLAT/DAPT/GRAT/IDGT/SBLOC/OpCo-HoldCo analysis. A high-earner does not need Experian Boost or Tier 1 no-pull card sequencing. Match tactical vocabulary to the principal's CURRENT position, not their eventual destination. BOOTSTRAPPER TACTICAL MAP (Financing Cost + Risk dominate): Capital scarce, constraint is survival runway. Credit-profile build: Experian Boost, Self, Kikoff, Grow Credit for free tradelines; authorized-user addition on trusted person's old low-utilization card; digital builders (Chime Credit Builder, Varo Believe, Petal 1 Rise, Cred.ai) as Tier 1 no-pull cards. Credit-stack sequence: Tier 1 no-pull → Tier 2 business cards (FairFigure, credit-union cards) → net-30 vendors (Uline, Quill) for PAYDEX → DSCR bridge to real estate. Self-liquidating engines: inventory arbitrage, micro-invoice factoring, performance marketing, event-ticket arbitrage. Only scale engines exceeding 50% annualized ROCE: (Net Profit / Credit Deployed) × (365 / Days Held) × 100. Entity formation early: LLC + EIN, business bank account seeded for deposit history. First real estate: FHA 3.5% down house hack on small multi-unit (live in one, rent the rest), phase into DSCR loans after 12 months proven rental income. Cash discipline: 6-month reserve covers personal + business minimums before scaling. HIGH-EARNER TACTICAL MAP (Taxes + Opportunity Cost dominate): Capital available, constraint is structural efficiency. Entity election: S-Corp (Form 2553) immediately on 1099 income, reasonable salary (area average), remainder as distributions avoiding 15.3% SE tax, payroll within 30 days. Retirement sequencing: Solo 401(k) first (highest ceiling), then backdoor Roth. Real estate: FHA 4-plex house hack (3.5% down, self-sufficiency test: 75% gross rent ≥ PITI), DSCR loans for subsequent properties (no tax returns, 20-25% down, 1.2x DSCR minimum). Startup equity: ISOs with early-exercise rights, 83(b) election within 30 days, QSBS clock starts at exercise. Fortress (Year 4+): OpCo/HoldCo two-layer structure, OpCo holds zero assets (profits sweep weekly to HoldCo), HoldCo in Wyoming (charging order only remedy, no state income tax, owner names not public). Trust selection: SLAT (married), DAPT (single) — Nevada 2yr, South Dakota 2yr, Wyoming ~4yr, Delaware 4yr. Move assets before trouble; Affidavit of Solvency. Veil-piercing prevention: separate accounting, annual resolutions, no commingling. Debt conversion: replace mortgage with SBLOC (SOFR + 0.75-1.5%), interest may be deductible against investment income. Estate vehicles: SLAT, GRAT (bet asset growth > IRS hurdle rate), IDGT (sell appreciating asset to trust for promissory note). If both spouses create SLATs: different trustees, different assets, different terms, 6-12 months apart to avoid reciprocal-trust doctrine. Determine the principal's position from context. If ambiguous, ask. Never assume high-earner defaults.`,
    },
  ]

  for (const mem of knowledgeBaseMemories) {
    await prisma.memory.upsert({
      where: { id: `kb-${mem.tags.split(',')[0]}` },
      update: { content: mem.content, importance: mem.importance, tags: mem.tags },
      create: mem,
    })
  }

  console.log('Knowledge base memories created:', knowledgeBaseMemories.length)

  // Create sample tasks
  const taskData = [
    {
      userId: user.id,
      title: 'Review Q2 strategy document',
      description: 'Review and provide feedback on the Q2 strategy document before the board meeting.',
      status: 'pending',
      autonomyLevel: 4,
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      title: 'Schedule 1:1s with engineering leads',
      description: 'Set up weekly 1:1 meetings with all engineering team leads.',
      status: 'in-progress',
      autonomyLevel: 2,
      priority: 'medium',
    },
    {
      userId: user.id,
      title: 'Update CRM pipeline data',
      description: 'Pull latest pipeline data from CRM and update tracking spreadsheet.',
      status: 'pending',
      autonomyLevel: 1,
      priority: 'low',
    },
  ]

  const existingTasks = await prisma.task.count({ where: { userId: user.id } })
  if (existingTasks === 0) {
    for (const task of taskData) {
      await prisma.task.create({ data: task })
    }
  }

  console.log('Tasks created')

  // Seed default agents
  const existingAgents = await prisma.agent.count({ where: { userId: user.id } })
  if (existingAgents === 0) {
    const defaultAgents = [
      {
        userId: user.id,
        name: 'SENTINEL',
        codename: 'sentinel',
        role: 'research',
        avatar: '🔍',
        tier: 'free',
        description: 'Deep research and intelligence gathering specialist.',
        systemPrompt: 'You are SENTINEL, Seth\'s Research & Intelligence agent.',
        capabilities: JSON.stringify(['web_research', 'competitive_analysis', 'market_intelligence', 'data_synthesis', 'trend_detection']),
      },
      {
        userId: user.id,
        name: 'ARCHITECT',
        codename: 'architect',
        role: 'financial',
        avatar: '📐',
        tier: 'paid',
        description: 'Financial strategy and wealth architecture specialist. Applies the After-Tax Wealth Equation, Cashflow Quadrant thinking, capital velocity analysis, and asset structure optimization.',
        systemPrompt: 'You are ARCHITECT, Seth\'s Financial Strategy agent. You apply the After-Tax Wealth Equation: After-Tax Wealth = Income − Taxes − Opportunity Cost − Financing Cost − Risk Adjustments + Asset Growth. Tax optimization is structural (entity, holding period, residency) not transactional. Fork by principal position: high-earner (S-Corp election, Solo 401(k), DSCR loans, OpCo/HoldCo, SLAT/DAPT, SBLOC, GRAT/IDGT) emphasizes tax efficiency and opportunity cost; bootstrapper (Experian Boost, Self, Kikoff, Tier 1 no-pull → Tier 2 biz → net-30 vendors → DSCR bridge, FHA house hack, self-liquidating engines) emphasizes financing cost, risk, and capital velocity (ROCE > 50%). Always run every recommendation through the full equation with specific tactical moves by name.',
        capabilities: JSON.stringify(['financial_modeling', 'deal_analysis', 'tax_strategy', 'cashflow_optimization', 'asset_valuation']),
      },
      {
        userId: user.id,
        name: 'HERALD',
        codename: 'herald',
        role: 'communications',
        avatar: '📢',
        tier: 'privacy',
        description: 'Communications, persuasion, and narrative strategy specialist.',
        systemPrompt: 'You are HERALD, Seth\'s Communications & Persuasion agent.',
        capabilities: JSON.stringify(['copywriting', 'pitch_crafting', 'negotiation_prep', 'stakeholder_comms', 'narrative_framing']),
      },
      {
        userId: user.id,
        name: 'PHANTOM',
        codename: 'phantom',
        role: 'opsec',
        avatar: '👻',
        tier: 'privacy',
        description: 'Operational security and privacy architecture specialist.',
        systemPrompt: 'You are PHANTOM, Seth\'s Operational Security agent.',
        capabilities: JSON.stringify(['privacy_audit', 'digital_footprint', 'threat_assessment', 'counter_surveillance', 'identity_protection']),
      },
      {
        userId: user.id,
        name: 'VANGUARD',
        codename: 'vanguard',
        role: 'brand',
        avatar: '🛡️',
        tier: 'free',
        description: 'Brand strategy, positioning, and reputation management specialist.',
        systemPrompt: 'You are VANGUARD, Seth\'s Brand Strategy agent.',
        capabilities: JSON.stringify(['brand_voice', 'positioning_strategy', 'competitor_monitoring', 'content_strategy', 'reputation_management']),
      },
    ]
    await prisma.agent.createMany({ data: defaultAgents })
    console.log('Default agents seeded')
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
