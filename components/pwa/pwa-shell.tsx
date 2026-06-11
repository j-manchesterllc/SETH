'use client'

import { useEffect } from 'react'
import { InstallPrompt } from './install-prompt'

export function PwaShell() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service worker registered:', reg.scope)
          // Auto-update check
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version available')
                }
              })
            }
          })
        })
        .catch((err) => {
          console.warn('[PWA] SW registration failed:', err)
        })
    }
  }, [])

  return <InstallPrompt />
}
