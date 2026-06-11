'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Sparkles, X, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkyboxViewerProps {
  imageUrl: string | null
  isLoading?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClose?: () => void
  className?: string
}

export function SkyboxViewer({
  imageUrl,
  isLoading,
  isExpanded,
  onToggleExpand,
  onClose,
  className,
}: SkyboxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startRotation, setStartRotation] = useState(0)
  const animFrameRef = useRef<number>(0)
  const autoRotateRef = useRef(true)

  // Auto-rotate panorama
  useEffect(() => {
    if (!imageUrl || isDragging) return
    autoRotateRef.current = true
    let lastTime = performance.now()

    const animate = (time: number) => {
      if (!autoRotateRef.current) return
      const delta = time - lastTime
      lastTime = time
      setRotation((r) => (r + delta * 0.005) % 360)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [imageUrl, isDragging])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      autoRotateRef.current = false
      setStartX(e.clientX)
      setStartRotation(rotation)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [rotation]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const delta = (e.clientX - startX) * 0.3
      setRotation(startRotation + delta)
    },
    [isDragging, startX, startRotation]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    // Resume auto-rotate after 2s
    setTimeout(() => {
      autoRotateRef.current = true
    }, 2000)
  }, [])

  if (!imageUrl && !isLoading) return null

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-black/90 select-none',
        isExpanded ? 'fixed inset-0 z-50 rounded-none' : 'aspect-[21/9]',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {/* Loading state */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="text-sm text-primary/80 mt-3 font-medium">Generating Environment...</p>
            <p className="text-xs text-muted-foreground mt-1">Building your 360° world</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panoramic image — CSS scroll for 360° effect */}
      {imageUrl && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: `${rotation}px center`,
            transition: isDragging ? 'none' : undefined,
          }}
        />
      )}

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none" />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        {onToggleExpand && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="p-2 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        {onClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="p-2 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Drag hint */}
      {imageUrl && !isDragging && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
            <RotateCcw className="w-3 h-3 text-white/60" />
            <span className="text-[10px] text-white/60 font-medium">Drag to explore</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
