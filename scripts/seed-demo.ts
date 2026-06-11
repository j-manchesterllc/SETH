import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding SETH demo account...')

  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'changeme123'
  const hashedPassword = await bcrypt.hash(demoPassword, 12)

  // ─── Demo User ───────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@sethassistant.digital' },
    update: {
      name: 'Alex Morgan',
      password: hashedPassword,
      objectives: 'Evaluate sovereign AI infrastructure for executive decision-making. Assess privacy-first architecture for regulated industries (healthcare, legal, finance). Scale adoption across enterprise portfolio companies.',
      preferences: 'Concise strategic briefings. Data-driven recommendations with confidence levels. Surface contradictions and blind spots proactively. Default to privacy-tier processing for all sensitive discussions.',
      workingStyle: 'Strategic review sessions in the morning, stakeholder calls in the afternoon. Async-first communication. Prefer structured recommendations over open-ended options.',
    },
    create: {
      email: 'demo@sethassistant.digital',
      name: 'Alex Morgan',
      password: hashedPassword,
      objectives: 'Evaluate sovereign AI infrastructure for executive decision-making. Assess privacy-first architecture for regulated industries (healthcare, legal, finance). Scale adoption across enterprise portfolio companies.',
      preferences: 'Concise strategic briefings. Data-driven recommendations with confidence levels. Surface contradictions and blind spots proactively. Default to privacy-tier processing for all sensitive discussions.',
      workingStyle: 'Strategic review sessions in the morning, stakeholder calls in the afternoon. Async-first communication. Prefer structured recommendations over open-ended options.',
    },
  })

  console.log('Demo user created:', user.email)

  // ─── Memories — showcasing multi-vertical intelligence ──────
  const memories = [
    // Healthcare / Medical vertical
    {
      type: 'decision',
      importance: 10,
      tags: 'healthcare,hipaa,compliance,strategy',
      content: 'HEALTHCARE AI DEPLOYMENT FRAMEWORK: Three critical requirements for AI in regulated healthcare: (1) All PHI processing must occur on sovereign infrastructure — no data leaves the organization\'s control boundary. (2) Audit trails must capture every AI interaction touching patient data with immutable logging. (3) Model outputs in clinical contexts require human-in-the-loop validation before any patient-facing action. Venice AI\'s local processing model satisfies requirement #1 by design — this is SETH\'s primary value proposition for hospital systems and health networks.',
    },
    {
      type: 'context',
      importance: 9,
      tags: 'healthcare,market-intelligence,opportunity',
      content: 'HEALTHCARE AI MARKET: $187B projected by 2030 (CAGR 38.4%). Key pain points: 73% of healthcare CISOs report AI vendors cannot meet HIPAA technical safeguard requirements. Average cost of healthcare data breach: $10.93M (highest of any industry). Opportunity: Position SETH as the first executive AI that processes zero data outside the organization\'s infrastructure. Competitive moat: Venice AI privacy-first processing eliminates the #1 objection from hospital compliance officers.',
    },
    // Legal vertical
    {
      type: 'decision',
      importance: 10,
      tags: 'legal,attorney-client-privilege,compliance',
      content: 'LEGAL SECTOR AI REQUIREMENTS: Attorney-client privilege demands absolute data sovereignty. Key ruling: In re Grand Jury Subpoena (2024) — court held that AI tools processing privileged communications on third-party servers may waive privilege. SETH\'s architecture is uniquely positioned: Venice AI processes locally, no data transmitted to external servers. This preserves privilege by design. Target: AmLaw 200 firms spending $2.1B annually on legal tech. SETH can serve as privileged strategic counsel layer without privilege waiver risk.',
    },
    {
      type: 'context',
      importance: 9,
      tags: 'legal,market-intelligence,deal-structure',
      content: 'LEGAL AI MARKET INTELLIGENCE: $25.2B market by 2027. Only 14% of AmLaw 100 firms have deployed AI beyond basic document review. Barrier: Managing partners cite data privacy and privilege as the #1 blocker (Gartner Legal Tech Survey 2025). Average AmLaw 200 firm pays $420K/year for research tools that don\'t understand their strategic context. SETH replaces fragmented legal research tools with a unified strategic intelligence layer that remembers case strategy, client preferences, and opposing counsel patterns.',
    },
    // Finance vertical
    {
      type: 'decision',
      importance: 10,
      tags: 'finance,sec-compliance,fiduciary,strategy',
      content: 'FINANCIAL SERVICES AI DEPLOYMENT: SEC, FINRA, and OCC all require that AI systems handling material non-public information (MNPI) maintain strict data isolation. Key regulatory framework: SEC AI Rule Proposal 2024 — registered advisors must demonstrate "effective oversight" of AI providing investment recommendations. SETH satisfies this through: (1) Privacy-tier processing keeps MNPI local, (2) Full telemetry provides audit trail for regulatory examination, (3) Human-in-the-loop task approval for Level 2-3 autonomy prevents unauthorized autonomous trading recommendations.',
    },
    {
      type: 'context',
      importance: 9,
      tags: 'finance,wealth-management,market-sizing',
      content: 'WEALTH MANAGEMENT AI OPPORTUNITY: $1.5T AUM segment (family offices + RIAs) is dramatically underserved by current AI. 89% of family offices want AI assistance but only 12% have deployed it (UBS Family Office Survey 2025). Blocker: fiduciary duty requires advisors to maintain confidentiality of client financial data. Current solutions (ChatGPT, Copilot) send all data to external servers — immediate compliance violation. SETH\'s privacy architecture solves this. Target deal: $150K-500K annual enterprise license per firm.',
    },
    // Strategic frameworks
    {
      type: 'preference',
      importance: 10,
      tags: 'strategic-framework,decision-making,core',
      content: 'SETH DECISION INTELLIGENCE PROTOCOL: Every strategic recommendation follows the Consequential Action Framework: (1) Map the decision space — identify all stakeholders and their incentive structures. (2) Quantify asymmetry — what\'s the upside/downside ratio? Only act when asymmetry favors you >3:1. (3) Identify the control point — where does leverage concentrate? Position there. (4) Time the intervention — same information at different moments has dramatically different value. (5) Build structural optionality — every action should create more future options, not fewer.',
    },
    {
      type: 'preference',
      importance: 9,
      tags: 'privacy-architecture,venice-ai,technical',
      content: 'SETH PRIVACY ARCHITECTURE: Three-tier model routing ensures data sovereignty by default. Tier 1 (Privacy): Venice AI local processing — all sensitive conversations, PHI, legal privilege, MNPI routed here. Zero data leaves the processing boundary. Tier 2 (Operational): Free-tier models for background analysis, pattern detection, non-sensitive summarization. Tier 3 (Premium): Paid models reserved for complex multi-step reasoning where accuracy justifies the routing. The Cortex self-improvement engine learns entirely from local observation patterns — no training data exported.',
    },
    {
      type: 'context',
      importance: 8,
      tags: 'competitive-landscape,enterprise-ai,positioning',
      content: 'COMPETITIVE POSITIONING: Microsoft Copilot — sends all data to Azure, $30/user/month commodity pricing, no memory or strategic context. ChatGPT Enterprise — OpenAI retains data rights, no genuine privacy guarantee, generic assistant without domain expertise. Palantir AIP — $10M+ minimum deployment, 6-month implementation, requires dedicated engineering team. SETH — sovereign processing, executive-grade intelligence, learns your strategic patterns, deploys in hours not months. Position: "Enterprise cognition infrastructure" not "AI assistant."',
    },
    {
      type: 'decision',
      importance: 9,
      tags: 'go-to-market,enterprise-sales,pricing',
      content: 'GO-TO-MARKET STRATEGY: Phase 1 — Land 3 anchor clients (1 healthcare system, 1 AmLaw 100 firm, 1 RIA/family office) at $250K annual license. Use as reference accounts. Phase 2 — Vertical-specific packaging: SETH|Medical, SETH|Legal, SETH|Finance with pre-configured compliance frameworks. Phase 3 — Platform play: agent marketplace where firms can deploy custom agent swarms for their domain. Revenue model: base license + per-agent-seat expansion + premium model routing usage.',
    },
  ]

  // Clean existing demo memories
  await prisma.memory.deleteMany({ where: { userId: user.id } })
  for (const mem of memories) {
    await prisma.memory.create({
      data: { userId: user.id, ...mem, strength: 1.0, accessCount: 3, lastAccessedAt: new Date() },
    })
  }
  console.log('Demo memories created:', memories.length)

  // ─── Tasks — enterprise pipeline ────────────────────────────
  await prisma.task.deleteMany({ where: { userId: user.id } })
  const tasks = [
    {
      userId: user.id,
      title: 'Prepare Fortune 1000 pitch deck for healthcare vertical',
      description: 'Finalize the SETH|Medical value proposition. Include ROI model showing $10.93M breach cost avoidance, HIPAA compliance automation, and clinical decision support use cases.',
      status: 'in-progress',
      autonomyLevel: 3,
      priority: 'high' as const,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      title: 'Schedule demo with AmLaw 100 managing partner',
      description: 'Follow up on intro from the legal tech conference. Key talking point: attorney-client privilege preservation through local AI processing.',
      status: 'pending',
      autonomyLevel: 2,
      priority: 'high' as const,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      title: 'Draft SEC compliance whitepaper for SETH|Finance',
      description: 'Document how SETH satisfies SEC AI Rule Proposal requirements. Include: data isolation architecture, audit trail capabilities, human-in-the-loop approval workflows.',
      status: 'pending',
      autonomyLevel: 3,
      priority: 'medium' as const,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      title: 'Competitive teardown: Palantir AIP vs SETH positioning',
      description: 'Analyze Palantir AIP deployment requirements, pricing, and limitations. Build comparison matrix highlighting SETH advantages: deployment speed, sovereign processing, cost efficiency.',
      status: 'completed',
      autonomyLevel: 4,
      priority: 'medium' as const,
      executedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      executionResult: 'Analysis complete. Key differentiators: SETH deploys in hours vs 6 months for Palantir. SETH costs 95% less at $250K vs $10M+ minimum. SETH provides executive-level strategic intelligence vs Palantir\'s data analytics focus. Palantir requires dedicated engineering team; SETH is self-service.',
    },
    {
      userId: user.id,
      title: 'Review family office pilot feedback',
      description: 'Analyze usage patterns and satisfaction data from the 30-day pilot with Meridian Capital family office. Focus on: privacy confidence, strategic value of memory/context, agent utilization.',
      status: 'pending',
      autonomyLevel: 2,
      priority: 'medium' as const,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  ]

  for (const task of tasks) {
    await prisma.task.create({ data: task })
  }
  console.log('Demo tasks created:', tasks.length)

  // ─── Conversations — showing real strategic dialogue ─────────
  await prisma.conversation.deleteMany({ where: { userId: user.id } })

  // Conversation 1: Healthcare strategy
  const conv1 = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Healthcare Vertical GTM Strategy',
      decisionContext: 'How should we position SETH for hospital systems and health networks?',
    },
  })
  const conv1Messages = [
    { conversationId: conv1.id, role: 'user', content: 'I need a strategic analysis of how to position SETH for Fortune 500 healthcare companies. What\'s our strongest opening?' },
    { conversationId: conv1.id, role: 'assistant', content: '**Strategic Assessment: Healthcare Vertical Entry**\n\nYour strongest opening is the **cost-of-breach narrative**. Here\'s why:\n\n**The $10.93M Problem**\nHealthcare has the highest average data breach cost of any industry — and 73% of healthcare CISOs report that current AI vendors cannot meet HIPAA technical safeguard requirements. This creates a massive unmet need.\n\n**SETH\'s Unique Position**\nUnlike every major AI platform (Copilot, ChatGPT Enterprise, Gemini), SETH processes data locally through Venice AI. This means:\n- Zero PHI leaves the organization\'s infrastructure\n- HIPAA technical safeguards are satisfied by architecture, not policy\n- No BAA negotiation needed — there\'s no "business associate" because no data is shared\n\n**Recommended Opening Move**\nTarget the **CISO + CMO dual buy** at mid-market health systems (10-50 hospitals). The CISO cares about compliance; the CMO cares about clinical decision support. SETH serves both:\n1. Privacy architecture satisfies the CISO\n2. Adaptive memory and agent system gives clinicians strategic context\n3. Wearable voice pipeline enables hands-free clinical consultation\n\n**Next Step**: I can draft a one-page executive brief targeting health system C-suites. Shall I deploy SENTINEL for competitive intelligence on what AI tools the top 20 health systems currently use?' },
    { conversationId: conv1.id, role: 'user', content: 'That\'s exactly right. What about the regulatory angle — how do we frame the FDA implications?' },
    { conversationId: conv1.id, role: 'assistant', content: '**FDA Regulatory Positioning**\n\nThis is where precision matters. Here\'s the framework:\n\n**What SETH Is NOT**\nSETH is not a clinical decision support (CDS) system making diagnostic recommendations — which would trigger FDA Software as Medical Device (SaMD) classification. SETH is an **executive intelligence platform** that helps healthcare leaders make strategic, operational, and financial decisions.\n\n**What SETH IS**\n- A sovereign AI infrastructure for executive decision-making\n- An organizational memory system that preserves institutional knowledge\n- An agent framework for research, competitive analysis, and strategic planning\n- A privacy-first platform that keeps sensitive data within organizational boundaries\n\n**The Regulatory Advantage**\nBy positioning as executive infrastructure (not clinical CDS), we:\n1. Avoid FDA 510(k) or De Novo pathway requirements\n2. Still satisfy HIPAA through architecture\n3. Can expand into clinical adjacencies over time once established\n\n**Risk to Flag**: If a hospital starts using SETH for patient-facing clinical recommendations, that could trigger FDA scrutiny. We should include clear use-case guardrails in the enterprise license agreement.\n\nI\'ve saved this regulatory positioning to memory for your pitch preparation.' },
  ]
  for (const msg of conv1Messages) {
    await prisma.message.create({ data: msg })
  }

  // Conversation 2: Finance vertical
  const conv2 = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Financial Services Compliance Architecture',
      decisionContext: 'How does SETH satisfy SEC and FINRA requirements for AI in wealth management?',
    },
  })
  const conv2Messages = [
    { conversationId: conv2.id, role: 'user', content: 'Walk me through how SETH handles SEC compliance for RIAs and family offices using AI.' },
    { conversationId: conv2.id, role: 'assistant', content: '**SETH Compliance Architecture for Financial Services**\n\n**The Regulatory Landscape**\nThe SEC\'s 2024 AI Rule Proposal requires registered investment advisors to demonstrate:\n1. **Effective oversight** of AI providing investment recommendations\n2. **Conflict of interest elimination** — AI cannot prioritize the provider\'s interests\n3. **Transparent disclosure** of AI use in advisory relationships\n4. **Data isolation** for material non-public information (MNPI)\n\n**How SETH Satisfies Each Requirement**\n\n| Requirement | SETH Architecture | Competitor Gap |\n|---|---|---|\n| Effective Oversight | Level 2-3 autonomy requires human approval for consequential actions | ChatGPT/Copilot have no approval workflow |\n| Conflict Elimination | No provider data access — Venice processes locally | OpenAI/Microsoft retain data rights |\n| Transparent Disclosure | Full telemetry trace with model routing, latency, and decision audit trail | Black box responses with no auditability |\n| MNPI Isolation | Privacy-tier routes all sensitive data through local processing | All competitors send data to external servers |\n\n**Competitive Moat**\nNo other AI platform can provide a regulatory examiner with a complete audit trail showing that client MNPI never left the organization\'s infrastructure. This is SETH\'s killer feature for the financial services vertical.\n\n**Recommended Pricing**: $250K base + $5K/advisor seat. For a 50-advisor RIA, that\'s $500K annually — less than their current Bloomberg Terminal + research tool stack combined, with dramatically more strategic capability.' },
  ]
  for (const msg of conv2Messages) {
    await prisma.message.create({ data: msg })
  }

  // Conversation 3: Legal privilege
  const conv3 = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Attorney-Client Privilege & AI Architecture',
      decisionContext: 'Can we guarantee privilege preservation for law firm deployments?',
    },
  })
  const conv3Messages = [
    { conversationId: conv3.id, role: 'user', content: 'Our legal vertical pitch needs to address the privilege question head-on. What\'s the strongest argument?' },
    { conversationId: conv3.id, role: 'assistant', content: '**Privilege Preservation: SETH\'s Definitive Advantage**\n\nThis is the single most compelling argument for law firm adoption. Here\'s how to present it:\n\n**The Privilege Problem with Current AI**\nWhen an attorney inputs privileged communications into ChatGPT, Copilot, or any cloud-hosted AI:\n- Data is transmitted to and processed on third-party servers\n- The AI provider becomes a potential "third party" for privilege analysis\n- Under *In re Grand Jury Subpoena* (2024), courts have held this may constitute voluntary disclosure — waiving privilege\n\n**SETH\'s Architectural Solution**\nVenice AI processes everything locally. The privileged communication:\n- Never leaves the firm\'s infrastructure boundary\n- Is processed by models running on sovereign compute\n- Creates no third-party data relationship\n- Generates no discoverable records outside the firm\'s control\n\n**The One-Sentence Pitch**\n*"SETH is the only AI platform where your attorneys can think out loud without risking privilege waiver — because the conversation never leaves your walls."*\n\n**For the Managing Partner Meeting**\nLead with the risk narrative: every time an associate pastes a client communication into ChatGPT, the firm is potentially waiving privilege on that matter. Then position SETH as the compliant alternative that gives attorneys the AI capability they want without the privilege risk the firm can\'t afford.\n\nShall I have HERALD draft the full pitch narrative for the managing partner presentation?' },
  ]
  for (const msg of conv3Messages) {
    await prisma.message.create({ data: msg })
  }

  console.log('Demo conversations created: 3')

  // ─── Agents — seed for demo user ────────────────────────────
  await prisma.agent.deleteMany({ where: { userId: user.id } })
  const agents = [
    {
      userId: user.id,
      name: 'SENTINEL',
      codename: 'sentinel',
      role: 'research',
      avatar: '🔍',
      tier: 'free',
      description: 'Deep research and intelligence gathering specialist. Excels at open-source intelligence, market research, competitive analysis, and synthesizing complex information.',
      systemPrompt: 'You are SENTINEL, Seth\'s dedicated Research & Intelligence agent.',
      capabilities: JSON.stringify(['web_research', 'competitive_analysis', 'market_intelligence', 'data_synthesis', 'trend_detection']),
      totalRuns: 24,
      successRate: 96.5,
      lastActiveAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'active',
    },
    {
      userId: user.id,
      name: 'ARCHITECT',
      codename: 'architect',
      role: 'financial',
      avatar: '📐',
      tier: 'paid',
      description: 'Financial strategy and wealth architecture specialist. Applies Cashflow Quadrant thinking, capital velocity analysis, and asset structure optimization.',
      systemPrompt: 'You are ARCHITECT, Seth\'s Financial Strategy agent.',
      capabilities: JSON.stringify(['financial_modeling', 'deal_analysis', 'tax_strategy', 'cashflow_optimization', 'asset_valuation']),
      totalRuns: 18,
      successRate: 94.4,
      lastActiveAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      status: 'active',
    },
    {
      userId: user.id,
      name: 'HERALD',
      codename: 'herald',
      role: 'communications',
      avatar: '📢',
      tier: 'privacy',
      description: 'Communications, persuasion, and narrative strategy specialist. Masters the Perception Lever, crafts high-impact messaging.',
      systemPrompt: 'You are HERALD, Seth\'s Communications & Persuasion agent.',
      capabilities: JSON.stringify(['copywriting', 'pitch_crafting', 'negotiation_prep', 'stakeholder_comms', 'narrative_framing']),
      totalRuns: 15,
      successRate: 100,
      lastActiveAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      status: 'active',
    },
    {
      userId: user.id,
      name: 'PHANTOM',
      codename: 'phantom',
      role: 'opsec',
      avatar: '👻',
      tier: 'privacy',
      description: 'Operational security and privacy architecture specialist. Threat assessment, counter-surveillance, identity protection.',
      systemPrompt: 'You are PHANTOM, Seth\'s Operational Security agent.',
      capabilities: JSON.stringify(['privacy_audit', 'digital_footprint', 'threat_assessment', 'counter_surveillance', 'identity_protection']),
      totalRuns: 9,
      successRate: 100,
      lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'standby',
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
      totalRuns: 12,
      successRate: 91.7,
      lastActiveAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: 'active',
    },
  ]
  await prisma.agent.createMany({ data: agents })
  console.log('Demo agents seeded:', agents.length)

  // ─── Cortex Observations — show the learning engine is active ─
  await prisma.cortexObservation.deleteMany({ where: { userId: user.id } })
  const observations = [
    { source: 'chat', category: 'decision', event: 'Strategic analysis requested: healthcare vertical positioning for Fortune 500 targets', outcome: 'positive', confidence: 0.9, importance: 8 },
    { source: 'chat', category: 'execution', event: 'Competitive teardown completed: Palantir AIP vs SETH across 12 dimensions', outcome: 'positive', confidence: 0.95, importance: 9 },
    { source: 'agent', category: 'execution', event: 'SENTINEL dispatched: SEC AI regulation landscape research — synthesized 47 sources', outcome: 'positive', confidence: 0.88, importance: 8 },
    { source: 'chat', category: 'decision', event: 'Pricing model validated: $250K base + per-seat expansion for enterprise vertical', outcome: 'positive', confidence: 0.85, importance: 9 },
    { source: 'task', category: 'execution', event: 'Task completed: Attorney-client privilege preservation whitepaper drafted', outcome: 'positive', confidence: 0.92, importance: 8 },
    { source: 'agent', category: 'communication', event: 'HERALD deployed: pitch narrative for AmLaw 100 managing partner meeting', outcome: 'positive', confidence: 0.87, importance: 7 },
    { source: 'chat', category: 'workflow', event: 'Multi-agent coordination: SENTINEL research → ARCHITECT financial modeling → HERALD pitch crafting', outcome: 'positive', confidence: 0.91, importance: 9 },
    { source: 'memory', category: 'decision', event: 'Contradiction detected and resolved: pricing strategy inconsistency between healthcare and finance verticals', outcome: 'positive', confidence: 0.8, importance: 7 },
    { source: 'chat', category: 'priority', event: 'Strategic pivot identified: lead with compliance narrative over feature comparison', outcome: 'positive', confidence: 0.93, importance: 8 },
    { source: 'agent', category: 'execution', event: 'PHANTOM deployed: privacy architecture audit for enterprise compliance documentation', outcome: 'positive', confidence: 0.89, importance: 8 },
  ]
  for (const obs of observations) {
    await prisma.cortexObservation.create({
      data: {
        userId: user.id,
        source: obs.source,
        category: obs.category,
        event: obs.event,
        outcome: obs.outcome,
        confidence: obs.confidence,
        importance: obs.importance,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    })
  }
  console.log('Demo cortex observations created:', observations.length)

  // ─── Cortex Patterns — detected intelligence ────────────────
  await prisma.cortexPattern.deleteMany({ where: { userId: user.id } })
  const patterns = [
    {
      title: 'Compliance-First Positioning Drives Engagement',
      description: 'When pitch narratives lead with regulatory compliance advantages (HIPAA, SEC, privilege), stakeholder engagement increases 3x compared to feature-led presentations. This pattern holds across all three target verticals.',
      patternType: 'communication',
      confidence: 0.88,
      impactScore: 9.2,
      recommendation: 'Restructure all vertical pitch decks to open with the compliance/risk narrative before transitioning to capability demonstration.',
      status: 'active',
    },
    {
      title: 'Multi-Agent Workflows Accelerate Deal Preparation',
      description: 'When SENTINEL research feeds into ARCHITECT financial modeling which feeds into HERALD pitch crafting, total preparation time decreases by approximately 70% compared to sequential single-agent workflows.',
      patternType: 'workflow',
      confidence: 0.82,
      impactScore: 8.5,
      recommendation: 'Default to multi-agent pipeline for all enterprise deal preparation: Research → Analysis → Communications.',
      status: 'active',
    },
    {
      title: 'Morning Strategic Sessions Yield Higher Quality Decisions',
      description: 'Analysis of conversation depth and decision quality shows consistently higher strategic output during AM sessions (before 11:00) compared to PM sessions.',
      patternType: 'productivity',
      confidence: 0.75,
      impactScore: 6.8,
      recommendation: 'Schedule all major strategic planning and decision-making conversations before 11:00 AM.',
      status: 'monitoring',
    },
  ]
  for (const pat of patterns) {
    await prisma.cortexPattern.create({
      data: { userId: user.id, ...pat },
    })
  }
  console.log('Demo cortex patterns created:', patterns.length)

  // ─── Cortex Reflection — show the self-improvement engine ────
  await prisma.cortexReflection.deleteMany({ where: { userId: user.id } })
  await prisma.cortexReflection.create({
    data: {
      userId: user.id,
      timeframe: 'weekly',
      summary: 'Strong week of enterprise pipeline development across all three target verticals. Compliance-first positioning validated through stakeholder conversations. Multi-agent coordination reaching maturity — team dispatches now consistently outperform single-agent approaches.',
      wins: JSON.stringify([
        'Completed competitive teardown of Palantir AIP — identified 4 decisive SETH advantages',
        'Validated $250K base pricing with two prospective enterprise accounts',
        'Attorney-client privilege whitepaper drafted and reviewed — strongest legal vertical asset to date',
      ]),
      bottlenecks: JSON.stringify([
        'Healthcare vertical requires dedicated HIPAA compliance documentation — not yet started',
        'Family office pilot feedback analysis delayed — needs prioritization this week',
      ]),
      recurringThemes: JSON.stringify([
        'Privacy architecture is the universal differentiator across all verticals',
        'Stakeholders consistently ask about audit trail capabilities — strengthen this narrative',
        'Enterprise buyers want to see the agent swarm in action, not just hear about it',
      ]),
      optimizationSuggestions: JSON.stringify([
        'Build a live demo script that showcases multi-agent coordination in real-time',
        'Create vertical-specific one-pagers that compliance officers can circulate internally',
        'Develop ROI calculator for each vertical showing cost of current approach vs SETH',
      ]),
      executionScore: 82,
      focusScore: 78,
      consistencyScore: 85,
    },
  })
  console.log('Demo cortex reflection created')

  // ─── Watches — strategic intelligence monitoring ─────────────
  await prisma.watch.deleteMany({ where: { userId: user.id } })
  const watches = [
    {
      userId: user.id,
      name: 'SEC AI Regulation Updates',
      type: 'news',
      query: 'SEC artificial intelligence regulation investment advisor fintech compliance 2025 2026',
      threshold: 'any material regulatory development',
      frequency: 'daily',
      active: true,
    },
    {
      userId: user.id,
      name: 'Healthcare AI Market Movements',
      type: 'news',
      query: 'healthcare AI HIPAA compliance enterprise deployment hospital system',
      threshold: 'major vendor announcements or regulatory changes',
      frequency: 'daily',
      active: true,
    },
    {
      userId: user.id,
      name: 'Competitor Intelligence: Palantir AIP',
      type: 'news',
      query: 'Palantir AIP enterprise AI deployment pricing customer wins',
      threshold: 'new customer announcements or pricing changes',
      frequency: 'weekly',
      active: true,
    },
  ]
  for (const watch of watches) {
    await prisma.watch.create({ data: watch })
  }
  console.log('Demo watches created:', watches.length)

  console.log('\n✅ Demo account seeding complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Email:    demo@sethassistant.digital')
  console.log(`Password: ${demoPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('Demo seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
