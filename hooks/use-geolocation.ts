'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface GeoLocation {
  latitude: number
  longitude: number
  city?: string
  region?: string
  country?: string
  timezone?: string
  accuracy?: number
  timestamp: number
}

const STORAGE_KEY = 'seth_location'
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reverse geocode coordinates to city/region
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<Partial<GeoLocation>> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`, {
        headers: { 'User-Agent': 'Seth-Assistant/1.0' },
      })
      if (!res.ok) return {}
      const data = await res.json()
      const addr = data.address ?? {}
      return {
        city: addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? undefined,
        region: addr.state ?? addr.county ?? undefined,
        country: addr.country ?? undefined,
      }
    } catch {
      return {}
    }
  }, [])

  const fetchLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 min cache
        })
      })

      const { latitude, longitude, accuracy } = position.coords
      const geo = await reverseGeocode(latitude, longitude)
      const loc: GeoLocation = {
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...geo,
      }

      setLocation(loc)
      setPermissionGranted(true)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)) } catch {}
      setLoading(false)
      return loc
    } catch (err: any) {
      const msg = err?.code === 1 ? 'Location permission denied'
        : err?.code === 2 ? 'Location unavailable'
        : err?.code === 3 ? 'Location request timed out'
        : 'Failed to get location'
      setError(msg)
      setPermissionGranted(false)
      setLoading(false)
      return null
    }
  }, [reverseGeocode])

  // Load cached location on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as GeoLocation
        // Use cached if less than 1 hour old
        if (Date.now() - parsed.timestamp < 3600000) {
          setLocation(parsed)
          setPermissionGranted(true)
        }
      }
    } catch {}
  }, [])

  // Auto-refresh location
  useEffect(() => {
    if (!permissionGranted) return
    intervalRef.current = setInterval(() => {
      fetchLocation()
    }, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [permissionGranted, fetchLocation])

  return { location, loading, error, permissionGranted, fetchLocation }
}
