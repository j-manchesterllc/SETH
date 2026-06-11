'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
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
import {
  Brain,
  Plus,
  Search,
  Loader2,
  Trash2,
  Edit,
  Tag,
  Lightbulb,
  FileText,
  Settings,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface Memory {
  id: string
  type: string
  content: string
  importance: number
  tags: string | null
  createdAt: string
}

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  context: { label: 'Context', icon: FileText, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  decision: { label: 'Decision', icon: Lightbulb, color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  preference: { label: 'Preference', icon: Settings, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  note: { label: 'Note', icon: Brain, color: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30' },
}

export function MemoriesPageClient() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)

  // Form state
  const [formType, setFormType] = useState('note')
  const [formContent, setFormContent] = useState('')
  const [formImportance, setFormImportance] = useState(5)
  const [formTags, setFormTags] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchMemories = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (search) params.set('search', search)
      const res = await fetch(`/api/memories?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMemories(data ?? [])
      }
    } catch (e: any) {
      console.error('Failed to fetch memories', e)
    } finally {
      setLoading(false)
    }
  }, [filterType, search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchMemories()
    }, 300)
    return () => clearTimeout(debounce)
  }, [fetchMemories])

  const openCreateDialog = () => {
    setEditingMemory(null)
    setFormType('note')
    setFormContent('')
    setFormImportance(5)
    setFormTags('')
    setDialogOpen(true)
  }

  const openEditDialog = (memory: Memory) => {
    setEditingMemory(memory)
    setFormType(memory?.type ?? 'note')
    setFormContent(memory?.content ?? '')
    setFormImportance(memory?.importance ?? 5)
    setFormTags(memory?.tags ?? '')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formContent.trim()) {
      toast.error('Content is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        type: formType,
        content: formContent,
        importance: formImportance,
        tags: formTags || null,
      }

      const url = editingMemory ? `/api/memories/${editingMemory.id}` : '/api/memories'
      const method = editingMemory ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingMemory ? 'Memory updated!' : 'Memory created!')
        setDialogOpen(false)
        fetchMemories()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Failed to save memory')
      }
    } catch (e: any) {
      toast.error('Failed to save memory')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteMemory = async (memoryId: string) => {
    try {
      await fetch(`/api/memories/${memoryId}`, { method: 'DELETE' })
      toast.success('Memory deleted')
      fetchMemories()
    } catch (e: any) {
      toast.error('Failed to delete memory')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto bg-background rounded-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Memories</h1>
          <p className="text-sm text-muted-foreground">Context, decisions, preferences, and notes that Seth remembers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              New Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingMemory ? 'Edit Memory' : 'Create Memory'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="context">Context</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="preference">Preference</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormContent(e.target.value)}
                  placeholder="What should Seth remember?"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Importance ({formImportance}/10)</Label>
                <Slider
                  value={[formImportance]}
                  onValueChange={(v: number[]) => setFormImportance(v?.[0] ?? 5)}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formTags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTags(e.target.value)}
                  placeholder="strategy, q2, priority"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full" loading={submitting}>
                {editingMemory ? 'Update Memory' : 'Create Memory'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="context">Context</SelectItem>
            <SelectItem value="decision">Decision</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="note">Note</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (memories?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">No memories found</h3>
          <p className="text-sm text-muted-foreground">Add memories to help Seth understand your context better</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(memories ?? []).map((memory: Memory, index: number) => {
            const config = typeConfig[memory?.type ?? 'note'] ?? typeConfig.note
            const TypeIcon = config?.icon ?? Brain
            const tags = (memory?.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean)
            return (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="transition-all hover:shadow-md h-full bg-card border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className={cn('text-xs', config?.color)}>
                        <TypeIcon className="w-3 h-3 mr-1" />
                        {config?.label ?? 'Note'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5 text-xs text-muted-foreground dark:text-zinc-400">
                          <Star className="w-3 h-3" />
                          {memory?.importance ?? 5}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(memory)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMemory(memory.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground dark:text-zinc-200 mb-3 line-clamp-4">{memory?.content ?? ''}</p>
                    {(tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs dark:text-zinc-300">
                            <Tag className="w-2.5 h-2.5 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
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
