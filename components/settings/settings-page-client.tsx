'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Settings,
  Volume2,
  VolumeX,
  Radio,
  Bell,
  BellOff,
  Zap,
  Shield,
  Clock,
  Save,
  RotateCcw,
  Mic,
  Brain,
  Eye,
  Gauge,
  Globe,
  Sparkles,
  Glasses,
  Key,
  Copy,
  Trash2,
  Loader2,
} from 'lucide-react'

interface SethPrefs {
  autoSpeak: boolean
  wakeWordEnabled: boolean
  wakeWord: string
  notificationsEnabled: boolean
  defaultAutonomy: number // 1-4
  watchCheckInterval: number // minutes
  autoExecInterval: number // minutes
  deadlineCheckInterval: number // minutes
  proactiveAgents: boolean
  agentMonitorInterval: number // minutes
  environmentsEnabled: boolean
  environmentReducedMotion: boolean
}

const DEFAULT_PREFS: SethPrefs = {
  autoSpeak: true,
  wakeWordEnabled: true,
  wakeWord: 'seth',
  notificationsEnabled: true,
  defaultAutonomy: 3,
  watchCheckInterval: 30,
  autoExecInterval: 10,
  deadlineCheckInterval: 5,
  proactiveAgents: true,
  agentMonitorInterval: 60,
  environmentsEnabled: true,
  environmentReducedMotion: false,
}

const autonomyLevels = [
  { level: 1, label: 'Full Auto', description: 'Execute immediately without asking', icon: Zap, color: 'text-red-400' },
  { level: 2, label: 'Execute & Notify', description: 'Do it, then tell me what you did', icon: Bell, color: 'text-amber-400' },
  { level: 3, label: 'Propose & Wait', description: 'Suggest a plan and wait for approval', icon: Eye, color: 'text-blue-400' },
  { level: 4, label: 'Present Options', description: 'Show me alternatives, I decide everything', icon: Shield, color: 'text-green-400' },
]

