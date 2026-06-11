'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { publishAlertOverlay } from '@/lib/environment-store'

interface UpcomingTask {
  id: string
  title: string
  priority: string
  dueDate: string
}

interface WatchAlert {
  watchId: string
  name: string
  type: string
  alert: string
}

interface AgentAlert {
  agentId: string
  agentName: string
  agentAvatar: string
  codename: string
  alert: string
  severity: 'info' | 'warning' | 'critical'
}

interface IntelInsight {
  type: string
  severity: 'low' | 'medium' | 'high'
  title: string
  insight: string
  action: string
}

interface CortexAlert {
  type: 'pattern' | 'contradiction' | 'memory_decay'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  targetId: string
  confidence?: number
}

interface AlertsState {
  overdueTasks: UpcomingTask[]
  urgentTasks: UpcomingTask[]
  watchAlerts: WatchAlert[]
  autoExecuted: Array<{ taskId: string; title: string; result: string; status: string }>
  agentAlerts: AgentAlert[]
  intelInsights: IntelInsight[]
  cortexAlerts: CortexAlert[]
  lastChecked: Date | null
}

function getSettings() {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem('seth_settings')
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return null
}

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const WATCH_CHECK_INTERVAL = 30 * 60 * 1000 // 30 minutes
const AUTO_EXEC_INTERVAL = 10 * 60 * 1000 // 10 minutes
const AGENT_MONITOR_INTERVAL = 60 * 60 * 1000 // 60 minutes
const INTEL_SCAN_INTERVAL = 30 * 60 * 1000 // 30 minutes
const CORTEX_ALERT_INTERVAL = 15 * 60 * 1000 // 15 minutes

