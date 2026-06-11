import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
