'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint,
  Plus,
  Loader2,
  Save,
  Trash2,
  Mic,
  Target,
  FileText,
  TrendingUp,
  Eye,
  Palette,
  Shield,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  Send,
  AtSign,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  Zap,
  FlaskConical,
  Beaker,
  Play,
  Info,
} from 'lucide-react'

interface BrandProfile {
  id: string
  brandName: string
  tagline: string | null
  mission: string | null
  vision: string | null
  voiceTone: string | null
  targetAudience: string | null
  competitors: string | null
  visualIdentity: string | null
  contentPillars: string | null
  brandValues: string | null
  positioning: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { audits: number }
  audits: Array<{
    id: string
    type: string
    score: number | null
    createdAt: string
    result: string
  }>
}

interface ConfidenceBreakdown {
  coverage: number
  freshness: number
  anchorStrength: number
  conflictPenalty: number
  composite: number
}

interface ContextTelemetry {
  totalSourcesAttempted: number
  sourcesReturned: number
  sourcesTruncated: number
  sourcesDropped: number
  totalCharsRaw: number
  totalCharsBudgeted: number
  budgetUtilization: number
  auditType: string
  weightProfile: string
  structuralConflictsDetected: number
}

interface AuditResult {
  type: string
  score: number
  confidence: number
  confidenceBreakdown?: ConfidenceBreakdown
  findings: Array<{
    category: string
    status: 'strong' | 'moderate' | 'weak'
    detail: string
    recommendation?: string
    evidence?: string[]
    confidence?: number
  }>
  conflicts?: Array<{
    signalA: string
    signalB: string
    tension: string
    detectedBy?: 'structural' | 'llm'
  }>
  summary: string
  contextSources?: string[]
  telemetry?: ContextTelemetry
}

