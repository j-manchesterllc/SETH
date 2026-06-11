export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCalendarClient } from '@/lib/google-api'

/**
 * GET /api/calendar — List upcoming calendar events
 * Query params: days (default 7), maxResults (default 20)
 *
 * POST /api/calendar — Create a new calendar event
 * Body: { summary, description?, start, end, location? }
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const calendar = await getCalendarClient(request)
    if (!calendar) {
      return Response.json(
        { error: 'Google Calendar not connected. Please sign in with Google to enable calendar access.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') ?? '7', 10), 90)
    const maxResults = Math.min(parseInt(searchParams.get('maxResults') ?? '20', 10), 50)
    const query = searchParams.get('q') ?? undefined

    const now = new Date()
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      q: query,
    })

    const events = (res.data.items ?? []).map(e => ({
      id: e.id,
      summary: e.summary ?? '(No title)',
      description: e.description ?? null,
      location: e.location ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      htmlLink: e.htmlLink ?? null,
      status: e.status,
      attendees: (e.attendees ?? []).map(a => ({
        email: a.email,
        name: a.displayName ?? null,
        responseStatus: a.responseStatus,
      })),
      organizer: e.organizer?.email ?? null,
      isAllDay: !e.start?.dateTime,
    }))

    return Response.json({ events, count: events.length })
  } catch (error: any) {
    console.error('[Calendar] GET error:', error?.message)
    if (error?.code === 401 || error?.message?.includes('invalid_grant')) {
      return Response.json(
        { error: 'Google token expired. Please sign out and sign in with Google again.' },
        { status: 401 }
      )
    }
    return Response.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const calendar = await getCalendarClient(request)
    if (!calendar) {
      return Response.json(
        { error: 'Google Calendar not connected. Please sign in with Google.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { summary, description, start, end, location, attendees } = body ?? {}

    if (!summary || !start || !end) {
      return Response.json({ error: 'summary, start, and end are required' }, { status: 400 })
    }

    // Determine if all-day or timed event
    const isAllDay = typeof start === 'string' && start.length === 10 // YYYY-MM-DD format

    const eventBody: any = {
      summary,
      description: description ?? undefined,
      location: location ?? undefined,
      start: isAllDay ? { date: start } : { dateTime: start, timeZone: 'UTC' },
      end: isAllDay ? { date: end } : { dateTime: end, timeZone: 'UTC' },
    }

    if (attendees && Array.isArray(attendees)) {
      eventBody.attendees = attendees.map((email: string) => ({ email }))
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    })

    return Response.json({
      success: true,
      event: {
        id: res.data.id,
        summary: res.data.summary,
        start: res.data.start?.dateTime ?? res.data.start?.date,
        end: res.data.end?.dateTime ?? res.data.end?.date,
        htmlLink: res.data.htmlLink,
      },
    })
  } catch (error: any) {
    console.error('[Calendar] POST error:', error?.message)
    return Response.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}
