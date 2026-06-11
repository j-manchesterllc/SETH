'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  CheckSquare,
  Clock,
  AlertTriangle,
  Loader2,
  Trash2,
  Edit,
  Zap,
  Bell,
  Shield,
  LayoutList,
  Calendar,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  autonomyLevel: number
  priority: string
  dueDate: string | null
  createdAt: string
  executedAt: string | null
  executionResult: string | null
  pendingAction: string | null
  pendingActionStatus: string | null
}

const autonomyLabels: Record<number, { label: string; icon: any; desc: string }> = {
  1: { label: 'Auto-execute', icon: Zap, desc: 'Seth handles independently' },
  2: { label: 'Execute + Notify', icon: Bell, desc: 'Seth does it, reports back' },
  3: { label: 'Needs Approval', icon: Shield, desc: 'Seth plans, waits for go-ahead' },
  4: { label: 'Present Options', icon: LayoutList, desc: 'Seth lays out alternatives' },
}

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/20 text-destructive dark:text-red-300 border-destructive/30',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
}

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-foreground/70 border-border',
  'in-progress': 'bg-primary/20 text-primary dark:text-blue-300 border-primary/30',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
  archived: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/20',
}

export function TasksPageClient() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAutonomy, setFilterAutonomy] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formStatus, setFormStatus] = useState('pending')
  const [formAutonomy, setFormAutonomy] = useState('3')
  const [formPriority, setFormPriority] = useState('medium')
  const [formDueDate, setFormDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterAutonomy !== 'all') params.set('autonomyLevel', filterAutonomy)
      if (filterPriority !== 'all') params.set('priority', filterPriority)
      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data ?? [])
      }
    } catch (e: any) {
      console.error('Failed to fetch tasks', e)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterAutonomy, filterPriority])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const openCreateDialog = () => {
    setEditingTask(null)
    setFormTitle('')
    setFormDesc('')
    setFormStatus('pending')
    setFormAutonomy('3')
    setFormPriority('medium')
    setFormDueDate('')
    setDialogOpen(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setFormTitle(task?.title ?? '')
    setFormDesc(task?.description ?? '')
    setFormStatus(task?.status ?? 'pending')
    setFormAutonomy(String(task?.autonomyLevel ?? 3))
    setFormPriority(task?.priority ?? 'medium')
    setFormDueDate(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        title: formTitle,
        description: formDesc || null,
        status: formStatus,
        autonomyLevel: parseInt(formAutonomy),
        priority: formPriority,
        dueDate: formDueDate || null,
      }

      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
      const method = editingTask ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingTask ? 'Task updated!' : 'Task created!')
        setDialogOpen(false)
        fetchTasks()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Failed to save task')
      }
    } catch (e: any) {
      toast.error('Failed to save task')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      toast.success('Task deleted')
      fetchTasks()
    } catch (e: any) {
      toast.error('Failed to delete task')
    }
  }

  const toggleComplete = async (task: Task) => {
    const newStatus = task?.status === 'completed' ? 'pending' : 'completed'
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchTasks()
    } catch (e: any) {
      toast.error('Failed to update task')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage and track your tasks with Seth autonomy levels</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTitle(e.target.value)}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formDesc}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDesc(e.target.value)}
                  placeholder="Task description (optional)"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formPriority} onValueChange={setFormPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Autonomy Level</Label>
                  <Select value={formAutonomy} onValueChange={setFormAutonomy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">L1: Auto-execute</SelectItem>
                      <SelectItem value="2">L2: Execute + Notify</SelectItem>
                      <SelectItem value="3">L3: Needs Approval</SelectItem>
                      <SelectItem value="4">L4: Present Options</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formDueDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDueDate(e.target.value)}
                  />
                </div>
              </div>
              {/* Autonomy explanation */}
              {formAutonomy && autonomyLabels[parseInt(formAutonomy)] && (
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const Icon = autonomyLabels[parseInt(formAutonomy)]?.icon
                      return Icon ? <Icon className="w-4 h-4 text-primary" /> : null
                    })()}
                    <span className="font-medium">{autonomyLabels[parseInt(formAutonomy)]?.label}</span>
                  </div>
                  <p className="text-muted-foreground">{autonomyLabels[parseInt(formAutonomy)]?.desc}</p>
                </div>
              )}
              <Button onClick={handleSubmit} className="w-full" loading={submitting}>
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAutonomy} onValueChange={setFilterAutonomy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Autonomy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="1">L1: Auto-execute</SelectItem>
            <SelectItem value="2">L2: Execute + Notify</SelectItem>
            <SelectItem value="3">L3: Needs Approval</SelectItem>
            <SelectItem value="4">L4: Present Options</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (tasks?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">No tasks found</h3>
          <p className="text-sm text-muted-foreground">Create a task or ask Seth to suggest one in chat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(tasks ?? []).map((task: Task, index: number) => {
            const autonomy = autonomyLabels[task?.autonomyLevel ?? 3]
            const AutonomyIcon = autonomy?.icon ?? Shield
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    'transition-all hover:shadow-md cursor-pointer bg-card text-card-foreground',
                    task?.status === 'completed' && 'opacity-70'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleComplete(task)}
                        className={cn(
                          'mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          task?.status === 'completed'
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30 hover:border-primary'
                        )}
                      >
                        {task?.status === 'completed' && (
                          <CheckSquare className="w-3 h-3 text-primary-foreground" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={cn(
                            'font-medium text-foreground',
                            task?.status === 'completed' && 'line-through'
                          )}>
                            {task?.title ?? 'Untitled'}
                          </h3>
                          <Badge variant="outline" className={cn('text-xs', priorityColors[task?.priority ?? 'medium'])}>
                            {task?.priority ?? 'medium'}
                          </Badge>
                          <Badge variant="outline" className={cn('text-xs', statusColors[task?.status ?? 'pending'])}>
                            {task?.status ?? 'pending'}
                          </Badge>
                        </div>
                        {task?.description && (
                          <p className="text-sm text-foreground/70 mb-2 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <AutonomyIcon className="w-3 h-3" />
                            {autonomy?.label ?? `Level ${task?.autonomyLevel ?? 3}`}
                          </span>
                          {task?.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {task?.executedAt && task?.executionResult && (
                          <div className="mt-2 rounded-md bg-primary/15 border border-primary/25 p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Zap className="w-3 h-3 text-primary" />
                              <span className="text-xs font-medium text-primary dark:text-blue-300">Auto-executed</span>
                              <span className="text-[10px] text-muted-foreground/80 ml-auto">
                                {new Date(task.executedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/70 leading-relaxed">
                              {task.executionResult}
                            </p>
                          </div>
                        )}

                        {/* Level 3 Approval Workflow */}
                        {task?.pendingActionStatus === 'pending_approval' && task?.pendingAction && (() => {
                          let plan = ''
                          try { plan = JSON.parse(task.pendingAction).plan ?? '' } catch { plan = task.pendingAction }
                          return (
                            <div className="mt-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2.5">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Shield className="w-3 h-3 text-yellow-500" />
                                <span className="text-xs font-medium text-yellow-600 dark:text-yellow-300">Awaiting Approval</span>
                              </div>
                              <p className="text-xs text-foreground/70 leading-relaxed mb-2">{plan}</p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs px-3"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      const res = await fetch('/api/tasks/approve', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ taskId: task.id, decision: 'approve' }),
                                      })
                                      if (res.ok) {
                                        toast.success('Task approved and executed')
                                        fetchTasks()
                                      } else {
                                        toast.error('Approval failed')
                                      }
                                    } catch { toast.error('Approval failed') }
                                  }}
                                >
                                  <CheckSquare className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-3"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      const res = await fetch('/api/tasks/approve', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ taskId: task.id, decision: 'reject' }),
                                      })
                                      if (res.ok) {
                                        toast.success('Proposal rejected')
                                        fetchTasks()
                                      }
                                    } catch { toast.error('Rejection failed') }
                                  }}
                                >
                                  <X className="w-3 h-3 mr-1" /> Reject
                                </Button>
                              </div>
                            </div>
                          )
                        })()}

                        {task?.pendingActionStatus === 'rejected' && (
                          <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/20 p-2 flex items-center gap-1.5">
                            <X className="w-3 h-3 text-destructive" />
                            <span className="text-xs text-destructive/80">Proposal rejected</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(task)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