export function useProactiveAlerts() {
  const { data: session } = useSession() || {}
  const [alerts, setAlerts] = useState<AlertsState>({
    overdueTasks: [],
    urgentTasks: [],
    watchAlerts: [],
    autoExecuted: [],
    agentAlerts: [],
    intelInsights: [],
    cortexAlerts: [],
    lastChecked: null,
  })
  const [isChecking, setIsChecking] = useState(false)
  const taskTimerRef = useRef<ReturnType<typeof setInterval>>()
  const watchTimerRef = useRef<ReturnType<typeof setInterval>>()
  const autoExecTimerRef = useRef<ReturnType<typeof setInterval>>()
  const agentMonitorTimerRef = useRef<ReturnType<typeof setInterval>>()
  const intelScanTimerRef = useRef<ReturnType<typeof setInterval>>()
  const cortexAlertTimerRef = useRef<ReturnType<typeof setInterval>>()
  const notifiedRef = useRef<Set<string>>(new Set())

  const sendNotification = useCallback((title: string, body: string, tag: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (notifiedRef.current.has(tag)) return
      notifiedRef.current.add(tag)
      // Clear from set after 30 min to allow re-notify
      setTimeout(() => notifiedRef.current.delete(tag), 30 * 60 * 1000)

      try {
        new Notification(title, {
          body,
          icon: '/seth-icon-192.png',
          badge: '/seth-icon-192.png',
          tag,
          requireInteraction: true,
        })
      } catch {
        // Fallback for environments that don't support Notification constructor
      }
    }
  }, [])

  const checkDeadlines = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/tasks/upcoming')
      if (!res.ok) return
      const data = await res.json()

      const overdue = data?.overdueTasks ?? data?.overdue ?? []
      const urgent = [...(data?.dueIn1Hour ?? []), ...(data?.dueIn4Hours ?? [])]

      setAlerts((prev) => ({
        ...prev,
        overdueTasks: overdue,
        urgentTasks: urgent,
        lastChecked: new Date(),
      }))

      // Fire notifications for tasks that need them
      const needsNotif = data?.needsNotification ?? []
      for (const task of needsNotif) {
        const isOverdue = overdue.some((t: any) => t.id === task.id)
        sendNotification(
          isOverdue ? '⚠️ OVERDUE Task' : '⏰ Task Due Soon',
          `${task.title} — ${task.priority} priority`,
          `task-${task.id}`
        )
      }
    } catch (err) {
      // Silent fail
    }
  }, [session, sendNotification])

  const checkWatches = useCallback(async () => {
    if (!session?.user) return
    try {
      setIsChecking(true)
      const res = await fetch('/api/watches/check', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()

      const watchAlerts = data?.alerts ?? []
      if (watchAlerts.length > 0) {
        setAlerts((prev) => {
          // Deduplicate by watchId and cap at 50 to prevent unbounded growth
          const existingIds = new Set(prev.watchAlerts.map(w => w.watchId))
          const newAlerts = watchAlerts.filter((a: WatchAlert) => !existingIds.has(a.watchId))
          const combined = [...prev.watchAlerts, ...newAlerts].slice(-50)
          return { ...prev, watchAlerts: combined }
        })

        for (const alert of watchAlerts) {
          sendNotification(
            `📡 ${alert.name}`,
            alert.alert.replace(/^ALERT:\s*/i, ''),
            `watch-${alert.watchId}-${Date.now()}`
          )
        }
      }
    } catch {
      // Silent
    } finally {
      setIsChecking(false)
    }
  }, [session, sendNotification])

  const autoExecuteTasks = useCallback(async () => {
    if (!session?.user) return
    try {
      // Run reprioritization first (escalate overdue, archive old completed)
      await fetch('/api/tasks/reprioritize', { method: 'POST' }).catch(() => {})

      const res = await fetch('/api/tasks/auto-execute', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()

      const executed = data?.executed ?? []
      const proposed = data?.proposed ?? []

      if (executed.length > 0) {
        setAlerts((prev) => {
          const existingIds = new Set(prev.autoExecuted.map(t => t.taskId))
          const newExec = executed.filter((t: any) => !existingIds.has(t.taskId))
          const combined = [...prev.autoExecuted, ...newExec].slice(-50)
          return { ...prev, autoExecuted: combined }
        })

        for (const task of executed) {
          sendNotification(
            task.status === 'completed' ? '✅ Task Auto-Executed' : '❌ Task Execution Failed',
            task.title,
            `auto-${task.taskId}`
          )
        }
      }

      // Notify about Level 3 tasks needing approval
      for (const p of proposed.filter((x: any) => x.level === 3)) {
        sendNotification(
          '🔔 Approval Required',
          `Seth needs your approval: ${p.title}`,
          `approval-${p.taskId}`
        )
      }
      // Notify about Level 2 auto-executed tasks
      for (const p of proposed.filter((x: any) => x.level === 2)) {
        sendNotification(
          '⚡ Task Completed (Level 2)',
          `Seth executed: ${p.title}`,
          `level2-${p.taskId}`
        )
      }
    } catch {
      // Silent
    }
  }, [session, sendNotification])

  // Agent autonomous monitoring
  const runAgentMonitor = useCallback(async () => {
    if (!session?.user) return
    const settings = getSettings()
    if (settings && !settings.proactiveAgents) return // User disabled proactive agents

    try {
      const res = await fetch('/api/agents/monitor', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()

      const newAlerts: AgentAlert[] = data?.alerts ?? []
      if (newAlerts.length > 0) {
        setAlerts(prev => {
          // Replace stale alerts from same agent with fresh ones
          const newAlertAgentIds = new Set(newAlerts.map(a => a.agentId))
          const kept = prev.agentAlerts.filter(a => !newAlertAgentIds.has(a.agentId))
          return { ...prev, agentAlerts: [...kept, ...newAlerts].slice(-20) }
        })

        for (const alert of newAlerts) {
          const severityIcon = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '📡'
          sendNotification(
            `${severityIcon} ${alert.agentName} Alert`,
            alert.alert.slice(0, 100),
            `agent-${alert.agentId}-${Date.now()}`
          )
        }
      }
    } catch { /* silent */ }
  }, [session, sendNotification])

  // Proactive intelligence scan
  const runIntelScan = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/intelligence/scan', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()

      const insights: IntelInsight[] = data?.insights ?? []
      if (insights.length > 0) {
        setAlerts(prev => ({
          ...prev,
          intelInsights: insights.slice(0, 10), // replace with latest
        }))

        // Only notify on high severity
        for (const insight of insights.filter(i => i.severity === 'high')) {
          sendNotification(
            `🧠 ${insight.title}`,
            insight.insight.slice(0, 100),
            `intel-${insight.type}-${Date.now()}`
          )
        }
      }
    } catch { /* silent */ }
  }, [session, sendNotification])

  // Cortex proactive alerts
  const checkCortexAlerts = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/cortex/alerts')
      if (!res.ok) return
      const data = await res.json()

      const cortexAlerts: CortexAlert[] = data?.alerts ?? []
      if (cortexAlerts.length > 0) {
        setAlerts(prev => ({ ...prev, cortexAlerts }))

        // Trigger environment alert overlay for highest-severity alert
        const criticalAlert = cortexAlerts.find(a => a.severity === 'critical') || cortexAlerts.find(a => a.severity === 'warning')
        if (criticalAlert) {
          const overlayType = criticalAlert.type === 'contradiction' ? 'contradiction' as const
            : criticalAlert.type === 'memory_decay' ? 'drift' as const
            : 'insight' as const
          publishAlertOverlay(overlayType, criticalAlert.severity === 'critical' ? 0.8 : 0.5)
        }

        // Notify on critical/warning
        for (const alert of cortexAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning')) {
          const icon = alert.type === 'contradiction' ? '⚠️' : alert.type === 'pattern' ? '🧠' : '💭'
          sendNotification(
            `${icon} Cortex: ${alert.title}`,
            alert.message.slice(0, 100),
            `cortex-${alert.type}-${alert.targetId}`
          )
        }
      }
    } catch { /* silent */ }
  }, [session, sendNotification])

  const dismissAlert = useCallback((type: 'overdue' | 'urgent' | 'watch' | 'autoExec' | 'agent' | 'intel' | 'cortex', id?: string) => {
    setAlerts((prev) => {
      if (type === 'overdue') return { ...prev, overdueTasks: id ? prev.overdueTasks.filter(t => t.id !== id) : [] }
      if (type === 'urgent') return { ...prev, urgentTasks: id ? prev.urgentTasks.filter(t => t.id !== id) : [] }
      if (type === 'watch') return { ...prev, watchAlerts: id ? prev.watchAlerts.filter(w => w.watchId !== id) : [] }
      if (type === 'autoExec') return { ...prev, autoExecuted: id ? prev.autoExecuted.filter(t => t.taskId !== id) : [] }
      if (type === 'agent') return { ...prev, agentAlerts: id ? prev.agentAlerts.filter(a => a.agentId !== id) : [] }
      if (type === 'intel') return { ...prev, intelInsights: id ? prev.intelInsights.filter((_, i) => String(i) !== id) : [] }
      if (type === 'cortex') return { ...prev, cortexAlerts: id ? prev.cortexAlerts.filter(a => a.targetId !== id) : [] }
      return prev
    })
  }, [])

  useEffect(() => {
    if (!session?.user) return

    // Read user-configured intervals
    const settings = getSettings()
    const deadlineMs = (settings?.deadlineCheckInterval ?? 5) * 60_000
    const watchMs = (settings?.watchCheckInterval ?? 30) * 60_000
    const autoExecMs = (settings?.autoExecInterval ?? 10) * 60_000
    const agentMonitorMs = (settings?.agentMonitorInterval ?? 60) * 60_000

    // Initial checks
    checkDeadlines()
    setTimeout(() => checkWatches(), 5000)
    setTimeout(() => autoExecuteTasks(), 10000)
    setTimeout(() => runAgentMonitor(), 20000)
    setTimeout(() => runIntelScan(), 30000)
    setTimeout(() => checkCortexAlerts(), 35000)

    // Set up intervals using user settings
    taskTimerRef.current = setInterval(checkDeadlines, deadlineMs)
    watchTimerRef.current = setInterval(checkWatches, watchMs)
    autoExecTimerRef.current = setInterval(autoExecuteTasks, autoExecMs)
    agentMonitorTimerRef.current = setInterval(runAgentMonitor, agentMonitorMs)
    intelScanTimerRef.current = setInterval(runIntelScan, INTEL_SCAN_INTERVAL)
    cortexAlertTimerRef.current = setInterval(checkCortexAlerts, CORTEX_ALERT_INTERVAL)

    return () => {
      clearInterval(taskTimerRef.current)
      clearInterval(watchTimerRef.current)
      clearInterval(autoExecTimerRef.current)
      clearInterval(agentMonitorTimerRef.current)
      clearInterval(intelScanTimerRef.current)
      clearInterval(cortexAlertTimerRef.current)
    }
  }, [session, checkDeadlines, checkWatches, autoExecuteTasks, runAgentMonitor, runIntelScan, checkCortexAlerts])

  const totalAlerts =
    alerts.overdueTasks.length +
    alerts.urgentTasks.length +
    alerts.watchAlerts.length +
    alerts.autoExecuted.length +
    alerts.agentAlerts.length +
    alerts.intelInsights.filter(i => i.severity === 'high').length +
    alerts.cortexAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length

  return {
    alerts,
    totalAlerts,
    isChecking,
    checkDeadlines,
    checkWatches,
    autoExecuteTasks,
    runAgentMonitor,
    runIntelScan,
    checkCortexAlerts,
    dismissAlert,
  }
}