function WearableAccessCard() {
  const [loading, setLoading] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [keyPreview, setKeyPreview] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile/api-key')
      .then(r => r.json())
      .then(data => {
        setHasKey(data.hasKey)
        setKeyPreview(data.keyPreview)
      })
      .catch(() => {})
  }, [])

  const generateKey = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile/api-key', { method: 'POST' })
      const data = await res.json()
      if (data.apiKey) {
        setNewKey(data.apiKey)
        setHasKey(true)
        setKeyPreview(`${data.apiKey.slice(0, 9)}…${data.apiKey.slice(-4)}`)
        toast.success('API key generated — copy it now')
      }
    } catch {
      toast.error('Failed to generate key')
    } finally {
      setLoading(false)
    }
  }

  const revokeKey = async () => {
    setLoading(true)
    try {
      await fetch('/api/profile/api-key', { method: 'DELETE' })
      setHasKey(false)
      setKeyPreview(null)
      setNewKey(null)
      toast.success('API key revoked')
    } catch {
      toast.error('Failed to revoke key')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      toast.success('Copied to clipboard')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Glasses className="h-5 w-5 text-primary" /> Wearable Device Access
        </CardTitle>
        <CardDescription>
          Generate an API key for companion devices — smart glasses, ambient interfaces, or headless runtimes that operate outside browser sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Key className="h-4 w-4 text-primary shrink-0" />
              <code className="text-xs font-mono text-foreground/90 break-all flex-1">{newKey}</code>
              <Button variant="ghost" size="sm" onClick={copyKey}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Store this key securely. It will not be shown again in full.
            </p>
            <p className="text-xs text-muted-foreground">
              Use this key as the <code className="text-foreground/70">x-api-key</code> header when connecting from your companion device to <code className="text-foreground/70">/api/chat</code>, <code className="text-foreground/70">/api/tts</code>, or <code className="text-foreground/70">/api/transcribe</code>.
            </p>
          </div>
        ) : hasKey ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium">Active Key</span>
                <code className="text-xs font-mono text-muted-foreground">{keyPreview}</code>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generateKey} disabled={loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Regenerate'}
                </Button>
                <Button variant="ghost" size="sm" onClick={revokeKey} disabled={loading} className="text-red-400 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A companion device is currently authorized. Regenerating will invalidate the existing key.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No companion device connected. Generate an API key to enable the wearable voice pipeline.
            </p>
            <Button onClick={generateKey} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Generate API Key
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SettingsPageClient() {
  const { data: session } = useSession() || {}
  const [prefs, setPrefs] = useState<SethPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [notifPermission, setNotifPermission] = useState<string>('default')

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('seth_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setPrefs(prev => ({ ...prev, ...parsed }))
      } else {
        // Migrate from old seth_prefs format
        const oldPrefs = localStorage.getItem('seth_prefs')
        if (oldPrefs) {
          const old = JSON.parse(oldPrefs)
          setPrefs(prev => ({
            ...prev,
            autoSpeak: old.autoSpeak ?? prev.autoSpeak,
            wakeWordEnabled: old.wakeWord ?? prev.wakeWordEnabled,
          }))
        }
      }
    } catch { /* ignore */ }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
    setLoaded(true)
  }, [])

  const updatePref = <K extends keyof SethPrefs>(key: K, value: SethPrefs[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const savePrefs = () => {
    try {
      localStorage.setItem('seth_settings', JSON.stringify(prefs))
      // Also update old format for backward compatibility with chat page
      localStorage.setItem('seth_prefs', JSON.stringify({
        autoSpeak: prefs.autoSpeak,
        wakeWord: prefs.wakeWordEnabled,
      }))
      setHasChanges(false)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  const resetPrefs = () => {
    setPrefs(DEFAULT_PREFS)
    setHasChanges(true)
  }

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
      if (result === 'granted') {
        toast.success('Notifications enabled')
        updatePref('notificationsEnabled', true)
      }
    }
  }

  if (!loaded) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
            Seth Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Unified control panel for voice, autonomy, and intelligence behavior.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetPrefs}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={savePrefs} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Voice & Audio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" /> Voice & Audio
          </CardTitle>
          <CardDescription>Control how Seth listens and speaks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-2">
                {prefs.autoSpeak ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                Auto Voice Responses
              </label>
              <p className="text-xs text-muted-foreground">Seth speaks all responses aloud via ElevenLabs TTS</p>
            </div>
            <Switch checked={prefs.autoSpeak} onCheckedChange={(v) => updatePref('autoSpeak', v)} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Radio className={cn('h-4 w-4', prefs.wakeWordEnabled ? 'text-primary animate-pulse' : 'text-muted-foreground')} />
                Wake Word Detection
              </label>
              <p className="text-xs text-muted-foreground">
                Say "{prefs.wakeWord.toUpperCase()}" to activate voice input. Heartbeat keeps it alive on Android.
              </p>
            </div>
            <Switch checked={prefs.wakeWordEnabled} onCheckedChange={(v) => updatePref('wakeWordEnabled', v)} />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-28 shrink-0">Wake Word</label>
            <Input
              value={prefs.wakeWord}
              onChange={(e) => updatePref('wakeWord', e.target.value.toLowerCase())}
              className="max-w-[200px]"
              placeholder="seth"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </CardTitle>
          <CardDescription>Browser push notifications for alerts, approvals, and watch triggers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-2">
                {prefs.notificationsEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                Push Notifications
              </label>
              <p className="text-xs text-muted-foreground">Receive alerts for overdue tasks, watch triggers, and auto-executed actions</p>
            </div>
            <div className="flex items-center gap-2">
              {notifPermission !== 'granted' && (
                <Button variant="outline" size="sm" onClick={requestNotifications}>
                  Enable
                </Button>
              )}
              <Switch
                checked={prefs.notificationsEnabled && notifPermission === 'granted'}
                onCheckedChange={(v) => updatePref('notificationsEnabled', v)}
                disabled={notifPermission !== 'granted'}
              />
            </div>
          </div>
          {notifPermission === 'denied' && (
            <p className="text-xs text-red-400">Notifications are blocked by your browser. Please enable them in browser settings.</p>
          )}
        </CardContent>
      </Card>

      {/* Autonomy Level */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> Default Autonomy Level
          </CardTitle>
          <CardDescription>How much freedom Seth has when creating new tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {autonomyLevels.map(({ level, label, description, icon: Icon, color }) => (
              <button
                key={level}
                onClick={() => updatePref('defaultAutonomy', level)}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg border transition-all text-left',
                  prefs.defaultAutonomy === level
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-transparent hover:border-border hover:bg-muted/30'
                )}
              >
                <div className={cn('p-2 rounded-lg bg-muted/50', prefs.defaultAutonomy === level && 'bg-primary/10')}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Level {level}: {label}</span>
                    {prefs.defaultAutonomy === level && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proactive Intelligence Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Intelligence Intervals
          </CardTitle>
          <CardDescription>How often Seth checks watches, executes tasks, and monitors deadlines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Deadline Checks</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={prefs.deadlineCheckInterval}
                  onChange={(e) => updatePref('deadlineCheckInterval', Math.max(1, parseInt(e.target.value) || 5))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Watch Checks</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={prefs.watchCheckInterval}
                  onChange={(e) => updatePref('watchCheckInterval', Math.max(5, parseInt(e.target.value) || 30))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Auto-Execute</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={prefs.autoExecInterval}
                  onChange={(e) => updatePref('autoExecInterval', Math.max(5, parseInt(e.target.value) || 10))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Autonomy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> Autonomous Agent Monitoring
          </CardTitle>
          <CardDescription>Allow agents to proactively scan for threats, opportunities, and trends without being asked.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Enable Proactive Agents</label>
              <p className="text-xs text-muted-foreground">
                Agents like SENTINEL and VANGUARD will independently monitor their domains and surface alerts.
              </p>
            </div>
            <Switch checked={prefs.proactiveAgents} onCheckedChange={(v) => updatePref('proactiveAgents', v)} />
          </div>
          {prefs.proactiveAgents && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40 shrink-0">Monitor Interval</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={15}
                  max={240}
                  value={prefs.agentMonitorInterval}
                  onChange={(e) => updatePref('agentMonitorInterval', Math.max(15, parseInt(e.target.value) || 60))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wearable Device Access */}
      <WearableAccessCard />

      {/* Operational Environments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Operational Environments
          </CardTitle>
          <CardDescription>Immersive spatial backdrops that anchor each module and decision thread in a distinct cognitive space.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className={cn('h-4 w-4', prefs.environmentsEnabled ? 'text-primary' : 'text-muted-foreground')} />
                Enable Environments
              </label>
              <p className="text-xs text-muted-foreground">Show panoramic backdrops behind each module. Disable to use a plain dark background.</p>
            </div>
            <Switch
              checked={prefs.environmentsEnabled ?? true}
              onCheckedChange={(v) => {
                updatePref('environmentsEnabled', v)
                // Also persist to the environment-specific localStorage key
                try {
                  const envSettings = JSON.parse(localStorage.getItem('seth_env_settings') || '{}')
                  envSettings.enabled = v
                  localStorage.setItem('seth_env_settings', JSON.stringify(envSettings))
                  window.dispatchEvent(new StorageEvent('storage', { key: 'seth_env_settings' }))
                } catch { /* ignore */ }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Eye className={cn('h-4 w-4', prefs.environmentReducedMotion ? 'text-muted-foreground' : 'text-primary')} />
                Reduced Motion
              </label>
              <p className="text-xs text-muted-foreground">Pause panoramic scrolling and TTS pulse animations. Respects system preference automatically.</p>
            </div>
            <Switch
              checked={prefs.environmentReducedMotion ?? false}
              onCheckedChange={(v) => {
                updatePref('environmentReducedMotion', v)
                try {
                  const envSettings = JSON.parse(localStorage.getItem('seth_env_settings') || '{}')
                  envSettings.reducedMotion = v
                  localStorage.setItem('seth_env_settings', JSON.stringify(envSettings))
                  window.dispatchEvent(new StorageEvent('storage', { key: 'seth_env_settings' }))
                } catch { /* ignore */ }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save reminder */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={savePrefs} size="lg" className="shadow-lg shadow-primary/20">
            <Save className="h-4 w-4 mr-2" /> Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}
