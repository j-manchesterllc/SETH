import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
