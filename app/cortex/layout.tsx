import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function CortexLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
