import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
