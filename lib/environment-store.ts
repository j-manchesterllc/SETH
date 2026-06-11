/**
 * Global amplitude store — subscribable by <OperationalEnvironment />
 * Published from use-voice.ts when TTS is active or mic is listening.
 */

type Listener = (amplitude: number, source: 'tts' | 'mic' | 'idle') => void

let currentAmplitude = 0
let currentSource: 'tts' | 'mic' | 'idle' = 'idle'
const listeners = new Set<Listener>()

export function publishAmplitude(amplitude: number, source: 'tts' | 'mic' | 'idle') {
  currentAmplitude = amplitude
  currentSource = source
  listeners.forEach(fn => fn(amplitude, source))
}

export function subscribeAmplitude(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function getAmplitude() {
  return { amplitude: currentAmplitude, source: currentSource }
}

// Cortex alert overlay store
type AlertOverlay = { type: 'contradiction' | 'drift' | 'insight' | null; intensity: number }
type AlertListener = (alert: AlertOverlay) => void

let currentAlert: AlertOverlay = { type: null, intensity: 0 }
const alertListeners = new Set<AlertListener>()

export function publishAlertOverlay(type: AlertOverlay['type'], intensity = 0.6) {
  currentAlert = { type, intensity }
  alertListeners.forEach(fn => fn(currentAlert))
  // Auto-fade after 4 seconds
  if (type) {
    setTimeout(() => {
      currentAlert = { type: null, intensity: 0 }
      alertListeners.forEach(fn => fn(currentAlert))
    }, 4000)
  }
}

export function subscribeAlertOverlay(fn: AlertListener): () => void {
  alertListeners.add(fn)
  return () => { alertListeners.delete(fn) }
}

// Decision-thread environment override store
type OverrideListener = (url: string | null) => void
let currentOverrideUrl: string | null = null
const overrideListeners = new Set<OverrideListener>()

export function publishEnvironmentOverride(url: string | null) {
  currentOverrideUrl = url
  overrideListeners.forEach(fn => fn(url))
}

export function subscribeEnvironmentOverride(fn: OverrideListener): () => void {
  overrideListeners.add(fn)
  return () => { overrideListeners.delete(fn) }
}

export function getEnvironmentOverride() {
  return currentOverrideUrl
}
