'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  AlertTriangle,
  Clock,
  Radar,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  Users,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProactiveAlerts } from '@/hooks/use-proactive-alerts'

export function AlertCenter() {
  const { alerts, totalAlerts, isChecking, dismissAlert } = useProactiveAlerts()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      {/* Bell button with badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          totalAlerts > 0
            ? 'text-amber-400 hover:bg-amber-500/10'
            : 'text-muted-foreground hover:bg-muted/50'
        )}
      >
        <Bell className="w-5 h-5" />
        {totalAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] px-1">
            {totalAlerts > 9 ? '9+' : totalAlerts}
          </span>
        )}
        {isChecking && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl"
            >
              <div className="p-3 border-b border-border/50 flex items-center justify-between">
                <span className="text-sm font-semibold">Alert Center</span>
                {totalAlerts > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {totalAlerts} active
                  </span>
                )}
              </div>

              <div className="p-2 space-y-1">
                {/* Overdue tasks */}
                {alerts.overdueTasks.map((task) => (
                  <AlertItem
                    key={`overdue-${task.id}`}
                    icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                    title="OVERDUE"
                    subtitle={task.title}
                    detail={`${task.priority} priority`}
                    color="red"
                    onDismiss={() => dismissAlert('overdue', task.id)}
                  />
                ))}

                {/* Urgent tasks */}
                {alerts.urgentTasks.map((task) => (
                  <AlertItem
                    key={`urgent-${task.id}`}
                    icon={<Clock className="w-4 h-4 text-amber-500" />}
                    title="Due Soon"
                    subtitle={task.title}
                    detail={task.dueDate ? formatTimeUntil(task.dueDate) : ''}
                    color="amber"
                    onDismiss={() => dismissAlert('urgent', task.id)}
                  />
                ))}

                {/* Watch alerts */}
                {alerts.watchAlerts.map((alert, i) => (
                  <AlertItem
                    key={`watch-${alert.watchId}-${i}`}
                    icon={<Radar className="w-4 h-4 text-primary" />}
                    title={alert.name}
                    subtitle={alert.alert.replace(/^ALERT:\s*/i, '')}
                    detail={alert.type}
                    color="blue"
                    onDismiss={() => dismissAlert('watch', alert.watchId)}
                  />
                ))}

                {/* Auto-executed tasks */}
                {alerts.autoExecuted.map((task) => (
                  <AlertItem
                    key={`exec-${task.taskId}`}
                    icon={task.status === 'completed'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <XCircle className="w-4 h-4 text-red-500" />
                    }
                    title={task.status === 'completed' ? 'Auto-Executed' : 'Execution Failed'}
                    subtitle={task.title}
                    detail={task.result.slice(0, 80)}
                    color={task.status === 'completed' ? 'green' : 'red'}
                    onDismiss={() => dismissAlert('autoExec', task.taskId)}
                  />
                ))}

                {/* Agent autonomous alerts */}
                {alerts.agentAlerts.map((alert) => (
                  <AlertItem
                    key={`agent-${alert.agentId}`}
                    icon={<span className="text-base leading-none">{alert.agentAvatar}</span>}
                    title={`${alert.agentName} Alert`}
                    subtitle={alert.alert.slice(0, 100)}
                    detail={`Severity: ${alert.severity}`}
                    color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'amber' : 'blue'}
                    onDismiss={() => dismissAlert('agent', alert.agentId)}
                  />
                ))}

                {/* Intelligence insights */}
                {alerts.intelInsights.filter(i => i.severity === 'high').map((insight, idx) => (
                  <AlertItem
                    key={`intel-${idx}`}
                    icon={<Brain className="w-4 h-4 text-violet-500" />}
                    title={insight.title}
                    subtitle={insight.insight}
                    detail={`Action: ${insight.action}`}
                    color="purple"
                    onDismiss={() => dismissAlert('intel', String(idx))}
                  />
                ))}

                {/* Cortex alerts */}
                {alerts.cortexAlerts.map((alert) => (
                  <AlertItem
                    key={`cortex-${alert.targetId}`}
                    icon={
                      alert.type === 'contradiction'
                        ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                        : alert.type === 'pattern'
                        ? <Brain className="w-4 h-4 text-primary" />
                        : <Clock className="w-4 h-4 text-muted-foreground" />
                    }
                    title={alert.title}
                    subtitle={alert.message.slice(0, 100)}
                    detail={alert.confidence ? `Confidence: ${Math.round(alert.confidence * 100)}%` : 'Cortex insight'}
                    color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'amber' : 'blue'}
                    onDismiss={() => dismissAlert('cortex', alert.targetId)}
                  />
                ))}

                {totalAlerts === 0 && (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All clear, sir.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Monitoring tasks and watches</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function AlertItem({
  icon,
  title,
  subtitle,
  detail,
  color,
  onDismiss,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  detail: string
  color: string
  onDismiss: () => void
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">{title}</p>
        <p className="text-sm font-medium truncate">{subtitle}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{detail}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  )
}

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) return 'Overdue'
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}
