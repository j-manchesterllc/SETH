import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function EnvironmentsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
