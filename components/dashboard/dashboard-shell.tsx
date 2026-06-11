'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { OperationalEnvironment } from '@/components/environments/operational-environment'
import {
  MessageSquare,
  CheckSquare,
  Brain,
  User,
  LogOut,
  PanelLeft,
  X,
  Globe,
  Radar,
  Workflow,
  Calendar,
  Mail,
  BarChart3,
  Users,
  Fingerprint,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { AlertCenter } from '@/components/alerts/alert-center'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Core',
    items: [
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/memories', label: 'Memories', icon: Brain },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/watches', label: 'Watches', icon: Radar },
      { href: '/agents', label: 'Agents', icon: Users },
      { href: '/brand', label: 'Brand', icon: Fingerprint },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/automations', label: 'Automations', icon: Workflow },
      { href: '/environments', label: 'Environments', icon: Globe },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
      { href: '/email', label: 'Email', icon: Mail },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/cortex', label: 'Cortex', icon: Brain },
      { href: '/system', label: 'System', icon: BarChart3 },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/profile', label: 'Profile', icon: User },
    ],
  },
]

function NavGroup({ section, pathname, onNavigate }: {
  section: NavSection
  pathname: string | null
  onNavigate: () => void
}) {
  const hasActive = section.items.some(item => pathname?.startsWith?.(item.href))
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <span>{section.label}</span>
        <ChevronDown className={cn(
          'w-3 h-3 transition-transform duration-200',
          !open && '-rotate-90'
        )} />
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-200',
        open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="space-y-0.5 py-0.5">
          {section.items.map((item) => {
            const isActive = pathname?.startsWith?.(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary/10 text-primary nav-glow'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]')} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession() || {}
  const pathname = usePathname()
  const [pageKey, setPageKey] = useState(pathname)

  useEffect(() => {
    setPageKey(pathname)
  }, [pathname])

  return (
    <div className="min-h-screen relative z-[1]">
      {/* Operational Environment — spatial decision anchor */}
      <OperationalEnvironment />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 border-r border-border/60 bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
            <img src="/seth-logo.png" alt="SETH" className="w-8 h-8 rounded-lg shadow-[var(--glow-primary)]" />
            <div>
              <h1 className="text-base font-display font-bold tracking-tight">SETH</h1>
              <p className="text-[9px] text-muted-foreground/60 leading-none font-medium uppercase tracking-wider">Strategic Executive Hub</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden h-7 w-7"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-none px-3 pt-4 pb-2">
            {navSections.map((section) => (
              <NavGroup
                key={section.label}
                section={section}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-border/50 p-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">
                  {session?.user?.name?.[0]?.toUpperCase?.() ?? 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session?.user?.name ?? 'User'}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">{session?.user?.email ?? ''}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground h-7 text-xs"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="lg:pl-60">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border/50 bg-card/80 backdrop-blur-xl px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <img src="/seth-logo.png" alt="SETH" className="w-5 h-5 rounded" />
            <span className="font-display font-bold text-sm">SETH</span>
          </div>
          <AlertCenter />
        </header>

        {/* Desktop top bar */}
        <div className="hidden lg:flex sticky top-0 z-30 h-11 items-center justify-end border-b border-border/50 bg-card/80 backdrop-blur-xl px-6">
          <AlertCenter />
        </div>

        {/* Page content with enter animation */}
        <main key={pageKey} className="page-enter min-h-[calc(100vh-3rem)] lg:min-h-screen bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}