const statusBadge: Record<string, string> = {
  strong: 'bg-green-500/15 text-green-400 border-green-500/30',
  moderate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  weak: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function BrandPageClient() {
  const { data: session } = useSession() || {}
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<BrandProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'voice' | 'audit' | 'history' | 'posts' | 'mentions' | 'ablation'>('overview')

  // Ablation state
  const [ablationRegime, setAblationRegime] = useState<'deterministic' | 'stochastic'>('deterministic')
  const [ablationAuditType, setAblationAuditType] = useState('voice_check')
  const [ablationMode, setAblationMode] = useState('full')
  const [ablationReps, setAblationReps] = useState(10)
  const [ablationRunning, setAblationRunning] = useState(false)
  const [ablationProgress, setAblationProgress] = useState<string | null>(null)
  const [ablationResult, setAblationResult] = useState<any>(null)
  const [ablationError, setAblationError] = useState<string | null>(null)
  const [ablationHistory, setAblationHistory] = useState<any[]>([])
  const [ablationHistoryLoading, setAblationHistoryLoading] = useState(false)

  // Create form
  const [createForm, setCreateForm] = useState({
    brandName: '', tagline: '', mission: '', vision: '',
    positioning: '',
    voiceTone: JSON.stringify({ tone: ['authoritative', 'strategic'], personality: ['visionary', 'direct'], vocabulary: [], avoid: [] }, null, 2),
    targetAudience: '',
    competitors: '',
    contentPillars: '',
    brandValues: '',
  })
  const [saving, setSaving] = useState(false)

  // Audit
  const [auditType, setAuditType] = useState<string>('voice_check')
  const [auditInput, setAuditInput] = useState('')
  const [auditing, setAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [showConfBreakdown, setShowConfBreakdown] = useState(false)
  const [showTelemetry, setShowTelemetry] = useState(false)

  // Scheduled Posts
  const [posts, setPosts] = useState<any[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [postForm, setPostForm] = useState({ platform: 'twitter', content: '', scheduledFor: '', hashtags: '' })
  const [postSaving, setPostSaving] = useState(false)

  // Brand Mentions
  const [mentions, setMentions] = useState<any[]>([])
  const [mentionsLoading, setMentionsLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [sentimentFilter, setSentimentFilter] = useState('all')

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/brand')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setProfiles(data)
      if (data.length > 0 && !selectedProfile) {
        setSelectedProfile(data[0])
      }
    } catch {
      toast.error('Failed to load brand profiles')
    } finally {
      setLoading(false)
    }
  }, [selectedProfile])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const fetchPosts = useCallback(async () => {
    if (!selectedProfile) return
    setPostsLoading(true)
    try {
      const res = await fetch(`/api/brand/posts?brandProfileId=${selectedProfile.id}`)
      if (res.ok) setPosts(await res.json())
    } catch {} finally { setPostsLoading(false) }
  }, [selectedProfile])

  const fetchMentions = useCallback(async () => {
    if (!selectedProfile) return
    setMentionsLoading(true)
    try {
      const res = await fetch(`/api/brand/mentions?brandProfileId=${selectedProfile.id}&sentiment=${sentimentFilter}`)
      if (res.ok) setMentions(await res.json())
    } catch {} finally { setMentionsLoading(false) }
  }, [selectedProfile, sentimentFilter])

  const fetchAblationHistory = useCallback(async () => {
    if (!selectedProfile) return
    setAblationHistoryLoading(true)
    try {
      const res = await fetch(`/api/brand/ablation?brandProfileId=${selectedProfile.id}`)
      if (!res.ok) throw new Error('Failed to load history')
      const data = await res.json()
      setAblationHistory(Array.isArray(data) ? data : [])
    } catch {
      setAblationHistory([])
    } finally {
      setAblationHistoryLoading(false)
    }
  }, [selectedProfile])

  useEffect(() => { if (activeTab === 'posts') fetchPosts() }, [activeTab, fetchPosts])
  useEffect(() => { if (activeTab === 'mentions') fetchMentions() }, [activeTab, fetchMentions])
  useEffect(() => { if (activeTab === 'ablation') fetchAblationHistory() }, [activeTab, fetchAblationHistory])

  const handleCreatePost = async () => {
    if (!selectedProfile || !postForm.content || !postForm.scheduledFor) return
    setPostSaving(true)
    try {
      const res = await fetch('/api/brand/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandProfileId: selectedProfile.id, ...postForm }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Post scheduled')
      setPostForm({ platform: 'twitter', content: '', scheduledFor: '', hashtags: '' })
      setShowPostForm(false)
      fetchPosts()
    } catch { toast.error('Failed to schedule post') }
    finally { setPostSaving(false) }
  }

  const handleCancelPost = async (id: string) => {
    try {
      const res = await fetch('/api/brand/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      if (res.ok) { toast.success('Post cancelled'); fetchPosts() }
    } catch { toast.error('Failed') }
  }

  const handleScanMentions = async () => {
    if (!selectedProfile) return
    setScanning(true)
    try {
      const res = await fetch('/api/brand/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandProfileId: selectedProfile.id }),
      })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      toast.success(`Detected ${data.scanned} mentions`)
      fetchMentions()
    } catch { toast.error('Mention scan failed') }
    finally { setScanning(false) }
  }

  const handleReviewMention = async (id: string) => {
    try {
      await fetch('/api/brand/mentions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isReviewed: true }),
      })
      setMentions(prev => prev.map(m => m.id === id ? { ...m, isReviewed: true } : m))
    } catch {}
  }

  const handleCreate = async () => {
    if (!createForm.brandName.trim()) {
      toast.error('Brand name is required')
      return
    }
    setSaving(true)
    try {
      let voiceTone
      try { voiceTone = JSON.parse(createForm.voiceTone) } catch { voiceTone = { tone: [], personality: [], vocabulary: [], avoid: [] } }

      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: createForm.brandName,
          tagline: createForm.tagline || undefined,
          mission: createForm.mission || undefined,
          vision: createForm.vision || undefined,
          positioning: createForm.positioning || undefined,
          voiceTone,
          targetAudience: createForm.targetAudience ? createForm.targetAudience : undefined,
          competitors: createForm.competitors
            ? createForm.competitors.split(',').map((c: string) => c.trim()).filter(Boolean)
            : undefined,
          contentPillars: createForm.contentPillars
            ? createForm.contentPillars.split(',').map((c: string) => c.trim()).filter(Boolean)
            : undefined,
          brandValues: createForm.brandValues
            ? createForm.brandValues.split(',').map((c: string) => c.trim()).filter(Boolean)
            : undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      toast.success('Brand profile created')
      setShowCreate(false)
      setCreateForm({ brandName: '', tagline: '', mission: '', vision: '', positioning: '', voiceTone: JSON.stringify({ tone: ['authoritative', 'strategic'], personality: ['visionary', 'direct'], vocabulary: [], avoid: [] }, null, 2), targetAudience: '', competitors: '', contentPillars: '', brandValues: '' })
      await fetchProfiles()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand profile and all its audits?')) return
    try {
      const res = await fetch(`/api/brand?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Brand profile deleted')
      if (selectedProfile?.id === id) setSelectedProfile(null)
      await fetchProfiles()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleAudit = async () => {
    if (!selectedProfile) return
    if (auditType === 'voice_check' && !auditInput.trim()) {
      toast.error('Enter content to check against your brand voice')
      return
    }
    setAuditing(true)
    setAuditResult(null)
    setShowConfBreakdown(false)
    setShowTelemetry(false)
    try {
      const res = await fetch('/api/brand/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: selectedProfile.id,
          type: auditType,
          input: auditInput || undefined,
        }),
      })
      if (!res.ok) throw new Error('Audit failed')
      const data = await res.json()
      setAuditResult(data)
      fetchProfiles()
      toast.success('Audit complete')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setAuditing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight flex items-center gap-3">
            <Fingerprint className="h-7 w-7 text-primary" />
            Brand Command
          </h1>
          <p className="text-muted-foreground mt-1">
            Define, protect, and amplify your brand with strategic precision.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Brand
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader><CardTitle className="text-lg">Create Brand Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand Name *</label>
                    <Input value={createForm.brandName} onChange={(e) => setCreateForm(p => ({ ...p, brandName: e.target.value }))} placeholder="e.g. Zero Day Dynamics" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tagline</label>
                    <Input value={createForm.tagline} onChange={(e) => setCreateForm(p => ({ ...p, tagline: e.target.value }))} placeholder="e.g. Intelligence as a Service" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mission</label>
                    <Textarea value={createForm.mission} onChange={(e) => setCreateForm(p => ({ ...p, mission: e.target.value }))} placeholder="What you exist to do..." rows={2} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vision</label>
                    <Textarea value={createForm.vision} onChange={(e) => setCreateForm(p => ({ ...p, vision: e.target.value }))} placeholder="Where you're headed..." rows={2} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Positioning Statement</label>
                  <Textarea value={createForm.positioning} onChange={(e) => setCreateForm(p => ({ ...p, positioning: e.target.value }))} placeholder="For [audience], [brand] is the [category] that [differentiator] because [reason to believe]." rows={2} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Competitors (comma-separated)</label>
                    <Input value={createForm.competitors} onChange={(e) => setCreateForm(p => ({ ...p, competitors: e.target.value }))} placeholder="e.g. Competitor A, Competitor B" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content Pillars (comma-separated)</label>
                    <Input value={createForm.contentPillars} onChange={(e) => setCreateForm(p => ({ ...p, contentPillars: e.target.value }))} placeholder="e.g. Strategy, Technology, Leadership" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand Values (comma-separated)</label>
                    <Input value={createForm.brandValues} onChange={(e) => setCreateForm(p => ({ ...p, brandValues: e.target.value }))} placeholder="e.g. Precision, Integrity, Innovation" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Audience</label>
                    <Input value={createForm.targetAudience} onChange={(e) => setCreateForm(p => ({ ...p, targetAudience: e.target.value }))} placeholder="e.g. C-suite executives, High-net-worth individuals" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voice & Tone (JSON)</label>
                  <Textarea value={createForm.voiceTone} onChange={(e) => setCreateForm(p => ({ ...p, voiceTone: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Create Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {profiles.length === 0 && !showCreate ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Fingerprint className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Brand Profiles Yet</p>
            <p className="text-muted-foreground text-sm mb-4">Create your first brand profile to unlock voice checks, competitor scans, and content strategy tools.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create Brand Profile</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Profile Sidebar */}
          <div className="space-y-2">
            {profiles.map((profile) => (
              <Card
                key={profile.id}
                className={cn(
                  'cursor-pointer transition-all border',
                  selectedProfile?.id === profile.id
                    ? 'border-primary/50 bg-primary/5'
                    : 'hover:border-primary/20'
                )}
                onClick={() => { setSelectedProfile(profile); setAuditResult(null) }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{profile.brandName}</h3>
                      {profile.tagline && (
                        <p className="text-xs text-muted-foreground mt-0.5">{profile.tagline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {profile._count.audits} audits
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(profile.id) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content */}
          {selectedProfile && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 border-b pb-2">
                {[
                  { id: 'overview' as const, label: 'Overview', icon: Eye },
                  { id: 'voice' as const, label: 'Voice & Tone', icon: Mic },
                  { id: 'posts' as const, label: 'Schedule', icon: Calendar },
                  { id: 'mentions' as const, label: 'Mentions', icon: AtSign },
                  { id: 'audit' as const, label: 'Run Audit', icon: BarChart3 },
                  { id: 'ablation' as const, label: 'Ablation', icon: FlaskConical },
                  { id: 'history' as const, label: 'History', icon: FileText },
                ].map(tab => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className="text-xs"
                  >
                    <tab.icon className="h-3.5 w-3.5 mr-1" />
                    {tab.label}
                  </Button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Positioning</h3>
                      <p className="text-sm text-muted-foreground">{selectedProfile.positioning || 'Not defined yet'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Mission & Vision</h3>
                      <div className="space-y-2">
                        <p className="text-sm"><span className="text-muted-foreground">Mission:</span> {selectedProfile.mission || 'Not defined'}</p>
                        <p className="text-sm"><span className="text-muted-foreground">Vision:</span> {selectedProfile.vision || 'Not defined'}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Brand Values</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfile.brandValues ? (() => {
                          try {
                            return JSON.parse(selectedProfile.brandValues).map((v: string) => (
                              <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                            ))
                          } catch { return <span className="text-sm text-muted-foreground">Invalid data</span> }
                        })() : (
                          <span className="text-sm text-muted-foreground">Not defined</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Content Pillars</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProfile.contentPillars ? (() => {
                          try {
                            return JSON.parse(selectedProfile.contentPillars).map((p: string) => (
                              <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                            ))
                          } catch { return <span className="text-sm text-muted-foreground">Invalid data</span> }
                        })() : (
                          <span className="text-sm text-muted-foreground">Not defined</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Voice Tab */}
              {activeTab === 'voice' && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Voice & Tone Profile</h3>
                    {selectedProfile.voiceTone ? (() => {
                      try {
                        let voice = JSON.parse(selectedProfile.voiceTone)
                        // Unwrap double-serialized voiceTone (string → parse again)
                        if (typeof voice === 'string') { try { voice = JSON.parse(voice) } catch { voice = {} } }
                        if (typeof voice !== 'object' || voice === null) voice = {}
                        return (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Tone</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(voice.tone || []).map((t: string) => (
                                  <Badge key={t} className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">{t}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Personality</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(voice.personality || []).map((p: string) => (
                                  <Badge key={p} className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs">{p}</Badge>
                                ))}
                              </div>
                            </div>
                            {Array.isArray(voice.vocabulary) && voice.vocabulary.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Preferred Vocabulary</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {voice.vocabulary.map((v: string) => (
                                    <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Array.isArray(voice.avoid) && voice.avoid.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-red-400">Avoid</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {voice.avoid.map((a: string) => (
                                    <Badge key={a} className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">{a}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      } catch {
                        return <p className="text-sm text-muted-foreground">Invalid voice data</p>
                      }
                    })() : (
                      <p className="text-sm text-muted-foreground">Voice not configured</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Scheduled Posts Tab */}
              {activeTab === 'posts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Scheduled Posts</h3>
                    <Button size="sm" onClick={() => setShowPostForm(!showPostForm)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      New Post
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showPostForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Platform</label>
                                <select
                                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                  value={postForm.platform}
                                  onChange={e => setPostForm(p => ({ ...p, platform: e.target.value }))}
                                >
                                  <option value="twitter">Twitter / X</option>
                                  <option value="linkedin">LinkedIn</option>
                                  <option value="instagram">Instagram</option>
                                  <option value="facebook">Facebook</option>
                                  <option value="tiktok">TikTok</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Schedule For</label>
                                <Input
                                  type="datetime-local"
                                  value={postForm.scheduledFor}
                                  onChange={e => setPostForm(p => ({ ...p, scheduledFor: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Content</label>
                              <Textarea
                                value={postForm.content}
                                onChange={e => setPostForm(p => ({ ...p, content: e.target.value }))}
                                placeholder="Write your post content..."
                                rows={3}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Hashtags</label>
                              <Input
                                value={postForm.hashtags}
                                onChange={e => setPostForm(p => ({ ...p, hashtags: e.target.value }))}
                                placeholder="#brand #marketing #strategy"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setShowPostForm(false)}>Cancel</Button>
                              <Button size="sm" onClick={handleCreatePost} disabled={postSaving || !postForm.content || !postForm.scheduledFor}>
                                {postSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                Schedule
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {postsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : posts.length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No scheduled posts yet. Create your first post above.</CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {posts.map(post => (
                        <Card key={post.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs capitalize">{post.platform}</Badge>
                                  <Badge className={cn('text-xs',
                                    post.status === 'scheduled' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                                    post.status === 'published' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                                    post.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                                    'bg-red-500/15 text-red-400 border-red-500/30'
                                  )}>
                                    {post.status === 'scheduled' && <Clock className="h-3 w-3 mr-1" />}
                                    {post.status === 'published' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {post.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1" />}
                                    {post.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(post.scheduledFor).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                                {post.hashtags && <p className="text-xs text-primary mt-1">{post.hashtags}</p>}
                              </div>
                              {post.status === 'scheduled' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleCancelPost(post.id)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Mentions Tab */}
              {activeTab === 'mentions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Brand Mentions</h3>
                    <div className="flex gap-2">
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                        value={sentimentFilter}
                        onChange={e => setSentimentFilter(e.target.value)}
                      >
                        <option value="all">All Sentiments</option>
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                      </select>
                      <Button size="sm" onClick={handleScanMentions} disabled={scanning}>
                        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                        Scan Mentions
                      </Button>
                    </div>
                  </div>

                  {mentionsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : mentions.length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No mentions detected. Click &quot;Scan Mentions&quot; to search.</CardContent></Card>
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <div className="space-y-2">
                        {mentions.map(mention => (
                          <Card key={mention.id} className={cn(mention.isReviewed && 'opacity-60')}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <Badge variant="outline" className="text-xs capitalize">{mention.platform}</Badge>
                                    <Badge className={cn('text-xs',
                                      mention.sentiment === 'positive' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                                      mention.sentiment === 'negative' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                      'bg-muted text-muted-foreground'
                                    )}>
                                      {mention.sentiment === 'positive' && <ThumbsUp className="h-3 w-3 mr-1" />}
                                      {mention.sentiment === 'negative' && <ThumbsDown className="h-3 w-3 mr-1" />}
                                      {mention.sentiment === 'neutral' && <Minus className="h-3 w-3 mr-1" />}
                                      {mention.sentiment}
                                    </Badge>
                                    <span className="text-xs font-medium">{mention.source}</span>
                                    {mention.reach && <span className="text-xs text-muted-foreground">Reach: {mention.reach.toLocaleString()}</span>}
                                  </div>
                                  <p className="text-sm">{mention.content}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{new Date(mention.detectedAt).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {mention.sourceUrl && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(mention.sourceUrl, '_blank')}>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {!mention.isReviewed && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReviewMention(mention.id)} title="Mark reviewed">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-semibold">Run Brand Audit</h3>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'voice_check', label: 'Voice Check', icon: Mic },
                          { id: 'competitor_scan', label: 'Competitor Scan', icon: Target },
                          { id: 'content_review', label: 'Content Strategy', icon: FileText },
                          { id: 'strategic_alignment', label: 'Strategic Alignment', icon: Compass },
                        ].map(t => (
                          <Button
                            key={t.id}
                            variant={auditType === t.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setAuditType(t.id); setAuditResult(null) }}
                          >
                            <t.icon className="h-3.5 w-3.5 mr-1" />
                            {t.label}
                          </Button>
                        ))}
                      </div>
                      {auditType === 'voice_check' && (
                        <Textarea
                          placeholder="Paste the content you want to check against your brand voice..."
                          value={auditInput}
                          onChange={(e) => setAuditInput(e.target.value)}
                          rows={4}
                        />
                      )}
                      {auditType === 'competitor_scan' && (
                        <Input
                          placeholder="Optional: specific competitor name (leave empty for all)"
                          value={auditInput}
                          onChange={(e) => setAuditInput(e.target.value)}
                        />
                      )}
                      {auditType === 'strategic_alignment' && (
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-sm font-medium text-blue-400">Cross-System Intelligence</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Analyzes your emails, calendar, tasks, memories, and Cortex patterns to evaluate
                            whether your daily operations align with your stated brand identity.
                          </p>
                        </div>
                      )}
                      <Button onClick={handleAudit} disabled={auditing} className="w-full">
                        {auditing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
                        ) : (
                          <><BarChart3 className="h-4 w-4 mr-2" /> Run Audit</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Audit Result */}
                  {auditResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <Card>
                        <CardContent className="p-4 space-y-4">
                          {/* Score + Confidence Header */}
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Audit Results</h3>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setShowConfBreakdown(!showConfBreakdown)}
                                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                              >
                                <span className="text-xs text-muted-foreground">Evidence:</span>
                                <Badge variant="outline" className={cn(
                                  'text-[10px] px-1.5 py-0',
                                  (auditResult.confidence ?? 0) >= 70 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                  (auditResult.confidence ?? 0) >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-red-500/10 text-red-400 border-red-500/20'
                                )}>
                                  {(auditResult.confidence ?? 0) >= 70 ? 'Strong' :
                                   (auditResult.confidence ?? 0) >= 40 ? 'Moderate' : 'Thin'}
                                </Badge>
                                {auditResult.confidenceBreakdown && (
                                  showConfBreakdown ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Score:</span>
                                <Badge className={cn(
                                  'text-sm font-bold',
                                  auditResult.score >= 80 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                                  auditResult.score >= 50 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                  'bg-red-500/15 text-red-400 border-red-500/30'
                                )}>
                                  {auditResult.score}/100
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground">{auditResult.summary}</p>

                          {/* Confidence Breakdown (expandable) */}
                          {showConfBreakdown && auditResult.confidenceBreakdown && (
                            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Evidence Breakdown</p>
                                <span className="text-[10px] font-mono text-muted-foreground/50">composite: {Math.round(auditResult.confidenceBreakdown.composite)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { label: 'Source Coverage', value: auditResult.confidenceBreakdown.coverage, weight: '35%' },
                                  { label: 'Anchor Strength', value: auditResult.confidenceBreakdown.anchorStrength, weight: '30%' },
                                  { label: 'Data Freshness', value: auditResult.confidenceBreakdown.freshness, weight: '20%' },
                                  { label: 'Conflict Penalty', value: auditResult.confidenceBreakdown.conflictPenalty, weight: '15%', invert: true },
                                ].map((item, i) => (
                                  <div key={i} className="flex items-center justify-between p-2 rounded bg-background/50">
                                    <div className="space-y-0.5">
                                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                                      <p className="text-[10px] text-muted-foreground/60">weight: {item.weight}</p>
                                    </div>
                                    <span className={cn(
                                      'text-xs font-mono font-medium',
                                      'invert' in item
                                        ? (item.value > 15 ? 'text-red-400' : item.value > 5 ? 'text-amber-400' : 'text-green-400')
                                        : (item.value >= 70 ? 'text-green-400' : item.value >= 40 ? 'text-amber-400' : 'text-red-400')
                                    )}>
                                      {'invert' in item ? `-${Math.round(item.value)}` : Math.round(item.value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Context Sources */}
                          {auditResult.contextSources && auditResult.contextSources.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground mr-1">Sources:</span>
                              {auditResult.contextSources.map((src, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                  {src}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Telemetry (collapsible) */}
                          {auditResult.telemetry && (
                            <div>
                              <button
                                onClick={() => setShowTelemetry(!showTelemetry)}
                                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                              >
                                {showTelemetry ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                Context Telemetry
                              </button>
                              {showTelemetry && (
                                <div className="mt-1.5 p-2.5 rounded bg-muted/10 border border-border/30 grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground/70">
                                  <span>sources: {auditResult.telemetry.sourcesReturned}/{auditResult.telemetry.totalSourcesAttempted}</span>
                                  <span>truncated: {auditResult.telemetry.sourcesTruncated}</span>
                                  <span>dropped: {auditResult.telemetry.sourcesDropped}</span>
                                  <span>raw: {(auditResult.telemetry.totalCharsRaw / 1000).toFixed(1)}k chars</span>
                                  <span>budgeted: {(auditResult.telemetry.totalCharsBudgeted / 1000).toFixed(1)}k chars</span>
                                  <span>utilization: {auditResult.telemetry.budgetUtilization}%</span>
                                  <span>profile: {auditResult.telemetry.weightProfile}</span>
                                  <span>conflicts: {auditResult.telemetry.structuralConflictsDetected} structural</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Findings */}
                          <div className="space-y-2">
                            {auditResult.findings.map((f, i) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-2">
                                <div className="flex items-start gap-3">
                                  <Badge variant="outline" className={cn('text-xs shrink-0 mt-0.5', statusBadge[f.status])}>
                                    {f.status}
                                  </Badge>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium">{f.category}</p>
                                      {typeof f.confidence === 'number' && (
                                        <span className={cn(
                                          'text-[10px] px-1.5 py-0 rounded-full border',
                                          f.confidence >= 70 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                          f.confidence >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                          'bg-red-500/10 text-red-400 border-red-500/20'
                                        )}>
                                          {f.confidence}% conf
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                                    {f.recommendation && (
                                      <p className="text-xs text-primary">→ {f.recommendation}</p>
                                    )}
                                  </div>
                                </div>
                                {/* Evidence snippets */}
                                {f.evidence && f.evidence.length > 0 && (
                                  <div className="ml-[52px] space-y-1">
                                    {f.evidence.map((ev, j) => (
                                      <div key={j} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                        <span className="text-blue-400 shrink-0 mt-px">▸</span>
                                        <span className="italic">{ev}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Signal Conflicts */}
                      {auditResult.conflicts && auditResult.conflicts.length > 0 && (
                        <Card className="border-amber-500/20">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <Zap className="h-3.5 w-3.5 text-amber-400" />
                              <h4 className="text-sm font-semibold text-amber-400">Signals to Investigate</h4>
                            </div>
                            <div className="space-y-2">
                              {auditResult.conflicts.map((c, i) => (
                                <div key={i} className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-1.5">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                      {c.signalA}
                                    </Badge>
                                    <span className="text-muted-foreground">vs</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/20">
                                      {c.signalB}
                                    </Badge>
                                    {c.detectedBy && (
                                      <Badge variant="outline" className={cn(
                                        'text-[9px] px-1 py-0 ml-auto',
                                        c.detectedBy === 'structural'
                                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                          : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                      )}>
                                        {c.detectedBy === 'structural' ? '🔧 rule' : '🤖 llm'}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{c.tension}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Ablation Tab */}
              {activeTab === 'ablation' && selectedProfile && (
                <div className="space-y-4">
                  {/* Info banner */}
                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                        <div className="text-sm space-y-1">
                          <p className="font-medium text-blue-300">Context Source Ablation</p>
                          <p className="text-muted-foreground">Tests whether each context source (Gmail, Calendar, tasks, memories, etc.) actually affects your audit scores. Removes one source at a time and measures the impact.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Controls */}
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        Run Ablation
                      </h3>

                      {/* Regime selector */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Regime</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => { setAblationRegime('deterministic'); setAblationMode('full') }}
                            className={cn(
                              'p-3 rounded-lg border text-left transition-all',
                              ablationRegime === 'deterministic'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground/30'
                            )}
                          >
                            <div className="text-sm font-medium">Deterministic</div>
                            <div className="text-xs text-muted-foreground mt-1">Fast scan (~3 min). Shows which sources moved the score on test inputs.</div>
                          </button>
                          <button
                            onClick={() => { setAblationRegime('stochastic'); setAblationMode('full') }}
                            className={cn(
                              'p-3 rounded-lg border text-left transition-all',
                              ablationRegime === 'stochastic'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground/30'
                            )}
                          >
                            <div className="text-sm font-medium">Stochastic</div>
                            <div className="text-xs text-muted-foreground mt-1">Full statistical test (~30 min). Production-grade verdicts with p-values.</div>
                          </button>
                        </div>
                      </div>

                      {/* Audit type */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Audit Type</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'voice_check', label: 'Voice Check' },
                            { id: 'competitor_scan', label: 'Competitor Scan' },
                            { id: 'content_review', label: 'Content Review' },
                            { id: 'strategic_alignment', label: 'Strategic Alignment' },
                          ].map(at => (
                            <button
                              key={at.id}
                              onClick={() => setAblationAuditType(at.id)}
                              className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                                ablationAuditType === at.id
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {at.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stochastic-specific: mode and reps */}
                      {ablationRegime === 'stochastic' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Mode</label>
                            <div className="flex gap-2">
                              {[
                                { id: 'null', label: 'Noise Floor', tip: 'Establish baseline variance (run first)' },
                                { id: 'full', label: 'Full Verdict', tip: 'Ablate all sources with statistics' },
                              ].map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => setAblationMode(m.id)}
                                  title={m.tip}
                                  className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                                    ablationMode === m.id
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Reps per condition</label>
                            <Input
                              type="number"
                              min={3}
                              max={20}
                              value={ablationReps}
                              onChange={(e) => setAblationReps(Number(e.target.value))}
                              className="h-8 text-sm w-24"
                            />
                          </div>
                        </div>
                      )}

                      {/* Run button */}
                      <Button
                        onClick={async () => {
                          if (!selectedProfile) return
                          setAblationRunning(true)
                          setAblationResult(null)
                          setAblationError(null)
                          setAblationProgress(null)
                          try {
                            const payload: any = {
                              brandProfileId: selectedProfile.id,
                              auditType: ablationAuditType,
                              mode: ablationRegime === 'deterministic' ? 'full' : ablationMode,
                              regime: ablationRegime,
                            }
                            if (ablationRegime === 'stochastic') payload.reps = ablationReps
                            const res = await fetch('/api/brand/ablation', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            })
                            // Check for non-OK status with JSON error body (validation errors)
                            const contentType = res.headers.get('content-type') || ''
                            if (!res.ok && contentType.includes('application/json')) {
                              const errData = await res.json()
                              throw new Error(errData.error || errData.detail || 'Ablation failed')
                            }
                            if (!res.ok) throw new Error(`Server error: ${res.status}`)
                            // Read NDJSON stream for progress + final result
                            const reader = res.body?.getReader()
                            if (!reader) throw new Error('No response body')
                            const decoder = new TextDecoder()
                            let buffer = ''
                            let finalResult: any = null
                            while (true) {
                              const { done, value } = await reader.read()
                              if (done) break
                              buffer += decoder.decode(value, { stream: true })
                              const lines = buffer.split('\n')
                              buffer = lines.pop() || '' // keep incomplete line
                              for (const line of lines) {
                                if (!line.trim()) continue
                                try {
                                  const event = JSON.parse(line)
                                  if (event.type === 'progress') {
                                    setAblationProgress(event.message)
                                  } else if (event.type === 'result') {
                                    finalResult = event
                                  } else if (event.type === 'error') {
                                    throw new Error(event.error)
                                  }
                                } catch (parseErr: any) {
                                  if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr
                                }
                              }
                            }
                            // Process any remaining buffer
                            if (buffer.trim()) {
                              try {
                                const event = JSON.parse(buffer)
                                if (event.type === 'result') finalResult = event
                                else if (event.type === 'error') throw new Error(event.error)
                              } catch {}
                            }
                            if (!finalResult) throw new Error('No result received from ablation')
                            setAblationResult(finalResult)
                            toast.success('Ablation complete')
                            fetchAblationHistory()
                          } catch (err: any) {
                            setAblationError(err.message)
                            toast.error(err.message)
                          } finally {
                            setAblationRunning(false)
                            setAblationProgress(null)
                          }
                        }}
                        disabled={ablationRunning}
                        className="w-full"
                      >
                        {ablationRunning ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {ablationProgress || 'Starting ablation...'}</>
                        ) : (
                          <><Play className="h-4 w-4 mr-2" /> Run {ablationRegime === 'deterministic' ? 'Deterministic Scan' : ablationMode === 'null' ? 'Noise Floor' : 'Full Verdict'}</>
                        )}
                      </Button>

                      {ablationRegime === 'stochastic' && ablationMode === 'full' && (
                        <p className="text-xs text-muted-foreground">Requires a noise floor for this audit type. If you haven't run one, switch mode to "Noise Floor" first.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Error */}
                  {ablationError && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-4">
                        <p className="text-sm text-red-400">{ablationError}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Results */}
                  {ablationResult && (
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Beaker className="h-4 w-4 text-primary" />
                            Results
                          </h3>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">{ablationResult.regime}</Badge>
                            <Badge variant="outline" className="text-xs">{ablationResult.auditType?.replace('_', ' ')}</Badge>
                            <Badge variant="outline" className="text-xs">{ablationResult.mode}</Badge>
                          </div>
                        </div>

                        {/* Noise floor result */}
                        {ablationResult.mode === 'null' && ablationResult.noiseFloor && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="p-3 rounded-lg bg-muted/30 text-center">
                                <div className="text-lg font-mono font-bold">{ablationResult.noiseFloor.mean}</div>
                                <div className="text-xs text-muted-foreground">Mean</div>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/30 text-center">
                                <div className="text-lg font-mono font-bold">{ablationResult.noiseFloor.stddev}</div>
                                <div className="text-xs text-muted-foreground">σ (noise)</div>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/30 text-center">
                                <div className="text-lg font-mono font-bold">{ablationResult.noiseFloor.totalSamples || ablationResult.noiseFloor.reps}</div>
                                <div className="text-xs text-muted-foreground">Samples</div>
                              </div>
                            </div>
                            {ablationResult.interpretation && (
                              <p className="text-sm text-muted-foreground">{ablationResult.interpretation}</p>
                            )}
                          </div>
                        )}

                        {/* Verdict matrix */}
                        {ablationResult.verdictMatrix && (
                          <div className="space-y-2">
                            {/* Summary */}
                            {ablationResult.summary && (
                              <div className="p-3 rounded-lg bg-muted/20 space-y-1">
                                {ablationResult.summary.recommendation && (
                                  <p className="text-sm">{ablationResult.summary.recommendation}</p>
                                )}
                                {ablationResult.summary._important && (
                                  <p className="text-xs text-amber-400 mt-1">{ablationResult.summary._important}</p>
                                )}
                                {ablationResult.summary.degenerate && (
                                  <p className="text-xs text-red-400 mt-1">{ablationResult.summary.degenerate}</p>
                                )}
                              </div>
                            )}

                            {/* Matrix rows */}
                            <div className="space-y-1.5">
                              {ablationResult.verdictMatrix.map((entry: any, i: number) => {
                                const label = entry.panelConsensus || entry.classification || 'unknown'
                                const colorMap: Record<string, string> = {
                                  'observed-shift': 'bg-red-500/15 text-red-400 border-red-500/30',
                                  'observed-movement': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                                  'observed-no-effect': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
                                  'load-bearing': 'bg-red-500/15 text-red-400 border-red-500/30',
                                  'marginal': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                                  'inert': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
                                }
                                const delta = entry.worstCaseDelta ?? entry.absDelta ?? entry.delta ?? 0
                                return (
                                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium min-w-[140px]">{entry.source}</span>
                                      {ablationResult.regime === 'deterministic' && entry.inputCount > 1 && (
                                        <span className="text-xs text-muted-foreground">{entry.inputCount} inputs</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-mono text-muted-foreground">Δ {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta : '?'}</span>
                                      {entry.welch && !entry.welch.degenerate && (
                                        <span className="text-xs font-mono text-muted-foreground">p={entry.welch.p}</span>
                                      )}
                                      <Badge className={cn('text-xs', colorMap[label] || 'bg-muted text-muted-foreground')}>
                                        {label}
                                      </Badge>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Per-input detail (deterministic) */}
                            {ablationResult.regime === 'deterministic' && ablationResult.verdictMatrix.some((e: any) => e.perInput?.length > 1) && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Show per-input breakdown</summary>
                                <div className="mt-2 space-y-3">
                                  {ablationResult.verdictMatrix.filter((e: any) => e.perInput?.length > 0).map((entry: any, i: number) => (
                                    <div key={i} className="space-y-1">
                                      <p className="text-xs font-medium">{entry.source}</p>
                                      {entry.perInput.map((obs: any, j: number) => (
                                        <div key={j} className="flex items-center gap-3 pl-3 text-xs text-muted-foreground">
                                          <span className="truncate max-w-[200px]" title={obs.input}>"{obs.input}"</span>
                                          <span className="font-mono">{obs.baselineScore}→{obs.ablatedScore} (Δ{obs.delta > 0 ? '+' : ''}{obs.delta})</span>
                                          <Badge className={cn('text-[10px] px-1.5 py-0', {
                                            'bg-red-500/15 text-red-400': obs.label === 'observed-shift',
                                            'bg-amber-500/15 text-amber-400': obs.label === 'observed-movement',
                                            'bg-zinc-500/15 text-zinc-400': obs.label === 'observed-no-effect',
                                          })}>{obs.label}</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}

                        {/* Input panel info */}
                        {ablationResult.inputPanel && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Input panel ({ablationResult.inputPanel.length} inputs)</summary>
                            <ul className="mt-1 space-y-1 pl-3">
                              {ablationResult.inputPanel.map((inp: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground truncate">{i + 1}. "{inp}"</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Ablation History */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Past Runs</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchAblationHistory()}
                          disabled={ablationHistoryLoading}
                          className="text-xs h-7"
                        >
                          {ablationHistoryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                        </Button>
                      </div>
                      {ablationHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No ablation runs yet.</p>
                      ) : (
                        <ScrollArea className="max-h-[250px]">
                          <div className="space-y-1.5">
                            {ablationHistory.map((run: any) => (
                              <div
                                key={run.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (run.verdictMatrix) {
                                    setAblationResult({
                                      ...run,
                                      regime: run.temperature === 0 ? 'deterministic' : 'stochastic',
                                      auditType: run.auditType,
                                    })
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{run.mode}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{run.auditType?.replace('_', ' ')}</Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {run.regime || (run.temperature === 0 ? 'det' : 'stoch')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={cn('text-[10px]', {
                                    'bg-green-500/15 text-green-400': run.status === 'completed',
                                    'bg-amber-500/15 text-amber-400': run.status === 'running',
                                    'bg-red-500/15 text-red-400': run.status === 'failed',
                                  })}>{run.status}</Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(run.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold">Audit History</h3>
                    {selectedProfile.audits.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No audits yet. Run your first audit above.</p>
                    ) : (
                      <ScrollArea className="max-h-[500px]">
                        <div className="space-y-2">
                          {selectedProfile.audits.map((audit) => {
                            let parsed: AuditResult | null = null
                            try { parsed = JSON.parse(audit.result) } catch {}
                            return (
                              <div key={audit.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">{audit.type.replace('_', ' ')}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(audit.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                {audit.score !== null && (
                                  <Badge className={cn(
                                    'text-xs',
                                    audit.score >= 80 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                                    audit.score >= 50 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                    'bg-red-500/15 text-red-400 border-red-500/30'
                                  )}>
                                    {audit.score}/100
                                  </Badge>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}