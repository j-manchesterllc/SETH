import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
