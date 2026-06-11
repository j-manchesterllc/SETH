'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { publishAmplitude } from '@/lib/environment-store'

interface UseVoiceOptions {
  onTranscript?: (text: string) => void
  onWakeWord?: () => void
  wakeWord?: string
  continuous?: boolean
}

export function useVoice(options: UseVoiceOptions = {}) {
  const {
    onTranscript,
    onWakeWord,
    wakeWord = 'seth',
    continuous = false,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isWakeListening, setIsWakeListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  // Server-side transcription fallback (iOS PWA where Web Speech API unavailable)
  const [serverTranscriptionSupported, setServerTranscriptionSupported] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const recognitionRef = useRef<any>(null)
  const wakeRecognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // MediaRecorder fallback refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // Use refs to avoid stale closures in recognition callbacks
  const isWakeListeningRef = useRef(false)
  // Track if wake was paused for command capture — needs to resume after
  const wakePausedForCommandRef = useRef(false)
  // Track if TTS is playing — wake word must NOT resume while speaking
  const isSpeakingRef = useRef(false)
  // AudioContext for amplitude analysis (environment pulse)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ampRafRef = useRef<number>(0)
  // Heartbeat timer to proactively restart recognition before Android kills it
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSpeechEventRef = useRef<number>(Date.now())
  const onWakeWordRef = useRef(onWakeWord)
  onWakeWordRef.current = onWakeWord
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  // Check for browser support (Web Speech API + MediaRecorder fallback)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setVoiceSupported(!!SpeechRecognition)
    // If no SpeechRecognition but MediaRecorder exists (iOS PWA), enable server fallback
    if (!SpeechRecognition && typeof MediaRecorder !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia) {
      setServerTranscriptionSupported(true)
    }
  }, [])

  // Create recognition instance
  const createRecognition = useCallback((isWake: boolean = false) => {
    if (typeof window === 'undefined') return null
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = isWake ? true : continuous
    recognition.interimResults = !isWake
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    return recognition
  }, [continuous])

  // Track if wake detection was intentionally paused (TTS, command capture, etc.)
  // This prevents the onend handler from auto-restarting recognition
  const wakePausedIntentionallyRef = useRef(false)

  // Pause wake detection (stop the recognition but keep the "enabled" flag)
  const pauseWakeDetection = useCallback(() => {
    wakePausedIntentionallyRef.current = true
    if (wakeRecognitionRef.current) {
      try { wakeRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      wakeRecognitionRef.current = null
    }
  }, [])

  // Helper: can we safely start/restart wake recognition right now?
  const canStartWake = useCallback(() => {
    return isWakeListeningRef.current &&
      !wakePausedForCommandRef.current &&
      !wakePausedIntentionallyRef.current &&
      !isSpeakingRef.current
  }, [])

  // Helper to create and start a fresh wake word recognition session
  const startWakeSession = useCallback(() => {
    if (!voiceSupported || !isWakeListeningRef.current) return
    // CRITICAL: Never start mic while TTS is playing or wake is intentionally paused
    if (isSpeakingRef.current || wakePausedIntentionallyRef.current) return

    // Clear the intentional-pause flag since we're now deliberately starting
    wakePausedIntentionallyRef.current = false

    // Always create a fresh instance — many browsers don't support restarting a stopped recognition
    const recognition = createRecognition(true)
    if (!recognition) return

    wakeRecognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      lastSpeechEventRef.current = Date.now() // heartbeat: recognition is alive
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.toLowerCase().trim()
          if (text.includes(wakeWord.toLowerCase())) {
            // PAUSE wake detection before invoking callback — browser can only run one recognition
            pauseWakeDetection()
            wakePausedForCommandRef.current = true
            onWakeWordRef.current?.()
          }
        }
      }
    }

    recognition.onaudiostart = () => {
      lastSpeechEventRef.current = Date.now() // heartbeat: recognition is alive
    }

    recognition.onsoundstart = () => {
      lastSpeechEventRef.current = Date.now()
    }

    recognition.onend = () => {
      // CRITICAL: Only auto-restart if NOT paused intentionally (TTS, command capture, etc.)
      // This is the key guard that prevents mic from stealing audio focus during playback
      if (canStartWake()) {
        setTimeout(() => {
          if (canStartWake()) startWakeSession()
        }, 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isWakeListeningRef.current = false
        setIsWakeListening(false)
        return
      }
      // For transient errors (network, audio-capture), retry with backoff — but NOT during TTS
      if (canStartWake()) {
        setTimeout(() => {
          if (canStartWake()) startWakeSession()
        }, event.error === 'no-speech' ? 300 : 2000)
      }
    }

    try {
      recognition.start()
      lastSpeechEventRef.current = Date.now() // mark start time
    } catch (e) {
      // If start fails, retry after delay — but NOT during TTS
      if (canStartWake()) {
        setTimeout(() => {
          if (canStartWake()) startWakeSession()
        }, 1000)
      }
    }
  }, [voiceSupported, createRecognition, wakeWord, pauseWakeDetection, canStartWake])

  // Resume wake detection after command capture is complete
  // CRITICAL: Do NOT resume if TTS is playing — mic will steal audio focus on Android
  const resumeWakeDetection = useCallback(() => {
    wakePausedForCommandRef.current = false
    wakePausedIntentionallyRef.current = false
    if (isWakeListeningRef.current && !isSpeakingRef.current) {
      // Brief delay to ensure previous recognition is fully cleaned up
      setTimeout(() => {
        // Double-check speaking state after the timeout
        if (!isSpeakingRef.current && isWakeListeningRef.current) {
          startWakeSession()
        }
      }, 500)
    }
  }, [startWakeSession])

  // --- Server-side transcription fallback (MediaRecorder → /api/transcribe) ---
  const startServerRecording = useCallback(async () => {
    if (isListening) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioChunksRef.current = []

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Clean up stream
        stream.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        audioChunksRef.current = []

        if (blob.size < 100) {
          setIsListening(false)
          setIsTranscribing(false)
          return
        }

        // Send to server for transcription
        setIsTranscribing(true)
        try {
          const formData = new FormData()
          const ext = (recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
          formData.append('audio', blob, `recording.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            const text = (data.text || '').trim()
            if (text) {
              setTranscript(text)
              onTranscriptRef.current?.(text)
            }
          } else {
            console.error('[ServerTranscribe] API error:', res.status)
          }
        } catch (err) {
          console.error('[ServerTranscribe] Failed:', err)
        } finally {
          setIsTranscribing(false)
          setIsListening(false)
        }
      }

      recorder.start(250) // collect chunks every 250ms
      setIsListening(true)
      setTranscript('')
    } catch (err) {
      console.error('[ServerTranscribe] Mic access failed:', err)
    }
  }, [isListening])

  const stopServerRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [])

  // Start active listening (for message input)
  const startListening = useCallback(() => {
    if (isListening) return

    // If Web Speech API not available, try server-side fallback
    if (!voiceSupported) {
      if (serverTranscriptionSupported) {
        startServerRecording()
      }
      return
    }

    // Ensure wake recognition is stopped first — browsers only support one at a time
    pauseWakeDetection()

    const recognition = createRecognition(false)
    if (!recognition) return

    recognitionRef.current = recognition
    let finalTranscript = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t + ' '
        } else {
          interim = t
        }
      }
      const full = (finalTranscript + interim).trim()
      setTranscript(full)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      const result = finalTranscript.trim()
      if (result && onTranscriptRef.current) {
        onTranscriptRef.current(result)
      }
      // Resume wake word detection if it was active
      if (isWakeListeningRef.current) {
        resumeWakeDetection()
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error)
      }
      setIsListening(false)
      recognitionRef.current = null
      // Resume wake word detection if it was active
      if (isWakeListeningRef.current) {
        resumeWakeDetection()
      }
    }

    try {
      recognition.start()
      setIsListening(true)
      setTranscript('')
    } catch (e) {
      console.error('Failed to start command recognition:', e)
      // Resume wake detection if start failed
      if (isWakeListeningRef.current) {
        resumeWakeDetection()
      }
    }
  }, [voiceSupported, isListening, serverTranscriptionSupported, startServerRecording, createRecognition, continuous, pauseWakeDetection, resumeWakeDetection])

  // Stop active listening
  const stopListening = useCallback(() => {
    // Stop server-side recording if active
    if (mediaRecorderRef.current) {
      stopServerRecording()
      return // onstop handler will set isListening=false and process audio
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    // Resume wake detection if it was active
    if (isWakeListeningRef.current) {
      resumeWakeDetection()
    }
  }, [resumeWakeDetection, stopServerRecording])

  // Start wake word detection
  const startWakeWordDetection = useCallback(() => {
    if (!voiceSupported || isWakeListeningRef.current) return

    isWakeListeningRef.current = true
    wakePausedForCommandRef.current = false
    wakePausedIntentionallyRef.current = false
    setIsWakeListening(true)
    lastSpeechEventRef.current = Date.now()
    startWakeSession()

    // Heartbeat: proactively restart recognition before Android Chrome kills it (~60s timeout)
    // Check every 20s — if no speech events for 25s, force restart
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      if (!isWakeListeningRef.current || wakePausedForCommandRef.current || isSpeakingRef.current) return
      const elapsed = Date.now() - lastSpeechEventRef.current
      if (elapsed > 25_000) {
        console.log('[Voice Heartbeat] Proactive restart — no events for', Math.round(elapsed / 1000), 's')
        // Kill current instance and start fresh
        if (wakeRecognitionRef.current) {
          try { if (wakeRecognitionRef.current.abort) wakeRecognitionRef.current.abort(); else wakeRecognitionRef.current.stop() } catch { /* ignore */ }
          wakeRecognitionRef.current = null
        }
        lastSpeechEventRef.current = Date.now()
        startWakeSession()
      }
    }, 20_000)
  }, [voiceSupported, startWakeSession])

  // Stop wake word detection
  const stopWakeWordDetection = useCallback(() => {
    isWakeListeningRef.current = false
    wakePausedForCommandRef.current = false
    setIsWakeListening(false)
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (wakeRecognitionRef.current) {
      try {
        wakeRecognitionRef.current.stop()
      } catch (e) {
        // ignore
      }
      wakeRecognitionRef.current = null
    }
  }, [])

  // Helper: called when TTS finishes (ended, error, or manual stop)
  const onSpeechFinished = useCallback(() => {
    isSpeakingRef.current = false
    wakePausedIntentionallyRef.current = false // TTS done, clear the pause flag
    setIsSpeaking(false)
    // Now that audio is done, safe to resume wake detection
    if (isWakeListeningRef.current) {
      setTimeout(() => {
        if (!isSpeakingRef.current && isWakeListeningRef.current) {
          startWakeSession()
        }
      }, 400)
    }
  }, [startWakeSession])

  // Text-to-speech using ElevenLabs
  const speak = useCallback(async (text: string) => {
    if (!text || isSpeakingRef.current) return

    // Clean text for speech (remove markdown, etc.)
    const cleanText = text
      .replace(/\[TASK_SUGGESTION\].*?\[\/TASK_SUGGESTION\]/gs, '')
      .replace(/[*_~`#>\-|]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    if (!cleanText) return

    // CRITICAL: Pause wake detection BEFORE playing audio — mic steals audio focus on Android
    isSpeakingRef.current = true
    setIsSpeaking(true)
    pauseWakeDetection()

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok) {
        throw new Error('TTS failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }

      const audio = new Audio(url)
      audioRef.current = audio

      // Wire AudioContext analyser for environment pulse
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') await ctx.resume()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analyser.connect(ctx.destination)
        analyserRef.current = analyser

        // Start amplitude publishing loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const publishLoop = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length / 255
          publishAmplitude(Math.min(1, avg * 2.5), 'tts')
          ampRafRef.current = requestAnimationFrame(publishLoop)
        }
        ampRafRef.current = requestAnimationFrame(publishLoop)
      } catch { /* AudioContext not available — skip amplitude */ }

      audio.onended = () => {
        cancelAnimationFrame(ampRafRef.current)
        analyserRef.current = null
        publishAmplitude(0, 'idle')
        URL.revokeObjectURL(url)
        audioRef.current = null
        onSpeechFinished()
      }

      audio.onerror = () => {
        cancelAnimationFrame(ampRafRef.current)
        analyserRef.current = null
        publishAmplitude(0, 'idle')
        URL.revokeObjectURL(url)
        audioRef.current = null
        onSpeechFinished()
      }

      await audio.play()
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('TTS error:', error)
      }
      onSpeechFinished()
    }
  }, [pauseWakeDetection, onSpeechFinished])

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    cancelAnimationFrame(ampRafRef.current)
    analyserRef.current = null
    publishAmplitude(0, 'idle')
    onSpeechFinished()
  }, [onSpeechFinished])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isWakeListeningRef.current = false
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
      }
      if (wakeRecognitionRef.current) {
        try { wakeRecognitionRef.current.stop() } catch (e) { /* ignore */ }
      }
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    // State
    isListening,
    isWakeListening,
    transcript,
    isSpeaking,
    voiceSupported,
    // Server-side transcription fallback (iOS PWA)
    serverTranscriptionSupported,
    isTranscribing,
    // Active listening
    startListening,
    stopListening,
    // Wake word
    startWakeWordDetection,
    stopWakeWordDetection,
    // TTS
    speak,
    stopSpeaking,
  }
}
