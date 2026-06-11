'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Radar,
  Plus,
  Trash2,
  TrendingUp,
  Newspaper,
  Eye,
  Loader2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

interface Watch {
  id: string
  name: string
  type: string
  query: string
  threshold: string | null
  frequency: string
  active: boolean
  lastChecked: string | null
  lastResult: string | null
  lastAlerted: string | null
  createdAt: string
}

const WATCH_TYPES = [
  { value: 'price', label: 'Price Watch', icon: TrendingUp, placeholder: 'e.g., Bitcoin, Tesla stock, Gold' },
  { value: 'news', label: 'News Watch', icon: Newspaper, placeholder: 'e.g., AI regulation, competitor name, industry keyword' },
  { value: 'custom', label: 'Custom Watch', icon: Eye, placeholder: 'e.g., any topic or data point to monitor' },
]

const FREQUENCIES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

export default function WatchesPage() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [checking, setChecking] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('price')
  const [formQuery, setFormQuery] = useState('')
  const [formThreshold, setFormThreshold] = useState('')
  const [formFrequency, setFormFrequency] = useState('daily')

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch('/api/watches')
      if (res.ok) {
        const data = await res.json()
        setWatches(data?.watches ?? [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWatches() }, [fetchWatches])

  const createWatch = async () => {
    if (!formName.trim() || !formQuery.trim()) {
      toast.error('Name and query are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          query: formQuery.trim(),
          threshold: formThreshold.trim() || null,
          frequency: formFrequency,
        }),
      })
      if (res.ok) {
        toast.success('Watch created')
        setFormName(''); setFormQuery(''); setFormThreshold(''); setShowForm(false)
        fetchWatches()
      } else {
        toast.error('Failed to create watch')
      }
    } catch { toast.error('Error creating watch') } finally { setCreating(false) }
  }

  const toggleWatch = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/watches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      })
      fetchWatches()
    } catch {}
  }

  const deleteWatch = async (id: string) => {
    try {
      await fetch(`/api/watches/${id}`, { method: 'DELETE' })
      fetchWatches()
      toast.success('Watch deleted')
    } catch {}
  }

  const checkNow = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/watches/check', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        const alertCount = data?.alerts?.length ?? 0
        toast.success(alertCount > 0 ? `${alertCount} alert(s) triggered!` : 'All watches checked — no alerts')
        fetchWatches()
      }
    } catch { toast.error('Check failed') } finally { setChecking(false) }
  }

  const selectedType = WATCH_TYPES.find(t => t.value === formType)

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Watches</h1>
            <p className="text-sm text-muted-foreground">Monitor news, prices, and custom intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={checkNow} disabled={checking || watches.length === 0}>
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Check Now
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Watch
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Bitcoin Watch" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <div className="flex gap-2">
                {WATCH_TYPES.map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.value}
                      onClick={() => setFormType(t.value)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors',
                        formType === t.value ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label.replace(' Watch', '')}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">What to monitor</label>
            <Input value={formQuery} onChange={(e) => setFormQuery(e.target.value)} placeholder={selectedType?.placeholder} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Alert condition (optional)</label>
              <Input value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)}
                placeholder={formType === 'price' ? 'e.g., drops below $50,000' : 'e.g., any major development'}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check frequency</label>
              <div className="flex gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormFrequency(f.value)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                      formFrequency === f.value ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={createWatch} disabled={creating}>
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create Watch
            </Button>
          </div>
        </div>
      )}

      {/* Watch list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : watches.length === 0 ? (
        <div className="text-center py-16">
          <Radar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No watches yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Set up intelligence watches to monitor news, prices, and custom data points. Seth will alert you when conditions are met.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {watches.map((watch) => {
            const typeInfo = WATCH_TYPES.find(t => t.value === watch.type)
            const TypeIcon = typeInfo?.icon ?? Eye
            return (
              <div key={watch.id} className={cn(
                'rounded-xl border bg-card p-4 transition-colors',
                watch.active ? 'border-border' : 'border-border/30 opacity-60'
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
                    watch.type === 'price' ? 'bg-emerald-500/10' :
                    watch.type === 'news' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                  )}>
                    <TypeIcon className={cn(
                      'w-4 h-4',
                      watch.type === 'price' ? 'text-emerald-500' :
                      watch.type === 'news' ? 'text-blue-500' : 'text-purple-500'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{watch.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {watch.frequency}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{watch.query}</p>
                    {watch.threshold && (
                      <p className="text-[11px] text-primary/80 mt-1">Alert: {watch.threshold}</p>
                    )}
                    {watch.lastResult && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                          <ChevronDown className="w-3 h-3" />
                          Last result {watch.lastChecked ? `· ${new Date(watch.lastChecked).toLocaleString()}` : ''}
                        </summary>
                        <p className="text-xs text-muted-foreground mt-1.5 pl-4 border-l border-border/50 whitespace-pre-wrap line-clamp-6">
                          {watch.lastResult}
                        </p>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleWatch(watch.id, watch.active)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      {watch.active
                        ? <ToggleRight className="w-5 h-5 text-primary" />
                        : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      }
                    </button>
                    <button onClick={() => deleteWatch(watch.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
