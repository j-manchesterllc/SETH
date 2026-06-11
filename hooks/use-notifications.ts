'use client'

import { useState, useEffect, useCallback } from 'react'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!supported) return false
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (e) {
      console.error('Notification permission error:', e)
      return false
    }
  }, [supported])

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!supported || permission !== 'granted') return null
      try {
        const notification = new Notification(title, {
          icon: '/seth-icon-192.png',
          badge: '/seth-icon-192.png',
          ...options,
        })

        notification.onclick = () => {
          window.focus()
          notification.close()
        }

        // Auto-close after 8 seconds
        setTimeout(() => notification.close(), 8000)
        return notification
      } catch (e) {
        console.error('Notification error:', e)
        return null
      }
    },
    [supported, permission]
  )

  return { permission, supported, requestPermission, notify }
}
