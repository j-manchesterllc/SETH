'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Send,
  Plus,
  MessageSquare,
  Loader2,
  Trash2,
  User as UserIcon,
  CheckSquare,
  Globe,
  Brain,
  ListTodo,
  Search,
  Wrench,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Calendar,
  Mail,
  Bell,
  BellOff,
  Paperclip,
  X,
  FileText,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoice } from '@/hooks/use-voice'
import { useNotifications } from '@/hooks/use-notifications'
import { useGeolocation } from '@/hooks/use-geolocation'
import { SkyboxViewer } from '@/components/skybox/skybox-viewer'
import { publishEnvironmentOverride } from '@/lib/environment-store'
import { SethAvatar } from '@/components/ui/seth-avatar'

interface RoutingInfo {
  chatModel: string
  chatTier: string
  toolModel: string
  toolTier: string
}

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
  toolsUsed?: string[]
  routing?: RoutingInfo
  skyboxUrl?: string
}

interface Conversation {
  id: string
  title: string
  createdAt: string
  messages?: Message[]
  environmentUrl?: string | null
  environmentThumb?: string | null
  decisionContext?: string | null
}

interface TaskSuggestion {
  title: string
  description: string
  priority: string
  autonomyLevel: number
}

interface ToolActivity {
  tool: string
  status: 'executing' | 'done'
  args?: any
}

interface AttachedFile {
  name: string
  type: string
  size: number
  content: string // base64 or text
}

const TOOL_LABELS: Record<string, { label: string; icon: any }> = {
  web_search: { label: 'Searching the web', icon: Globe },
  create_task: { label: 'Creating task', icon: ListTodo },
  save_memory: { label: 'Saving to memory', icon: Brain },
  generate_environment: { label: 'Creating environment', icon: Globe },
  search_memories: { label: 'Searching memories', icon: Search },
  browser_automate: { label: 'Running browser automation', icon: Globe },
  check_calendar: { label: 'Checking calendar', icon: Calendar },
  triage_email: { label: 'Managing email', icon: Mail },
}

