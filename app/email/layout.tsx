import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
