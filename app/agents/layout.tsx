import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