function parseTaskSuggestions(content: string): { cleanContent: string; tasks: TaskSuggestion[] } {
  const tasks: TaskSuggestion[] = []
  const cleanContent = (content ?? '').replace(
    /\[TASK_SUGGESTION\](.*?)\[\/TASK_SUGGESTION\]/gs,
    (match: string, jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr)
        tasks.push(parsed)
      } catch (e) { /* ignore */ }
      return ''
    }
  )
  return { cleanContent: cleanContent.trim(), tasks }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function ChatPageClient() {
  const { data: session } = useSession() || {}
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([])
  const [showConvList, setShowConvList] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true) // Default ON
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastResponseRef = useRef('')

  const { permission, supported: notifSupported, requestPermission, notify } = useNotifications()
  const { location, fetchLocation, permissionGranted: locationGranted } = useGeolocation()

  // Request location on mount (silently — no blocking prompt)
  useEffect(() => {
    // Silently request location after a short delay
    const timer = setTimeout(() => { fetchLocation() }, 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Use refs to break circular dependency between handleWakeWord and useVoice
  const startListeningRef = useRef<() => void>(() => {})
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  const voiceTriggeredRef = useRef(false)
  const handleVoiceTranscript = useCallback((text: string) => {
    voiceTriggeredRef.current = true
    setInput(text)
  }, [])

  const handleWakeWord = useCallback(() => {
    toast('Seth activated', { description: 'Listening for your command...' })
    notifyRef.current('Seth', { body: 'Wake word detected. Listening...' })
    startListeningRef.current()
  }, [])

  const {
    isListening,
    isWakeListening,
    transcript,
    isSpeaking,
    voiceSupported,
    serverTranscriptionSupported,
    isTranscribing,
    startListening,
    stopListening,
    startWakeWordDetection,
    stopWakeWordDetection,
    speak,
    stopSpeaking,
  } = useVoice({
    onTranscript: handleVoiceTranscript,
    onWakeWord: handleWakeWord,
    wakeWord: 'seth',
  })

  // Keep ref in sync with latest startListening
  startListeningRef.current = startListening

  // Load persisted preferences from localStorage and auto-activate
  useEffect(() => {
    try {
      // Read from unified settings first, fall back to legacy format
      const unified = localStorage.getItem('seth_settings')
      const saved = unified || localStorage.getItem('seth_prefs')
      if (saved) {
        const prefs = JSON.parse(saved)
        if (typeof prefs.autoSpeak === 'boolean') setAutoSpeak(prefs.autoSpeak)
        // wakeWord and notifications are auto-activated below regardless
      }
    } catch (e) { /* ignore */ }
    setPrefsLoaded(true)
  }, [])

  // Persist preferences whenever they change
  useEffect(() => {
    if (!prefsLoaded) return
    try {
      localStorage.setItem('seth_prefs', JSON.stringify({
        autoSpeak,
        wakeWord: isWakeListening,
      }))
    } catch (e) { /* ignore */ }
  }, [autoSpeak, isWakeListening, prefsLoaded])

  // Auto-activate wake word + notifications on mount (always-on mode)
  const autoActivatedRef = useRef(false)
  useEffect(() => {
    if (autoActivatedRef.current || !prefsLoaded || !voiceSupported) return
    autoActivatedRef.current = true

    // Small delay to let audio context initialize
    const timer = setTimeout(() => {
      if (!isWakeListening) {
        startWakeWordDetection()
      }
      // Auto-request notification permission if not yet granted
      if (notifSupported && permission !== 'granted') {
        requestPermission()
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [prefsLoaded, voiceSupported, isWakeListening, startWakeWordDetection, notifSupported, permission, requestPermission])

  // Update input with live transcript while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript)
    }
  }, [isListening, transcript])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, toolActivities, scrollToBottom])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data ?? [])
      }
    } catch (e: any) {
      console.error('Failed to fetch conversations', e)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Load messages for active conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data ?? [])
      }
    } catch (e: any) {
      console.error('Failed to load messages', e)
    }
  }, [])

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
      // Publish decision-thread environment override
      const conv = conversations.find(c => c.id === activeConvId)
      publishEnvironmentOverride(conv?.environmentUrl ?? null)
    } else {
      publishEnvironmentOverride(null)
    }
  }, [activeConvId, loadMessages, conversations])

  const startNewConversation = () => {
    setActiveConvId(null)
    setMessages([])
    setStreamingContent('')
    setToolActivities([])
    setAttachedFile(null)
    setShowConvList(false)
  }

  const deleteConversation = async (convId: string) => {
    try {
      await fetch(`/api/conversations?id=${convId}`, { method: 'DELETE' })
      if (activeConvId === convId) {
        startNewConversation()
      }
      fetchConversations()
    } catch (e: any) {
      console.error('Failed to delete conversation', e)
    }
  }

  const createTaskFromSuggestion = async (task: TaskSuggestion) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      })
      if (res.ok) {
        toast.success(`Task "${task?.title ?? 'Untitled'}" created!`)
      } else {
        toast.error('Failed to create task')
      }
    } catch (e: any) {
      toast.error('Failed to create task')
    }
  }

  // File handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB')
      return
    }

    try {
      let content: string
      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
        content = await file.text()
      } else {
        // For binary files (PDF, images, etc.), use base64
        const buffer = await file.arrayBuffer()
        content = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
      }

      setAttachedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        content: content.slice(0, 50000), // Limit content
      })
      toast.success(`File "${file.name}" attached`)
    } catch (err) {
      toast.error('Failed to read file')
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || streaming) return

    let userMessage = input.trim()

    // Append file content to message if attached
    if (attachedFile) {
      const filePrefix = `\n\n[ATTACHED FILE: ${attachedFile.name} (${attachedFile.type}, ${formatFileSize(attachedFile.size)})]\n`
      if (attachedFile.type.startsWith('text/') || attachedFile.name.match(/\.(txt|md|csv|json)$/)) {
        userMessage += `${filePrefix}Content:\n${attachedFile.content}`
      } else {
        userMessage += `${filePrefix}(Binary file attached - base64 encoded, ${formatFileSize(attachedFile.size)})`
      }
    }

    if (!userMessage) return

    setInput('')
    setAttachedFile(null)
    setStreaming(true)
    setStreamingContent('')
    setToolActivities([])

    // Optimistically add user message (show clean version)
    const displayContent = attachedFile
      ? `${input.trim()}\n\n📎 ${attachedFile.name}`
      : input.trim()

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: displayContent,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev: Message[]) => [...(prev ?? []), tempUserMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConvId,
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city,
            region: location.region,
            country: location.country,
            timezone: location.timezone,
          } : undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData?.error ?? 'Chat request failed')
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let partialRead = ''
      let collectedToolsUsed: string[] = []
      let collectedSkyboxUrl: string | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        partialRead += decoder.decode(value, { stream: true })
        const lines = partialRead.split('\n')
        partialRead = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (parsed?.type === 'meta' && parsed?.conversationId) {
                if (!activeConvId) {
                  setActiveConvId(parsed.conversationId)
                }
              } else if (parsed?.type === 'tool_use') {
                setToolActivities((prev) => [
                  ...prev,
                  { tool: parsed.tool, status: 'executing', args: parsed.args },
                ])
              } else if (parsed?.type === 'tool_result') {
                setToolActivities((prev) =>
                  prev.map((t) =>
                    t.tool === parsed.tool && t.status === 'executing'
                      ? { ...t, status: 'done' }
                      : t
                  )
                )
                // Capture skybox URL if environment was generated
                if (parsed?.skyboxUrl) {
                  collectedSkyboxUrl = parsed.skyboxUrl
                }
              } else if (parsed?.type === 'content') {
                fullContent += parsed?.content ?? ''
                setStreamingContent(fullContent)
              } else if (parsed?.type === 'done') {
                collectedToolsUsed = parsed?.toolsUsed ?? []
                const assistantMsg: Message = {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                  createdAt: new Date().toISOString(),
                  toolsUsed: collectedToolsUsed,
                  routing: parsed?.routing ?? undefined,
                  skyboxUrl: collectedSkyboxUrl,
                }
                setMessages((prev: Message[]) => [...(prev ?? []), assistantMsg])
                setStreamingContent('')
                setToolActivities([])
                fetchConversations()
                lastResponseRef.current = fullContent

                // Lazy-generate decision-thread environment after 3+ messages
                const convId = activeConvId || parsed?.conversationId
                if (convId) {
                  const conv = conversations.find(c => c.id === convId)
                  const msgCount = (messages?.length ?? 0) + 2 // user + assistant just added
                  if (msgCount >= 3 && !conv?.environmentUrl) {
                    fetch('/api/environments/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'decision',
                        conversationId: convId,
                        context: fullContent.slice(0, 200),
                      }),
                    }).catch(() => { /* background generation, non-critical */ })
                  }
                }

                // Auto-speak if enabled
                if (autoSpeak && fullContent) {
                  speak(fullContent)
                }

                // Send notification if tab is not focused
                if (document.hidden) {
                  notify('Seth', {
                    body: fullContent.slice(0, 100) + (fullContent.length > 100 ? '...' : ''),
                  })
                }
              } else if (parsed?.type === 'error') {
                toast.error(parsed?.message ?? 'Stream error')
              }
            } catch (e: any) {
              // skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error)
      toast.error('Failed to send message')
    } finally {
      setStreaming(false)
    }
  }

  // Use ref to always have latest sendMessage without stale closures
  const sendMessageRef = useRef(sendMessage)
  sendMessageRef.current = sendMessage

  // Auto-send after voice input completes — only for voice-triggered input, not manual typing
  useEffect(() => {
    if (!isListening && input.trim() && voiceTriggeredRef.current) {
      voiceTriggeredRef.current = false
      const timer = setTimeout(() => {
        sendMessageRef.current()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isListening, input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const toggleWakeWord = () => {
    if (isWakeListening) {
      stopWakeWordDetection()
      toast('Wake word detection disabled')
    } else {
      if (notifSupported && permission !== 'granted') {
        requestPermission()
      }
      startWakeWordDetection()
      toast('Wake word active — say "Seth" to activate')
    }
  }

  const handleNotificationToggle = async () => {
    if (permission === 'granted') {
      toast('Notifications are enabled. Manage in browser settings.')
    } else {
      const granted = await requestPermission()
      if (granted) {
        toast.success('Notifications enabled!')
      } else {
        toast.error('Notification permission denied')
      }
    }
  }

  const TIER_STYLES: Record<string, { label: string; color: string }> = {
    privacy: { label: 'PRIVATE', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    free: { label: 'FREE', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    paid: { label: 'PREMIUM', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  }

  const renderToolBadges = (toolsUsed?: string[], routing?: RoutingInfo) => {
    const hasTools = (toolsUsed?.length ?? 0) > 0
    const hasRouting = !!routing?.chatTier
    if (!hasTools && !hasRouting) return null

    const uniqueTools = hasTools ? [...new Set(toolsUsed)] : []
    const tierInfo = routing?.chatTier ? TIER_STYLES[routing.chatTier] ?? TIER_STYLES.privacy : null
    const shortModel = routing?.chatModel?.split('/')?.pop()?.replace(':free', '') ?? ''

    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
        {tierInfo && (
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', tierInfo.color)}>
            {tierInfo.label}
            {shortModel && <span className="font-normal opacity-70">· {shortModel}</span>}
          </span>
        )}
        {uniqueTools.map((tool, i) => {
          const info = TOOL_LABELS[tool]
          const Icon = info?.icon ?? Wrench
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full"
            >
              <Icon className="w-2.5 h-2.5" />
              {info?.label ?? tool}
            </span>
          )
        })}
      </div>
    )
  }

  const renderMessageContent = (content: string, toolsUsed?: string[], routing?: RoutingInfo, skyboxUrl?: string) => {
    const { cleanContent, tasks } = parseTaskSuggestions(content ?? '')
    return (
      <div>
        <div className="whitespace-pre-wrap break-words">{cleanContent}</div>
        {skyboxUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-primary/20">
            <SkyboxViewer imageUrl={skyboxUrl} />
          </div>
        )}
        {(tasks?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-2">
            {(tasks ?? []).map((task: TaskSuggestion, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task?.title ?? 'Task'}</p>
                  <p className="text-xs text-muted-foreground">
                    {task?.priority ?? 'medium'} priority · Level {task?.autonomyLevel ?? 3}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createTaskFromSuggestion(task)}
                  className="shrink-0"
                >
                  Create
                </Button>
              </div>
            ))}
          </div>
        )}
        {renderToolBadges(toolsUsed, routing)}
      </div>
    )
  }

  const renderToolActivities = () => {
    if (toolActivities.length === 0) return null
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3 justify-start"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Wrench className="w-4 h-4 text-primary animate-pulse" />
        </div>
        <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-card border space-y-2">
          {toolActivities.map((activity, i) => {
            const info = TOOL_LABELS[activity.tool]
            const Icon = info?.icon ?? Wrench
            const detail =
              activity.args?.query ?? activity.args?.title ?? activity.args?.type ?? activity.args?.action ?? ''
            return (
              <div key={i} className="flex items-center gap-2">
                {activity.status === 'executing' ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                <span className="text-xs">
                  <span className="font-medium">{info?.label ?? activity.tool}</span>
                  {detail && (
                    <span className="text-muted-foreground ml-1">
                      {activity.status === 'executing' ? '— ' : '— ✓ '}
                      {String(detail).slice(0, 60)}{String(detail).length > 60 ? '...' : ''}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex h-screen lg:h-screen">
      {/* Conversation sidebar - desktop */}
      <div className="hidden md:flex w-72 border-r bg-card flex-col">
        <div className="p-4 border-b">
          <Button onClick={startNewConversation} className="w-full" variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {(conversations ?? []).map((conv: Conversation) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  activeConvId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  setActiveConvId(conv.id)
                  setStreamingContent('')
                  setToolActivities([])
                }}
              >
                {conv.environmentThumb ? (
                  <div className="w-5 h-5 rounded shrink-0 overflow-hidden bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={conv.environmentThumb} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <MessageSquare className="w-4 h-4 shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{conv?.title ?? 'Untitled'}</span>
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    deleteConversation(conv.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(conversations?.length ?? 0) === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No conversations yet</p>
            )}
          </div>
        </ScrollArea>

        {/* Voice status indicator in sidebar */}
        <div className="p-3 border-t border-border/50">
          {isWakeListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-wake-pulse shrink-0" />
              <span className="text-[11px] font-medium text-primary">Wake Word Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header — simplified */}
        <div className="md:hidden border-b border-border/50 px-3 py-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowConvList(!showConvList)}>
            <MessageSquare className="w-3.5 h-3.5" />Chats
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={startNewConversation}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <div className="flex-1" />
          {isWakeListening && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-wake-pulse" />
              <span className="text-[10px] font-medium text-primary">Listening</span>
            </div>
          )}
        </div>

        {/* Mobile conversation list */}
        <AnimatePresence>
          {showConvList && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-b overflow-hidden"
            >
              <div className="p-2 max-h-48 overflow-y-auto space-y-1">
                {(conversations ?? []).map((conv: Conversation) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm',
                      activeConvId === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                    )}
                    onClick={() => {
                      setActiveConvId(conv.id)
                      setShowConvList(false)
                      setStreamingContent('')
                      setToolActivities([])
                    }}
                  >
                    {conv.environmentThumb ? (
                      <div className="w-4 h-4 rounded shrink-0 overflow-hidden bg-muted/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={conv.environmentThumb} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <MessageSquare className="w-3 h-3" />
                    )}
                    <span className="truncate">{conv?.title ?? 'Untitled'}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {(messages?.length ?? 0) === 0 && !streamingContent && toolActivities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <SethAvatar size="lg" glow />
                </div>
                <h2 className="text-xl font-display font-bold tracking-tight mb-2">
                  Hello{session?.user?.name ? `, ${session.user.name}` : ''}!
                </h2>
                <p className="text-muted-foreground max-w-md mb-4">
                  I&apos;m Seth, your strategic executive operating system. I can search the web, manage tasks,
                  remember context, and listen for your voice.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Globe className="w-3 h-3 text-primary" /> Web Search
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Mic className="w-3 h-3 text-primary" /> Voice Input
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Volume2 className="w-3 h-3 text-primary" /> Voice Output
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Paperclip className="w-3 h-3 text-primary" /> File Analysis
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Radio className="w-3 h-3 text-primary" /> Wake Word
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 border border-border/50 px-3 py-1.5 rounded-full">
                    <Bell className="w-3 h-3 text-primary" /> Notifications
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  {voiceSupported
                    ? <>Voice active — say <span className="font-semibold text-primary">&quot;Seth&quot;</span> anytime</>
                    : 'Type a message to get started'}
                </p>
              </div>
            )}

            {(messages ?? []).map((msg: Message) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex gap-3',
                  msg?.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg?.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <SethAvatar size="sm" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                    msg?.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  )}
                >
                  {msg?.role === 'assistant' ? (
                    <div>
                      {renderMessageContent(msg?.content ?? '', msg?.toolsUsed, msg?.routing, msg?.skyboxUrl)}
                      {/* Speak button for assistant messages */}
                      <button
                        onClick={() => {
                          if (isSpeaking) {
                            stopSpeaking()
                          } else {
                            speak(msg?.content ?? '')
                          }
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-primary transition-colors"
                        title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                      >
                        {isSpeaking ? (
                          <><VolumeX className="w-3.5 h-3.5" /> Stop</>
                        ) : (
                          <><Volume2 className="w-3.5 h-3.5" /> Listen</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg?.content ?? ''}</div>
                  )}
                </div>
                {msg?.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Tool activity indicators */}
            {streaming && renderToolActivities()}

            {/* Streaming content */}
            {streaming && streamingContent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <SethAvatar size="sm" />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-card border">
                  <div className="whitespace-pre-wrap break-words">{streamingContent}</div>
                </div>
              </motion.div>
            )}

            {/* Typing indicator */}
            {streaming && !streamingContent && toolActivities.length === 0 && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <SethAvatar size="sm" />
                </div>
                <div className="bg-card border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Listening indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-auto mb-2 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30"
            >
              <div className="flex gap-0.5 items-center">
                <span className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-primary rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                <span className="w-1 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1 h-6 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <span className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-xs text-primary font-medium">Listening...</span>
              <span className="text-xs text-muted-foreground">{transcript || 'Speak now'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaking indicator + File attachment preview */}
        <AnimatePresence>
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="mx-4 mb-1"
            >
              <div className="max-w-3xl mx-auto">
                <button
                  onClick={stopSpeaking}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Stop Speaking
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File attachment preview */}
        <AnimatePresence>
          {attachedFile && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="mx-4 mb-1"
            >
              <div className="max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border text-xs">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{attachedFile.name}</span>
                  <span className="text-muted-foreground">({formatFileSize(attachedFile.size)})</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Integrated input + voice controls */}
        <div className="border-t border-border/50 p-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Compact voice toggle row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Wake Word */}
              <button
                onClick={toggleWakeWord}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                  isWakeListening
                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-[var(--glow-primary)]'
                    : voiceSupported
                      ? 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                      : 'bg-muted/20 text-muted-foreground/40 cursor-not-allowed border border-transparent'
                )}
                disabled={!voiceSupported}
                title={!voiceSupported ? 'Speech recognition not supported' : isWakeListening ? 'Disable wake word' : 'Say "Seth" to activate'}
              >
                <Radio className={cn('w-3 h-3', isWakeListening && 'animate-wake-pulse')} />
                {isWakeListening ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Seth Listening
                  </span>
                ) : 'Wake Word'}
              </button>

              {/* TTS */}
              <button
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                  autoSpeak
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                )}
                title={autoSpeak ? 'Disable voice responses' : 'Enable voice responses'}
              >
                {autoSpeak ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                TTS
              </button>

              {/* Notifications */}
              {notifSupported && (
                <button
                  onClick={handleNotificationToggle}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                    permission === 'granted'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  )}
                >
                  {permission === 'granted' ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  Alerts
                </button>
              )}
            </div>

            {/* Input row */}
            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming}
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <Input
                ref={inputRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : 'Message Seth...'}
                disabled={streaming}
                className="flex-1"
              />

              <Button
                variant={isListening ? 'destructive' : isTranscribing ? 'secondary' : 'ghost'}
                size="icon"
                className={cn('shrink-0 h-9 w-9', !voiceSupported && !serverTranscriptionSupported && 'opacity-40 cursor-not-allowed')}
                onClick={() => {
                  if (!voiceSupported && !serverTranscriptionSupported) {
                    toast.error('Speech recognition not supported in this browser.')
                    return
                  }
                  if (isTranscribing) return // wait for server transcription
                  if (isListening) {
                    stopListening()
                  } else {
                    startListening()
                  }
                }}
                disabled={streaming || isTranscribing}
                title={isTranscribing ? 'Transcribing…' : !voiceSupported && !serverTranscriptionSupported ? 'Speech recognition not supported' : isListening ? 'Stop listening' : 'Voice input'}
              >
                {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                onClick={sendMessage}
                disabled={(!input.trim() && !attachedFile) || streaming}
                size="icon"
                className="h-9 w-9"
              >
                {streaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
