import Link from 'next/link'
import { Shield, Brain, Zap, Lock, Users, BarChart3, ChevronRight, Eye, Globe, Cpu, Target, TrendingUp, Layers, GitBranch, Workflow, Radar, Fingerprint, Calendar, Mail, MessageSquare, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SETH — Executive Summary for Investors',
  description: 'Strategic Executive Technology Hub — Investment opportunity in next-generation executive AI infrastructure.',
  robots: { index: false, follow: false },
}

const METRICS = [
  { label: 'Addressable Market', value: '$47B', sub: 'Executive productivity + AI assistant market by 2028' },
  { label: 'Architecture', value: 'Multi-Agent', sub: '7 specialized autonomous agents with cortex intelligence' },
  { label: 'Deployment Surface', value: '3 Domains', sub: 'PWA, wearable voice pipeline, companion API' },
  { label: 'Data Moat Depth', value: '12 Layers', sub: 'Memory, patterns, relationships, brand, email, calendar' },
]

const MODULES = [
  { icon: MessageSquare, name: 'Executive Chat', desc: 'Context-aware conversational AI with strategic memory and voice control. Retains operational context across sessions — compounding value no human assistant replicates.' },
  { icon: Users, name: 'Agent Swarm', desc: 'Seven specialized agents (Architect, Sentinel, Quartermaster, Navigator, Diplomat, Chronicler, Vanguard) autonomously handling wealth strategy, security, logistics, research, communications, documentation, and opportunity scouting.' },
  { icon: Brain, name: 'Cortex Intelligence', desc: 'Self-improving cognitive layer that detects behavioral patterns, contradiction alerts, relationship mapping, and strategic insights — all derived from the principal\'s own data without external training.' },
  { icon: Fingerprint, name: 'Brand Manager', desc: 'AI-driven brand voice auditing, competitive intelligence, content strategy, and strategic alignment scoring with evidence-derived confidence metrics and ablation testing.' },
  { icon: Workflow, name: 'Browser Automation', desc: 'Headless browser automation engine for data extraction, form submission, web research — tasks that previously required a human VA or RPA tooling.' },
  { icon: Radar, name: 'Watch System', desc: 'Continuous monitoring of user-defined intelligence targets with autonomous alerting. Proactive, not reactive — SETH surfaces what matters before it\'s asked.' },
  { icon: Globe, name: 'Operational Environments', desc: 'Immersive command interfaces tailored to work context — from executive boardroom to deep-work focus mode. Environment shapes cognitive output.' },
  { icon: Calendar, name: 'Unified Integration Layer', desc: 'Native Google Calendar, Gmail, and productivity tool integration — SETH operates inside the principal\'s existing workflow, not adjacent to it.' },
]

const DIFFERENTIATORS = [
  { title: 'Sovereign Data Architecture', desc: 'Unlike ChatGPT/Claude, SETH maintains a private knowledge base per user. Memories, patterns, and brand intelligence never leave the user\'s sovereign context. Data compounds — it doesn\'t reset.', icon: Lock },
  { title: 'Multi-Agent Autonomy', desc: 'Not a single-model chatbot. Seven specialized agents with distinct doctrines, operating at calibrated autonomy levels (1-4). The principal approves strategy; agents execute tactics.', icon: GitBranch },
  { title: 'Evidence-Derived Intelligence', desc: 'Brand audits, cortex insights, and strategic recommendations are backed by computed confidence scores — not hallucinated certainty. Coverage, freshness, anchor strength, and conflict detection are all pre-LLM metrics.', icon: Eye },
  { title: 'Compounding Context Moat', desc: 'Every interaction deepens SETH\'s operational context. After 90 days, a competitor would need to replicate months of accumulated intelligence to match SETH\'s contextual advantage — a structural switching cost.', icon: TrendingUp },
]

