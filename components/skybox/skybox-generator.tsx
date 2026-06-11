'use client'

import { useState } from 'react'
import { Globe, Sparkles, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SkyboxViewer } from './skybox-viewer'
import { toast } from 'sonner'

const STYLE_OPTIONS = [
  { key: 'command-center', label: 'Sci-Fi Command Center', emoji: '🚀' },
  { key: 'above-clouds', label: 'Above the Clouds', emoji: '☁️' },
  { key: 'neo-tokyo', label: 'Neo Tokyo', emoji: '🌃' },
  { key: 'cinematic', label: 'Cinematic Realism', emoji: '🎬' },
  { key: 'photoreal', label: 'Photorealistic', emoji: '📸' },
  { key: 'digital-art', label: 'Digital Painting', emoji: '🎨' },
  { key: 'fantasy', label: 'Fantasy World', emoji: '🏰' },
  { key: 'retro-future', label: 'Retro Future', emoji: '🕹️' },
  { key: 'utopia', label: 'Utopian City', emoji: '🌇' },
  { key: 'dystopia', label: 'Dystopian World', emoji: '🏚️' },
  { key: 'concept-render', label: 'Concept Render', emoji: '💡' },
  { key: 'surreal', label: 'Surreal Dreamscape', emoji: '🌀' },
]

interface SkyboxGeneratorProps {
  onGenerated?: (url: string) => void
  compact?: boolean
}

export function SkyboxGenerator({ onGenerated, compact }: SkyboxGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('command-center')
  const [isGenerating, setIsGenerating] = useState(false)
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showStyles, setShowStyles] = useState(false)

  const selectedStyle = STYLE_OPTIONS.find(s => s.key === style)

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe the environment you want to create')
      return
    }

    setIsGenerating(true)
    setSkyboxUrl(null)

    try {
      const res = await fetch('/api/skybox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style, enhance: true }),
      })

      const data = await res.json()

      if (data?.success && data?.fileUrl) {
        // Immediate completion (rare)
        setSkyboxUrl(data.fileUrl)
        onGenerated?.(data.fileUrl)
        setIsGenerating(false)
        toast.success('Environment generated!')
        return
      }

      if (!data?.id && !data?.pending) {
        toast.error(data?.error ?? 'Generation failed')
        setIsGenerating(false)
        return
      }

      // Generation started — poll for completion
      // Blockade Labs typically takes 60-120s
      // Use numeric id for status polling (obfuscatedId won't work with /imagine/requests endpoint)
      const pollId = data.id
      toast.info('Generating your environment... this takes about 60-90 seconds.')

      let attempts = 0
      const maxAttempts = 45 // 45 × 3s = ~135s max wait
      const pollInterval = 3000

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          setIsGenerating(false)
          toast.error('Generation timed out. Please try again.')
          return
        }
        attempts++
        await new Promise(r => setTimeout(r, pollInterval))

        try {
          const pollRes = await fetch(`/api/skybox/status?id=${pollId}`)
          if (!pollRes.ok) {
            // Transient error — keep trying
            return poll()
          }
          const pollData = await pollRes.json()

          if (pollData?.status === 'complete' && pollData?.fileUrl) {
            setSkyboxUrl(pollData.fileUrl)
            onGenerated?.(pollData.fileUrl)
            setIsGenerating(false)
            toast.success('Environment generated!')
            return
          }

          if (pollData?.status === 'error') {
            setIsGenerating(false)
            toast.error('Generation failed. Try a different prompt or style.')
            return
          }

          // Still processing
          if (attempts === 10) toast.info('Still working... almost there.')
          return poll()
        } catch {
          // Network error — retry
          return poll()
        }
      }

      await poll()
    } catch (err: any) {
      toast.error('Failed to start generation')
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Generator controls */}
      <div className={cn(
        'rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4',
        compact && 'p-3'
      )}>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Environment Generator</span>
        </div>

        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your environment... e.g., 'Futuristic command center orbiting Earth with holographic displays'"
            className="w-full resize-none rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            rows={compact ? 2 : 3}
            maxLength={380}
          />

          <div className="flex items-center gap-2">
            {/* Style selector */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowStyles(!showStyles)}
                aria-haspopup="listbox"
                aria-expanded={showStyles}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm hover:bg-muted/70 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span>{selectedStyle?.emoji}</span>
                  <span className="text-muted-foreground">{selectedStyle?.label}</span>
                </span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', showStyles && 'rotate-180')} />
              </button>

              {showStyles && (
                <div className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-48 overflow-y-auto rounded-lg bg-card border border-border shadow-xl">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => { setStyle(s.key); setShowStyles(false) }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                        style === s.key && 'bg-primary/10 text-primary'
                      )}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={generate}
              disabled={isGenerating || !prompt.trim()}
              size="sm"
              className="shrink-0 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Creating...' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Viewer */}
      {(skyboxUrl || isGenerating) && (
        <SkyboxViewer
          imageUrl={skyboxUrl}
          isLoading={isGenerating}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onClose={() => { setSkyboxUrl(null); setIsExpanded(false) }}
        />
      )}
    </div>
  )
}
