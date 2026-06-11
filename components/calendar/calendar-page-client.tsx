'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: string
  end: string
  htmlLink?: string
  allDay?: boolean
}

export function CalendarPageClient() {
  const { data: session } = useSession() || {}
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [daysAhead, setDaysAhead] = useState(14)

  const googleConnected = (session?.user as any)?.googleConnected
  const googleError = (session?.user as any)?.googleError

  // New event form
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('09:00')
  const [newDuration, setNewDuration] = useState('60')
  const [newDescription, setNewDescription] = useState('')
  const [newLocation, setNewLocation] = useState('')

  const fetchEvents = useCallback(async () => {
    if (!googleConnected) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?days=${daysAhead}`)
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch (err) {
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [googleConnected, daysAhead])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = async () => {
    if (!newTitle || !newDate) { toast.error('Title and date required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          date: newDate,
          time: newTime,
          duration: parseInt(newDuration),
          description: newDescription || undefined,
          location: newLocation || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to create event')
      toast.success('Event created')
      setDialogOpen(false)
      setNewTitle(''); setNewDate(''); setNewTime('09:00'); setNewDuration('60'); setNewDescription(''); setNewLocation('')
      fetchEvents()
    } catch (err) {
      toast.error('Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  const formatTime = (dateStr: string, allDay?: boolean) => {
    if (allDay) return 'All day'
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  // Group events by date
  const groupedEvents: Record<string, CalendarEvent[]> = {}
  events.forEach(evt => {
    const dateKey = new Date(evt.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = []
    groupedEvents[dateKey].push(evt)
  })

  if (!googleConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Google Calendar Not Connected</h2>
            <p className="text-muted-foreground text-sm">
              {googleError === 'RefreshFailed'
                ? 'Your Google session has expired. Please sign out and sign back in with Google to reconnect Calendar access.'
                : 'Sign in with Google (with Calendar permissions) to view and manage your calendar events.'}
            </p>
            <Button variant="outline" asChild>
              <Link href="/profile">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Calendar</h1>
          <span className="text-xs text-muted-foreground">Next {daysAhead} days · {events.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={daysAhead}
            onChange={e => setDaysAhead(parseInt(e.target.value))}
            className="text-xs border rounded px-2 py-1.5 bg-background"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> New Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Title</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Meeting with team" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input type="number" value={newDuration} onChange={e => setNewDuration(e.target.value)} min={15} step={15} />
                </div>
                <div>
                  <Label>Location (optional)</Label>
                  <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Conference room / Zoom link" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Meeting notes..." rows={3} />
                </div>
                <Button onClick={createEvent} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CalendarIcon className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">No events in the next {daysAhead} days</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
            <div key={dateLabel}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{dateLabel}</h3>
              <div className="space-y-2">
                {dayEvents.map((evt, i) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="w-16 text-center shrink-0">
                          <div className="text-xs font-medium text-primary">
                            {formatTime(evt.start, evt.allDay)}
                          </div>
                          {!evt.allDay && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatTime(evt.end)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{evt.summary}</h4>
                          {evt.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {evt.location}
                            </p>
                          )}
                          {evt.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{evt.description}</p>
                          )}
                        </div>
                        {evt.htmlLink && (
                          <a href={evt.htmlLink} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
