'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  MODULE_ENVIRONMENTS,
  getModuleForPath,
  ENV_STORAGE_KEY,
  ENV_SETTINGS_KEY,
  DEFAULT_ENV_SETTINGS,
  type EnvSettings,
} from '@/lib/environment-config'
import {
  subscribeAmplitude,
  subscribeAlertOverlay,
  subscribeEnvironmentOverride,
  getEnvironmentOverride,
} from '@/lib/environment-store'
import { cn } from '@/lib/utils'

interface OperationalEnvironmentProps {
  /** Override the panorama URL (e.g., for decision-thread environments) */
  overrideUrl?: string | null
  className?: string
}

export function OperationalEnvironment({ overrideUrl, className }: OperationalEnvironmentProps) {
  const pathname = usePathname()
  const [settings, setSettings] = useState<EnvSettings>(DEFAULT_ENV_SETTINGS)
  const [moduleEnvs, setModuleEnvs] = useState<Record<string, string>>({})
  const [storeOverride, setStoreOverride] = useState<string | null>(getEnvironmentOverride())
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [amplitude, setAmplitude] = useState(0)
  const [ampSource, setAmpSource] = useState<'tts' | 'mic' | 'idle'>('idle')
  const [alertType, setAlertType] = useState<string | null>(null)
  const [alertIntensity, setAlertIntensity] = useState(0)
  const rotationRef = useRef(0)
  const rafRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useRef(false)

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENV_SETTINGS_KEY)
      if (saved) setSettings(JSON.parse(saved))
    } catch { /* use defaults */ }

    // Check system prefers-reduced-motion
    if (typeof window !== 'undefined') {
      prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  // Listen for settings changes
  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem(ENV_SETTINGS_KEY)
        if (saved) setSettings(JSON.parse(saved))
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Load cached module environments
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENV_STORAGE_KEY)
      if (saved) setModuleEnvs(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Determine current environment URL
  useEffect(() => {
    const effectiveOverride = overrideUrl || storeOverride
    if (effectiveOverride) {
      setCurrentUrl(effectiveOverride)
      setLoaded(false)
      return
    }
    const module = getModuleForPath(pathname)
    const url = moduleEnvs[module] || null
    setCurrentUrl(url)
    if (url) setLoaded(false)
  }, [pathname, moduleEnvs, overrideUrl, storeOverride])

  // Subscribe to amplitude changes
  useEffect(() => {
    return subscribeAmplitude((amp, source) => {
      setAmplitude(amp)
      setAmpSource(source)
    })
  }, [])

  // Subscribe to decision-thread environment override
  useEffect(() => {
    return subscribeEnvironmentOverride((url) => {
      setStoreOverride(url)
    })
  }, [])

  // Subscribe to alert overlay
  useEffect(() => {
    return subscribeAlertOverlay((alert) => {
      setAlertType(alert.type)
      setAlertIntensity(alert.intensity)
    })
  }, [])

  // Auto-scroll animation
  useEffect(() => {
    if (!settings.enabled || !currentUrl || prefersReducedMotion.current || settings.reducedMotion) return

    let lastTime = performance.now()
    let paused = false

    const onVisChange = () => {
      paused = document.visibilityState !== 'visible'
      if (!paused) lastTime = performance.now()
    }
    document.addEventListener('visibilitychange', onVisChange)

    const animate = (time: number) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      const delta = time - lastTime
      lastTime = time

      // Base speed: 0.3px/frame, increases 15% when TTS active
      const speedMultiplier = ampSource !== 'idle' ? 1.15 : 1.0
      rotationRef.current = (rotationRef.current + delta * 0.008 * speedMultiplier) % 10000

      if (containerRef.current) {
        containerRef.current.style.backgroundPosition = `${rotationRef.current}px center`
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [settings.enabled, settings.reducedMotion, currentUrl, ampSource])

  // If disabled, render a plain dark background (no panorama/animations)
  if (!settings.enabled) {
    return (
      <div
        className={cn('fixed inset-0 z-0 pointer-events-none bg-background', className)}
        aria-hidden="true"
      />
    )
  }

  const module = getModuleForPath(pathname)
  const envConfig = MODULE_ENVIRONMENTS.find(e => e.module === module)
  const fallbackBg = envConfig?.fallbackColor ?? 'radial-gradient(ellipse at 50% 50%, #0a1628 0%, #060d18 100%)'

  // Calculate pulse glow from amplitude (0-1 range, 10% max opacity delta)
  const pulseOpacity = ampSource !== 'idle' ? Math.min(0.10, amplitude * 0.15) : 0

  // Calculate overlay transparency (lighten slightly when active)
  const baseOverlayOpacity = 0.82
  const activeOverlayOpacity = ampSource !== 'idle' ? Math.max(0.72, baseOverlayOpacity - amplitude * 0.08) : baseOverlayOpacity

  // Alert overlay colors
  const alertOverlayColor = alertType === 'contradiction'
    ? `rgba(239, 68, 68, ${alertIntensity * 0.08})`  // subtle red
    : alertType === 'drift'
      ? `rgba(245, 158, 11, ${alertIntensity * 0.06})` // subtle amber
      : alertType === 'insight'
        ? `rgba(59, 130, 246, ${alertIntensity * 0.08})` // subtle blue
        : 'transparent'

  return (
    <div
      className={cn(
        'fixed inset-0 z-0 pointer-events-none',
        className
      )}
      aria-hidden="true"
    >
      {/* Panorama layer */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          backgroundImage: currentUrl ? `url(${currentUrl})` : 'none',
          background: !currentUrl ? fallbackBg : undefined,
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'repeat-x',
          willChange: currentUrl ? 'background-position' : undefined,
          transition: 'opacity 1.5s ease',
          opacity: currentUrl && !loaded ? 0 : 1,
        }}
      />

      {/* Dark overlay — ensures text contrast (WCAG AA) */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${activeOverlayOpacity})`,
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* TTS/Mic pulse glow */}
      {pulseOpacity > 0.01 && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(ellipse at 50% 80%, rgba(59, 130, 246, ${pulseOpacity}) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Cortex alert overlay */}
      {alertType && (
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            backgroundColor: alertOverlayColor,
          }}
        />
      )}

      {/* Preload image */}
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt=""
          className="hidden"
          onLoad={() => setLoaded(true)}
          onError={() => setCurrentUrl(null)}
        />
      )}
    </div>
  )
}
