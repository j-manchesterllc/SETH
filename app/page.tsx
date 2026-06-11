import Link from 'next/link'
import { Shield, Brain, Zap, Lock, Users, BarChart3, ChevronRight, Eye, Globe, Cpu, FileText, CalendarDays, Mail, UserCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { AuthRedirect } from '@/components/auth-redirect'

export const metadata: Metadata = {
  title: 'SETH — Strategic Executive Technology Hub',
  description: 'Enterprise-grade AI operating system for strategic executives. Privacy-first architecture, multi-agent intelligence, and autonomous operations designed for Fortune 1000 leadership.',
  openGraph: {
    title: 'SETH — Strategic Executive Technology Hub',
    description: 'Enterprise-grade AI operating system for strategic executives. Privacy-first architecture, multi-agent intelligence, and autonomous operations.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Client-side redirect for authenticated users — no server-side redirect so Google sees a static page */}
      <AuthRedirect />
      {/* Navigation */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/seth-logo.png" alt="SETH" className="w-9 h-9 rounded-xl" />
            <div>
              <span className="text-lg font-display font-bold tracking-tight">SETH</span>
              <p className="text-[8px] text-muted-foreground/60 leading-none font-medium uppercase tracking-widest -mt-0.5">Strategic Executive Hub</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:inline-block"
            >
              Privacy
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded-lg"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
              <Shield className="w-3.5 h-3.5" />
              Enterprise-Grade Privacy by Design
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.1] mb-6">
              Your Strategic
              <br />
              <span className="text-primary">Operating System</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              SETH is an AI-powered executive technology hub built for leaders who handle sensitive, high-stakes decisions. Privacy-first architecture. Multi-agent intelligence. Zero compromises.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-8 py-3.5 rounded-xl font-medium text-base shadow-lg shadow-primary/20 hover:shadow-primary/30"
              >
                Start Now <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all px-8 py-3.5 rounded-xl font-medium text-base text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="py-20 sm:py-28 border-t border-border/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4">Built for Consequential Work</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Not another productivity tool. SETH operates at the layer between you and the world — handling entire categories of work so you never have to think about them.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'Multi-Agent Intelligence',
                description: 'Five specialized agents — research, financial strategy, communications, operational security, and brand management — operating in autonomous coordination.',
              },
              {
                icon: Shield,
                title: 'Privacy-First Architecture',
                description: 'Your data is never sold, monetized, or shared. Isolated environments, encrypted storage, and privacy-tiered AI processing by default.',
              },
              {
                icon: Zap,
                title: 'Autonomous Operations',
                description: 'From task execution to memory consolidation, SETH learns your patterns and handles routine operations without intervention.',
              },
              {
                icon: Cpu,
                title: 'Adaptive Learning Engine',
                description: 'Cortex continuously observes, detects patterns, and self-optimizes — surfacing strategic insights and contradictions before they become problems.',
              },
              {
                icon: Eye,
                title: 'Knowledge Graph',
                description: 'Automatic entity extraction builds a living map of people, projects, and relationships across every conversation and memory.',
              },
              {
                icon: Globe,
                title: 'Wearable Integration',
                description: 'API-first voice pipeline for smart glasses and wearable hardware. Always-on strategic intelligence at the speed of thought.',
              },
            ].map((capability) => (
              <div
                key={capability.title}
                className="group p-6 rounded-2xl bg-card border border-border/60 hover:border-primary/30 transition-all hover:shadow-lg"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <capability.icon className="w-5.5 h-5.5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2">{capability.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 sm:py-28 border-t border-border/30 bg-card/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-6">
                <Lock className="w-3.5 h-3.5" />
                Enterprise Security
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-6">Security That Executives Demand</h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-8">
                Built from the ground up for organizations that handle material non-public information, privileged communications, and strategic intelligence. Your data stays yours.
              </p>
              <div className="space-y-4">
                {[
                  { label: 'TLS 1.3 encryption for all data in transit' },
                  { label: 'AES-256 encryption for data at rest' },
                  { label: 'bcrypt password hashing with adaptive cost' },
                  { label: 'Strict per-user data isolation — no cross-tenant access' },
                  { label: 'Zero advertising, zero data brokering — ever' },
                  { label: 'Privacy-tiered model routing by default' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl bg-card border border-border/60 p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Specialized Agent Swarm</div>
                    <div className="text-xs text-muted-foreground">5 autonomous specialists</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'SENTINEL', role: 'Research & Intelligence' },
                    { name: 'ARCHITECT', role: 'Financial Strategy' },
                    { name: 'HERALD', role: 'Communications & Narrative' },
                    { name: 'PHANTOM', role: 'Operational Security' },
                    { name: 'VANGUARD', role: 'Brand & Reputation' },
                  ].map((agent) => (
                    <div key={agent.name} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-mono font-semibold text-primary">{agent.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{agent.role}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Autonomous coordination with consensus synthesis
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Transparency Section */}
      <section className="py-20 sm:py-28 border-t border-border/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-medium mb-6">
              <FileText className="w-3.5 h-3.5" />
              Data Transparency
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4">How SETH Uses Your Data</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Full transparency into what we collect, why we need it, and how it powers your strategic advantage. We believe you should always know exactly what your tools are doing with your information.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: UserCheck,
                title: 'Account & Profile',
                description: 'Your name and email address are used to create and authenticate your account. If you sign in with Google, we receive your basic profile information (name, email, profile photo) to streamline login. We never store your Google password.',
              },
              {
                icon: CalendarDays,
                title: 'Google Calendar Access',
                description: 'When you connect Google Calendar, SETH can read and manage your calendar events to provide scheduling intelligence, conflict detection, and automated time-blocking. This access is used exclusively within your SETH dashboard and is never shared.',
              },
              {
                icon: Mail,
                title: 'Gmail Access',
                description: 'When you connect Gmail, SETH can read and organize your email to surface priorities, draft responses, and integrate communications into your strategic workflow. Email content is processed only for your benefit and is never used for advertising or shared with third parties.',
              },
              {
                icon: Brain,
                title: 'Conversations & Memories',
                description: 'Your conversations, tasks, memories, and strategic preferences are stored to provide personalized AI assistance that improves over time. All data is strictly isolated to your account — no cross-user access is architecturally possible.',
              },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-2xl bg-card border border-border/60">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">For complete details on data collection, retention, security, and your rights, read our full privacy policy.</p>
            <Link href="/privacy" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors">
              <Shield className="w-4 h-4" /> Read Our Privacy Policy <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 border-t border-border/30 bg-card/40">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4">Ready to Operate at a Higher Level?</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            SETH is built for executives who don&apos;t just want to be productive — they want to be consequential.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-8 py-3.5 rounded-xl font-medium text-base shadow-lg shadow-primary/20"
          >
            Create Your Account <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/seth-logo.png" alt="SETH" className="w-6 h-6 rounded-lg" />
              <span className="text-sm font-display font-semibold">SETH</span>
              <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} J Manchester</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