const REVENUE_STREAMS = [
  { tier: 'Operator', price: '$297/mo', features: ['Full agent swarm access', 'Brand intelligence suite', 'Browser automation (50/mo)', 'Cortex pattern detection'] },
  { tier: 'Principal', price: '$997/mo', features: ['Unlimited automation', 'Priority model routing', 'Custom agent doctrines', 'Wearable voice pipeline', 'White-glove onboarding'] },
  { tier: 'Enterprise', price: 'Custom', features: ['Multi-seat deployment', 'SSO/SAML integration', 'Dedicated infrastructure', 'Custom knowledge ingestion', 'SLA + compliance package'] },
]

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#07090f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/seth-logo.png" alt="SETH" className="w-9 h-9 rounded-xl" />
            <div>
              <span className="text-lg font-display font-bold tracking-tight">SETH</span>
              <p className="text-[8px] text-zinc-500 leading-none font-medium uppercase tracking-widest -mt-0.5">Investor Brief</p>
            </div>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors px-5 py-2 rounded-lg"
          >
            View Live Product →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/[0.04] via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/[0.03] rounded-full blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
              <Target className="w-3.5 h-3.5" />
              Confidential — Executive Summary
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.1] mb-6">
              The Operating System<br />
              <span className="text-blue-400">for Strategic Executives</span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-2xl mb-8">
              SETH replaces the fragmented stack of AI chatbots, human assistants, and productivity tools with a single sovereign intelligence infrastructure that compounds with every interaction.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#thesis" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors text-sm">
                Read Investment Thesis <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#product" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.08] font-medium transition-colors text-sm">
                Product Deep Dive
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-display font-bold text-white mb-1">{m.value}</p>
                <p className="text-sm font-semibold text-zinc-300 mb-0.5">{m.label}</p>
                <p className="text-xs text-zinc-500">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Thesis */}
      <section id="thesis" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Investment Thesis</h2>
        <div className="w-16 h-1 bg-blue-500 rounded-full mb-8" />
        <div className="space-y-6 text-zinc-400 text-lg leading-relaxed max-w-3xl">
          <p>
            The executive productivity market is broken. Today's C-suite leaders juggle 5-8 disconnected tools — a general AI chatbot, a human EA, calendar software, CRM, email clients, and market intelligence platforms. None of them talk to each other. None of them learn. Every Monday morning starts from zero.
          </p>
          <p>
            <span className="text-white font-semibold">SETH is the convergence play.</span> A single infrastructure layer that sits between an executive and the world — handling strategic analysis, brand management, task delegation, competitive intelligence, and autonomous operations. It retains full operational context across sessions, building a compounding intelligence moat that makes switching increasingly costly.
          </p>
          <p>
            The architecture is fundamentally different from consumer AI assistants. Where ChatGPT offers stateless conversation, SETH maintains a sovereign knowledge graph — memories, behavioral patterns, relationship maps, brand voice profiles, and strategic contradictions — all private, all persistent, all compounding.
          </p>
          <p>
            <span className="text-white font-semibold">The result:</span> After 90 days of use, SETH knows the principal's decision patterns, strategic priorities, communication style, and operational rhythm better than any human assistant could. That's not a feature — it's a structural moat.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="bg-white/[0.02] border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">The Problem</h2>
          <div className="w-16 h-1 bg-red-500/60 rounded-full mb-10" />
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Context Amnesia', desc: 'Every AI conversation starts from scratch. Executives repeat context endlessly. Human assistants take months to onboard and leave, taking institutional knowledge with them.' },
              { title: 'Tool Fragmentation', desc: 'Calendar, email, CRM, chat, research — all siloed. No tool sees the full picture. Strategic decisions are made with partial information scattered across 8 platforms.' },
              { title: 'Reactive by Default', desc: 'Current tools wait to be asked. Executives need proactive intelligence — contradictions surfaced, deadlines anticipated, opportunities identified before the window closes.' },
            ].map((p) => (
              <div key={p.title} className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <h3 className="text-lg font-semibold text-white mb-3">{p.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Architecture */}
      <section id="product" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Product Architecture</h2>
        <div className="w-16 h-1 bg-blue-500 rounded-full mb-4" />
        <p className="text-zinc-400 text-lg mb-12 max-w-2xl">
          Eight interconnected modules forming a cohesive executive operating system. Each module generates data that strengthens the others — creating compounding network effects within a single user.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {MODULES.map((m) => (
            <div key={m.name} className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                  <m.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">{m.name}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Competitive Differentiation */}
      <section className="bg-white/[0.02] border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Competitive Moat</h2>
          <div className="w-16 h-1 bg-emerald-500/60 rounded-full mb-12" />
          <div className="grid md:grid-cols-2 gap-8">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-1">
                  <d.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{d.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="mt-16">
            <h3 className="text-xl font-semibold text-white mb-6">Market Positioning</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Capability</th>
                    <th className="text-center py-3 px-4 text-zinc-400 font-medium">ChatGPT / Claude</th>
                    <th className="text-center py-3 px-4 text-zinc-400 font-medium">Human EA</th>
                    <th className="text-center py-3 px-4 text-blue-400 font-semibold">SETH</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {[
                    ['Persistent Memory', '❌', '⚠️ Partial', '✅ Sovereign'],
                    ['Multi-Agent Autonomy', '❌', '❌', '✅ 7 Agents'],
                    ['Brand Intelligence', '❌', '❌', '✅ Ablation-tested'],
                    ['Proactive Alerting', '❌', '⚠️ Manual', '✅ Autonomous'],
                    ['Browser Automation', '❌', '⚠️ Slow', '✅ Headless'],
                    ['Behavioral Pattern Detection', '❌', '❌', '✅ Cortex'],
                    ['Monthly Cost (FTE equiv)', '$20/mo', '$6-15K/mo', '$297-997/mo'],
                    ['Context Retention', 'Session only', 'Turnover risk', '∞ Compounding'],
                  ].map(([cap, gpt, ea, seth]) => (
                    <tr key={cap} className="border-b border-white/[0.04]">
                      <td className="py-3 px-4 text-zinc-300 font-medium">{cap}</td>
                      <td className="py-3 px-4 text-center">{gpt}</td>
                      <td className="py-3 px-4 text-center">{ea}</td>
                      <td className="py-3 px-4 text-center text-blue-300 font-medium">{seth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Revenue Model</h2>
        <div className="w-16 h-1 bg-amber-500/60 rounded-full mb-12" />
        <div className="grid md:grid-cols-3 gap-6">
          {REVENUE_STREAMS.map((r) => (
            <div key={r.tier} className={`p-6 rounded-xl border ${
              r.tier === 'Principal' 
                ? 'bg-blue-500/[0.06] border-blue-500/20' 
                : 'bg-white/[0.03] border-white/[0.06]'
            }`}>
              {r.tier === 'Principal' && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-2 block">Recommended</span>
              )}
              <h3 className="text-xl font-bold text-white mb-1">{r.tier}</h3>
              <p className="text-2xl font-display font-bold text-white mb-4">{r.price}</p>
              <ul className="space-y-2">
                {r.features.map((f) => (
                  <li key={f} className="text-sm text-zinc-400 flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 p-6 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <h3 className="text-lg font-semibold text-white mb-3">Unit Economics</h3>
          <div className="grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-zinc-500 mb-1">Target LTV</p>
              <p className="text-2xl font-bold text-white">$18K+</p>
              <p className="text-xs text-zinc-500">18-month avg retention at Principal tier</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Gross Margin Target</p>
              <p className="text-2xl font-bold text-white">75-82%</p>
              <p className="text-xs text-zinc-500">LLM API costs decline as context caching improves</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Switching Cost After 90 Days</p>
              <p className="text-2xl font-bold text-emerald-400">Very High</p>
              <p className="text-xs text-zinc-500">Accumulated memories, patterns, brand profiles are non-portable</p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="bg-white/[0.02] border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Technical Architecture</h2>
          <div className="w-16 h-1 bg-violet-500/60 rounded-full mb-10" />
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Infrastructure</h3>
              <ul className="space-y-3">
                {[
                  'Multi-model routing (privacy-first Venice + OpenRouter fallback chain)',
                  'Progressive Web App with offline-capable service worker',
                  'Wearable-ready voice pipeline (smart glasses, earbuds)',
                  'Sovereign data store — no shared training, no data leakage',
                  'Evidence-derived confidence scoring (pre-LLM computation)',
                  'Ablation testing framework for brand audit calibration',
                ].map((item) => (
                  <li key={item} className="text-sm text-zinc-400 flex items-start gap-2">
                    <Cpu className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Intelligence Layer</h3>
              <ul className="space-y-3">
                {[
                  'Cortex: behavioral pattern detection + contradiction alerting',
                  'Memory consolidation with decay curves (recency × importance)',
                  'Relationship graph extraction from communications',
                  'Proactive insight generation from accumulated context',
                  'Agent routing: task classification → specialist dispatch',
                  'Browser automation engine with headless execution',
                ].map((item) => (
                  <li key={item} className="text-sm text-zinc-400 flex items-start gap-2">
                    <Brain className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Roadmap</h2>
        <div className="w-16 h-1 bg-blue-500 rounded-full mb-12" />
        <div className="space-y-0">
          {[
            { phase: 'Delivered', status: 'completed', items: ['Full executive AI operating system', 'Multi-agent swarm with 7 specialists', 'Cortex intelligence layer', 'Brand audit engine with ablation testing', 'Browser automation', 'PWA with voice control', 'Google SSO + Calendar + Gmail integration'] },
            { phase: 'Q3 2026', status: 'active', items: ['Private beta — 25 executive users', 'Wearable companion deployment (Meta smart glasses)', 'Custom agent doctrine builder', 'Stripe integration for self-serve billing', 'Usage analytics dashboard for principals'] },
            { phase: 'Q4 2026', status: 'planned', items: ['Public launch — Operator + Principal tiers', 'Enterprise pilot program (3-5 accounts)', 'iOS companion app with Apple Watch support', 'Knowledge base import (Notion, Obsidian, Roam)', 'SOC 2 Type I certification initiated'] },
            { phase: 'H1 2027', status: 'planned', items: ['Enterprise tier GA with SSO/SAML', 'Multi-seat team deployment', 'Custom model fine-tuning per principal', 'API marketplace for third-party agent plugins', 'Series A target based on enterprise traction'] },
          ].map((r) => (
            <div key={r.phase} className="flex gap-6 pb-10">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  r.status === 'completed' ? 'bg-emerald-500' : r.status === 'active' ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-zinc-600'
                }`} />
                <div className="w-px flex-1 bg-white/[0.08]" />
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-white">{r.phase}</h3>
                  {r.status === 'completed' && <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Shipped</span>}
                  {r.status === 'active' && <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">In Progress</span>}
                </div>
                <ul className="space-y-1.5">
                  {r.items.map((item) => (
                    <li key={item} className="text-sm text-zinc-400 flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team / Vision */}
      <section className="bg-white/[0.02] border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Why Now</h2>
          <div className="w-16 h-1 bg-blue-500 rounded-full mb-10" />
          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-5 text-zinc-400 text-base leading-relaxed">
              <p>
                <span className="text-white font-semibold">LLM costs have dropped 95% in 18 months.</span> What was economically impossible in 2024 — running 7 specialized agents, each with rich context windows, for a single user — is now viable at consumer SaaS pricing.
              </p>
              <p>
                <span className="text-white font-semibold">The executive market is underserved.</span> Every AI company is chasing volume (consumer) or breadth (enterprise). Nobody is building depth-first for the 8M+ executives who need an operating system, not a chatbot.
              </p>
              <p>
                <span className="text-white font-semibold">Privacy is a feature, not a constraint.</span> Post-2024 AI regulation and enterprise data concerns make SETH's sovereign architecture a selling point. Your data never trains our models. Period.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <h3 className="text-lg font-semibold text-white mb-6">The Ask</h3>
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Stage</p>
                  <p className="text-lg font-semibold text-white">Pre-Seed / Seed</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Use of Funds</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Engineering hire (agent infrastructure), private beta operations (25 executive users for 90-day validation), SOC 2 compliance, and go-to-market for Q4 2026 public launch.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 mb-1">Key Milestone</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Validate 90-day retention and switching cost thesis with private beta cohort. Target: 80%+ monthly retention at $297+ ARPU.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Ready to See It Live?</h2>
        <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
          SETH is a working product — not a pitch deck. Log in and experience the full operating system.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Access Live Product <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="mailto:jm92879@gmail.com?subject=SETH Investment Inquiry"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 border border-white/[0.08] font-medium transition-colors"
          >
            <Mail className="w-4 h-4" /> Contact Founder
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/seth-logo.png" alt="SETH" className="w-6 h-6 rounded-lg" />
            <span className="text-sm text-zinc-500">SETH — Strategic Executive Technology Hub</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>Confidential</span>
            <span>·</span>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
