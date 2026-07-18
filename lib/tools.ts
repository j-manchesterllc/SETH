import { prisma } from '@/lib/prisma'
import { google } from 'googleapis'
import { dispatchToAgent } from '@/lib/agents'
import { runVoiceCheck, runCompetitorScan, generateContentStrategy } from '@/lib/brand-manager'

export const TOOL_MODEL = 'qwen3-235b-a22b-instruct-2507'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export const SETH_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, news, prices, facts, or any real-time data. Use this whenever the user asks about current events, market data, prices, recent news, or anything that requires up-to-date information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to find information about' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task for the user. Use this when the user asks you to create, add, or schedule a task, reminder, or action item.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description with details' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Task priority level' },
          autonomyLevel: { type: 'integer', description: 'Autonomy level (1-4): 1=auto-execute, 2=execute+notify, 3=needs approval, 4=present options' },
          dueDate: { type: 'string', description: 'Due date in ISO format (YYYY-MM-DD)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Save an important piece of information to long-term memory. Use this when the user shares important preferences, decisions, facts about themselves, key contacts, or strategic information that should be remembered across conversations.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The information to remember' },
          type: { type: 'string', enum: ['context', 'decision', 'preference', 'note'], description: 'Type of memory' },
          importance: { type: 'integer', description: 'Importance score from 1-10' },
          tags: { type: 'string', description: 'Comma-separated tags for categorization' },
        },
        required: ['content', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memories',
      description: 'Search through stored memories for specific information. Use this when you need to recall a past decision, preference, or piece of context about the user.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to find relevant memories' },
          type: { type: 'string', enum: ['context', 'decision', 'preference', 'note'], description: 'Optional: filter by memory type' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_environment',
      description: 'Generate an immersive 360° panoramic environment/skybox. Use this when the user asks to create a visual environment, set an ambient background, or requests an immersive scene. Great for visualization, mood setting, concept environments, or creative exploration.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Description of the environment to generate (max 380 chars). Be vivid and specific.' },
          style: {
            type: 'string',
            enum: ['command-center', 'above-clouds', 'neo-tokyo', 'cinematic', 'photoreal', 'digital-art', 'fantasy', 'retro-future', 'utopia', 'dystopia', 'concept-render', 'surreal'],
            description: 'Visual style for the environment',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_automate',
      description: 'Automate browser tasks on any website using a remote headless browser. Use this when the user asks to fill forms, scrape data, check a website, book something, submit an application, extract information from a webpage, take screenshots, or perform any multi-step browser interaction. Supports navigation, clicking, typing, form submission, data extraction, and screenshots.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Detailed description of the browser automation task. Be specific about what to click, fill, extract, or navigate. Include field names, values, and the sequence of steps.',
          },
          url: {
            type: 'string',
            description: 'The target URL to navigate to. Required for most tasks.',
          },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_calendar',
      description: 'Check Google Calendar for upcoming events, search for specific meetings, or create new events. Use this when the user asks about their schedule, upcoming meetings, free time, or wants to schedule something. Also use proactively when creating tasks with due dates to check for conflicts.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'search', 'create'],
            description: 'Action: list (upcoming events), search (find events by query), or create (new event)',
          },
          days: {
            type: 'integer',
            description: 'Number of days ahead to look (for list action, default 7, max 90)',
          },
          query: {
            type: 'string',
            description: 'Search query to filter events (for list action)',
          },
          summary: {
            type: 'string',
            description: 'Event title (for create action)',
          },
          description: {
            type: 'string',
            description: 'Event description (for create action)',
          },
          start: {
            type: 'string',
            description: 'Event start time in ISO format e.g. 2025-01-15T09:00:00Z or YYYY-MM-DD for all-day (for create action)',
          },
          end: {
            type: 'string',
            description: 'Event end time in ISO format (for create action)',
          },
          location: {
            type: 'string',
            description: 'Event location (for create action)',
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'triage_email',
      description: 'Access Gmail to check inbox, search emails, or take triage actions. Use this when the user asks about their email, unread messages, wants to find a specific email, or asks you to archive, star, reply, or organize emails.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'search', 'archive', 'star', 'unstar', 'markRead', 'markUnread', 'trash', 'reply'],
            description: 'The email action to perform',
          },
          query: {
            type: 'string',
            description: 'Gmail search query (for list/search, e.g. "from:boss@company.com is:unread")',
          },
          label: {
            type: 'string',
            enum: ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT'],
            description: 'Gmail label to filter by (default INBOX)',
          },
          maxResults: {
            type: 'integer',
            description: 'Max emails to return (default 10, max 50)',
          },
          messageId: {
            type: 'string',
            description: 'Gmail message ID (required for triage actions like archive, star, reply)',
          },
          replyText: {
            type: 'string',
            description: 'Reply text content (required for reply action)',
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_agent',
      description: 'Delegate a specialized task to one of Seth\'s sub-agents. Available agents: SENTINEL (research/intelligence), ARCHITECT (financial strategy), HERALD (communications/persuasion), PHANTOM (operational security), VANGUARD (brand strategy). Modes: direct agent codename for single dispatch; "auto" for adaptive routing; "team" for multi-agent coordination; "swarm" for full autonomous swarm with parallel execution, shared context bus, working memory persistence, autonomous handoff chains, and consensus synthesis.',
      parameters: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            enum: ['sentinel', 'architect', 'herald', 'phantom', 'vanguard', 'auto', 'team', 'swarm'],
            description: 'The agent codename, "auto" for adaptive selection, "team" for multi-agent coordination, or "swarm" for full autonomous swarm orchestration',
          },
          task: {
            type: 'string',
            description: 'The detailed task description for the agent to execute',
          },
          context: {
            type: 'string',
            description: 'Additional context from the conversation to help the agent',
          },
          swarm_agents: {
            type: 'string',
            description: 'Comma-separated agent codenames for swarm mode (e.g., "sentinel,architect,herald"). If omitted in swarm mode, all agents are dispatched.',
          },
        },
        required: ['agent', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'brand_analysis',
      description: 'Run a brand analysis on the user\'s brand profile. Supports voice consistency checks (evaluate content against brand voice), competitor scans (analyze competitive positioning), and content strategy generation. Requires the user to have a brand profile set up.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['voice_check', 'competitor_scan', 'content_strategy'],
            description: 'Type of brand analysis to run',
          },
          content: {
            type: 'string',
            description: 'Content to analyze (required for voice_check)',
          },
          competitor: {
            type: 'string',
            description: 'Specific competitor to analyze (optional for competitor_scan)',
          },
        },
        required: ['action'],
      },
    },
  },
]

export async function executeWebSearch(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'system', content: 'You are a research assistant. Provide detailed, factual search results with specific numbers, dates, and sources when available. Be comprehensive.' },
          { role: 'user', content: query },
        ],
        venice_parameters: { enable_web_search: 'on' },
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      return `Web search failed with status ${res.status}`
    }

    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? 'No results found'
  } catch (error: any) {
    console.error('Web search error:', error)
    return `Web search error: ${error?.message ?? 'Unknown error'}`
  }
}

export async function executeCreateTask(
  args: { title: string; description?: string; priority?: string; autonomyLevel?: number; dueDate?: string },
  userId: string
): Promise<string> {
  try {
    const task = await prisma.task.create({
      data: {
        userId,
        title: args.title,
        description: args.description ?? '',
        priority: args.priority ?? 'medium',
        autonomyLevel: args.autonomyLevel ?? 3,
        status: 'pending',
        dueDate: args.dueDate ? new Date(args.dueDate) : null,
      },
    })
    return JSON.stringify({
      success: true,
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      autonomyLevel: task.autonomyLevel,
      dueDate: task.dueDate,
    })
  } catch (error: any) {
    console.error('Create task error:', error)
    return JSON.stringify({ success: false, error: error?.message ?? 'Failed to create task' })
  }
}

export async function executeSaveMemory(
  args: { content: string; type: string; importance?: number; tags?: string },
  userId: string
): Promise<string> {
  try {
    const memory = await prisma.memory.create({
      data: {
        userId,
        content: args.content,
        type: args.type ?? 'note',
        importance: args.importance ?? 7,
        tags: args.tags ? args.tags.toLowerCase() : '',
      },
    })
    // Generate semantic tags + vector embedding async (fire-and-forget)
    import('@/lib/cortex').then(({ enrichMemoryAsync }) => {
      enrichMemoryAsync(memory.id, memory.content).catch(() => {})
    }).catch(() => {})
    return JSON.stringify({
      success: true,
      memoryId: memory.id,
      type: memory.type,
      importance: memory.importance,
    })
  } catch (error: any) {
    console.error('Save memory error:', error)
    return JSON.stringify({ success: false, error: error?.message ?? 'Failed to save memory' })
  }
}

export async function executeSearchMemories(
  args: { query: string; type?: string },
  userId: string
): Promise<string> {
  try {
    const where: any = { userId }
    if (args.type) where.type = args.type
    if (args.query) {
      // Use lowercase contains to avoid ILIKE full table scans on indexed columns
      const q = args.query.toLowerCase()
      where.OR = [
        { content: { contains: q } },
        { tags: { contains: q } },
      ]
    }

    const memories = await prisma.memory.findMany({
      where,
      orderBy: { importance: 'desc' },
      take: 5,
    })

    if (memories.length === 0) {
      return JSON.stringify({ results: [], message: 'No matching memories found' })
    }

    return JSON.stringify({
      results: memories.map((m: any) => ({
        type: m.type,
        content: m.content,
        importance: m.importance,
        tags: m.tags,
        createdAt: m.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Search memories error:', error)
    return JSON.stringify({ results: [], error: error?.message ?? 'Search failed' })
  }
}

export async function executeGenerateEnvironment(
  args: { prompt: string; style?: string }
): Promise<string> {
  try {
    const skyboxApiKey = process.env.SKYBOX_API_KEY
    if (!skyboxApiKey) {
      return JSON.stringify({ success: false, error: 'Skybox API not configured' })
    }

    const SKYBOX_API = 'https://backend.blockadelabs.com/api/v1'
    const STYLE_MAP: Record<string, number> = {
      'command-center': 93, 'above-clouds': 77, 'neo-tokyo': 90,
      'cinematic': 102, 'photoreal': 67, 'digital-art': 87,
      'fantasy': 139, 'retro-future': 88, 'surreal': 141,
      'utopia': 144, 'dystopia': 146, 'concept-render': 148,
    }

    const styleId = STYLE_MAP[args.style ?? 'command-center'] ?? 93

    const genRes = await fetch(`${SKYBOX_API}/skybox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': skyboxApiKey,
      },
      body: JSON.stringify({
        prompt: (args.prompt ?? '').slice(0, 380),
        skybox_style_id: styleId,
        enhance_prompt: true,
      }),
    })

    if (!genRes.ok) {
      return JSON.stringify({ success: false, error: `Skybox API error: ${genRes.status}` })
    }

    const genData = await genRes.json()
    const skyboxId = genData?.id

    if (!skyboxId) {
      return JSON.stringify({ success: false, error: 'Failed to start generation' })
    }

    // Quick poll — stay within server timeout limits (max ~24s)
    // Use numeric id (not obfuscated_id) for the imagine/requests endpoint
    let result = genData
    let attempts = 0
    while (result?.status !== 'complete' && result?.status !== 'error' && attempts < 8) {
      await new Promise((r) => setTimeout(r, 3000))
      attempts++
      try {
        const pollRes = await fetch(`${SKYBOX_API}/imagine/requests/${skyboxId}`, {
          headers: { 'x-api-key': skyboxApiKey },
        })
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          result = pollData?.request ?? pollData
        }
      } catch { /* transient — keep trying */ }
    }

    if (result?.status === 'complete') {
      return JSON.stringify({
        success: true,
        type: 'skybox',
        fileUrl: result.file_url,
        thumbUrl: result.thumb_url,
        prompt: result.prompt,
      })
    }

    if (result?.status === 'error') {
      return JSON.stringify({ success: false, error: result?.error_message ?? 'Generation failed' })
    }

    // Still processing — return pending with tracking info
    return JSON.stringify({
      success: true,
      pending: true,
      type: 'skybox',
      skyboxId,
      message: 'Environment is being generated. It typically takes 60-90 seconds. You can check the Environments page to see it when ready.',
    })
  } catch (error: any) {
    console.error('Environment generation error:', error)
    return JSON.stringify({ success: false, error: error?.message ?? 'Generation failed' })
  }
}

export async function executeBrowserAutomate(
  args: { task: string; url?: string },
  userId: string
): Promise<string> {
  try {
    // Call core logic directly — no self-call HTTP round-trip, no auth bypass needed
    const { runBrowserAutomation } = await import('@/lib/browser-automate-core')
    const data = await runBrowserAutomation(userId, args.task, args.url)

    // Detect empty/null results and provide actionable feedback
    const resultData = data.data
    const isEmptyResult = !resultData || (typeof resultData === 'object' && Object.values(resultData).every(v => v === null || v === undefined || v === ''))

    if (data.success && isEmptyResult) {
      return JSON.stringify({
        success: false,
        automationId: data.automationId,
        result: null,
        error: 'The browser automation completed its steps but could not extract meaningful data. This task may not be suitable for web automation — it may require research, analysis, or strategic thinking rather than browser interaction. Consider rephrasing or using a different approach.',
        screenshot: data.screenshot ? '[screenshot captured]' : null,
        durationMs: data.durationMs,
        suggestion: 'This type of task is better handled through direct conversation rather than browser automation.',
      })
    }

    return JSON.stringify({
      success: data.success ?? false,
      automationId: data.automationId,
      result: resultData,
      screenshot: data.screenshot ? '[screenshot captured]' : null,
      error: data.error ?? null,
      durationMs: data.durationMs,
    })
  } catch (error: any) {
    console.error('Browser automate error:', error)
    return JSON.stringify({ success: false, error: error?.message ?? 'Automation failed' })
  }
}

export async function executeCheckCalendar(
  args: { action: string; days?: number; query?: string; summary?: string; description?: string; start?: string; end?: string; location?: string },
  googleAccessToken?: string
): Promise<string> {
  try {
    if (!googleAccessToken) {
      return JSON.stringify({ success: false, error: 'Google Calendar not connected. User needs to sign in with Google to enable calendar access.' })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const calendar = google.calendar({ version: 'v3', auth })

    if (args.action === 'create') {
      if (!args.summary || !args.start || !args.end) {
        return JSON.stringify({ success: false, error: 'summary, start, and end are required to create an event' })
      }
      const isAllDay = typeof args.start === 'string' && args.start.length === 10

      // --- Calendar Conflict Detection ---
      let conflicts: Array<{ summary: string; start: string; end: string }> = []
      try {
        const conflictCheck = await calendar.events.list({
          calendarId: 'primary',
          timeMin: isAllDay ? new Date(args.start).toISOString() : args.start,
          timeMax: isAllDay ? new Date(args.end).toISOString() : args.end,
          singleEvents: true,
          maxResults: 10,
        })
        conflicts = (conflictCheck.data.items ?? []).map(e => ({
          summary: e.summary ?? '(No title)',
          start: (e.start?.dateTime ?? e.start?.date) ?? '',
          end: (e.end?.dateTime ?? e.end?.date) ?? '',
        }))
      } catch (conflictErr) {
        console.warn('Conflict check failed, proceeding with creation:', conflictErr)
      }

      const eventBody: any = {
        summary: args.summary,
        description: args.description ?? undefined,
        location: args.location ?? undefined,
        start: isAllDay ? { date: args.start } : { dateTime: args.start, timeZone: 'UTC' },
        end: isAllDay ? { date: args.end } : { dateTime: args.end, timeZone: 'UTC' },
      }
      const res = await calendar.events.insert({ calendarId: 'primary', requestBody: eventBody })
      const result: any = {
        success: true,
        event: {
          id: res.data.id,
          summary: res.data.summary,
          start: res.data.start?.dateTime ?? res.data.start?.date,
          end: res.data.end?.dateTime ?? res.data.end?.date,
          htmlLink: res.data.htmlLink,
        },
      }
      if (conflicts.length > 0) {
        result.warning = `⚠️ CONFLICT DETECTED: This event overlaps with ${conflicts.length} existing event(s)`
        result.conflicts = conflicts
      }
      return JSON.stringify(result)
    }

    // Default: list events
    const days = Math.min(args.days ?? 7, 90)
    const now = new Date()
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
      q: args.query ?? undefined,
    })

    const events = (res.data.items ?? []).map(e => ({
      summary: e.summary ?? '(No title)',
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      location: e.location ?? null,
      attendees: (e.attendees ?? []).length,
      isAllDay: !e.start?.dateTime,
    }))

    if (events.length === 0) {
      return JSON.stringify({ success: true, events: [], message: `No events found in the next ${days} days${args.query ? ` matching "${args.query}"` : ''}` })
    }

    return JSON.stringify({ success: true, events, count: events.length, period: `Next ${days} days` })
  } catch (error: any) {
    console.error('Calendar tool error:', error)
    if (error?.code === 401 || error?.message?.includes('invalid_grant')) {
      return JSON.stringify({ success: false, error: 'Google token expired. User needs to sign out and sign in with Google again.' })
    }
    return JSON.stringify({ success: false, error: error?.message ?? 'Calendar access failed' })
  }
}

export async function executeTriageEmail(
  args: { action: string; query?: string; label?: string; maxResults?: number; messageId?: string; replyText?: string },
  googleAccessToken?: string,
  userEmail?: string
): Promise<string> {
  try {
    if (!googleAccessToken) {
      return JSON.stringify({ success: false, error: 'Gmail not connected. User needs to sign in with Google to enable email access.' })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    // Triage actions that require a messageId
    if (args.action && !['list', 'search'].includes(args.action) && args.messageId) {
      switch (args.action) {
        case 'archive':
          await gmail.users.messages.modify({ userId: 'me', id: args.messageId, requestBody: { removeLabelIds: ['INBOX'] } })
          return JSON.stringify({ success: true, action: 'archived', messageId: args.messageId })
        case 'star':
          await gmail.users.messages.modify({ userId: 'me', id: args.messageId, requestBody: { addLabelIds: ['STARRED'] } })
          return JSON.stringify({ success: true, action: 'starred', messageId: args.messageId })
        case 'unstar':
          await gmail.users.messages.modify({ userId: 'me', id: args.messageId, requestBody: { removeLabelIds: ['STARRED'] } })
          return JSON.stringify({ success: true, action: 'unstarred', messageId: args.messageId })
        case 'markRead':
          await gmail.users.messages.modify({ userId: 'me', id: args.messageId, requestBody: { removeLabelIds: ['UNREAD'] } })
          return JSON.stringify({ success: true, action: 'marked_read', messageId: args.messageId })
        case 'markUnread':
          await gmail.users.messages.modify({ userId: 'me', id: args.messageId, requestBody: { addLabelIds: ['UNREAD'] } })
          return JSON.stringify({ success: true, action: 'marked_unread', messageId: args.messageId })
        case 'trash':
          await gmail.users.messages.trash({ userId: 'me', id: args.messageId })
          return JSON.stringify({ success: true, action: 'trashed', messageId: args.messageId })
        case 'reply': {
          if (!args.replyText) return JSON.stringify({ success: false, error: 'replyText is required for reply action' })
          const original = await gmail.users.messages.get({
            userId: 'me', id: args.messageId, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Message-ID'],
          })
          const headers = original.data.payload?.headers ?? []
          const getH = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
          const rawEmail = [
            `From: ${userEmail ?? 'me'}`, `To: ${getH('From')}`,
            `Subject: Re: ${getH('Subject').replace(/^Re:\s*/i, '')}`,
            `In-Reply-To: ${getH('Message-ID')}`, `References: ${getH('Message-ID')}`,
            'Content-Type: text/plain; charset=utf-8', '', args.replyText,
          ].join('\r\n')
          await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(rawEmail).toString('base64url'), threadId: original.data.threadId ?? undefined } })
          return JSON.stringify({ success: true, action: 'replied', to: getH('From') })
        }
        default:
          return JSON.stringify({ success: false, error: `Unknown triage action: ${args.action}` })
      }
    }

    // List/search emails
    const maxResults = Math.min(args.maxResults ?? 10, 50)
    const label = args.label ?? 'INBOX'
    const query = args.query ?? ''

    const listRes = await gmail.users.messages.list({
      userId: 'me', maxResults, q: query || undefined, labelIds: [label],
    })

    const messageIds = listRes.data.messages ?? []
    if (messageIds.length === 0) {
      return JSON.stringify({ success: true, emails: [], message: `No emails found${query ? ` matching "${query}"` : ''} in ${label}` })
    }

    const emails = await Promise.all(
      messageIds.slice(0, maxResults).map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me', id: msg.id!, format: 'metadata', metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          })
          const h = detail.data.payload?.headers ?? []
          const getH = (n: string) => h.find(x => x.name?.toLowerCase() === n.toLowerCase())?.value ?? null
          return {
            id: detail.data.id,
            threadId: detail.data.threadId,
            snippet: detail.data.snippet ?? '',
            from: getH('From'),
            subject: getH('Subject') ?? '(No subject)',
            date: getH('Date'),
            isUnread: (detail.data.labelIds ?? []).includes('UNREAD'),
            isStarred: (detail.data.labelIds ?? []).includes('STARRED'),
            isImportant: (detail.data.labelIds ?? []).includes('IMPORTANT'),
          }
        } catch { return null }
      })
    )

    const valid = emails.filter(Boolean)
    return JSON.stringify({ success: true, emails: valid, count: valid.length })
  } catch (error: any) {
    console.error('Email tool error:', error)
    if (error?.code === 401 || error?.message?.includes('invalid_grant')) {
      return JSON.stringify({ success: false, error: 'Google token expired. User needs to sign out and sign in with Google again.' })
    }
    return JSON.stringify({ success: false, error: error?.message ?? 'Email access failed' })
  }
}

async function executeDelegateToAgent(
  args: { agent: string; task: string; context?: string; swarm_agents?: string },
  userId: string
): Promise<string> {
  try {
    // Handle swarm mode
    if (args.agent === 'swarm') {
      const { executeSwarm } = await import('@/lib/swarm')
      const agentList = args.swarm_agents
        ? args.swarm_agents.split(',').map(a => a.trim().toLowerCase())
        : ['sentinel', 'architect', 'herald', 'phantom', 'vanguard']

      const result = await executeSwarm(agentList, userId, args.task, args.context)

      return JSON.stringify({
        mode: 'swarm',
        orchestrationId: result.orchestrationId,
        totalLatencyMs: result.totalLatencyMs,
        workingMemoriesCreated: result.workingMemoriesCreated,
        agents: result.agents.map(a => ({
          agent: a.agentName,
          codename: a.agentCodename,
          avatar: a.agentAvatar,
          success: a.success,
          response: a.output,
          latencyMs: a.latencyMs,
          findings: a.findings,
          handoffTo: a.handoffTo,
          error: a.error,
        })),
        handoffChain: result.handoffChain,
        consensus: result.consensus,
      })
    }

    // Handle adaptive routing modes
    if (args.agent === 'auto' || args.agent === 'team') {
      const { adaptiveSelectAgent, selectMultiAgentTeam, recordRoutingOutcome } = await import('@/lib/agent-router')

      if (args.agent === 'team') {
        // Multi-agent coordination
        const routing = await selectMultiAgentTeam(userId, args.task)
        if (!routing.multiAgentTeam || routing.multiAgentTeam.length === 0) {
          return JSON.stringify({ error: 'No suitable agents found for team dispatch' })
        }

        // Dispatch to all team members in parallel
        const results = await Promise.all(
          routing.multiAgentTeam.map(agent =>
            dispatchToAgent(agent.codename, userId, args.task, args.context)
          )
        )

        const successful = results.filter(r => r.success)
        const routingDecisions = await prisma.routingDecision.findMany({
          where: { userId, routingMethod: 'multi-agent' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })

        // Record outcome
        if (routingDecisions[0]) {
          recordRoutingOutcome(
            routingDecisions[0].id,
            successful.length === results.length ? 'positive' : successful.length > 0 ? 'neutral' : 'negative'
          ).catch(() => {})
        }

        return JSON.stringify({
          mode: 'multi-agent',
          routing: {
            method: routing.method,
            confidence: routing.confidence,
            domain: routing.domain,
            reasoning: routing.reasoning,
            team: routing.multiAgentTeam.map(a => ({ name: a.name, codename: a.codename, score: a.score })),
          },
          results: results.map(r => ({
            agent: r.agentName,
            codename: r.agentCodename,
            avatar: r.agentAvatar,
            success: r.success,
            response: r.output,
            latencyMs: r.latencyMs,
          })),
        })
      }

      // Auto mode: adaptive single-agent selection
      const routing = await adaptiveSelectAgent(userId, args.task)
      if (!routing.selectedAgent) {
        return JSON.stringify({ error: 'No suitable agent found for this task', routing: { domain: routing.domain, reasoning: routing.reasoning } })
      }

      const result = await dispatchToAgent(routing.selectedAgent.codename, userId, args.task, args.context)

      // Record routing outcome
      const routingDecisions = await prisma.routingDecision.findMany({
        where: { userId, routingMethod: { in: ['adaptive', 'llm'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      })
      if (routingDecisions[0]) {
        recordRoutingOutcome(
          routingDecisions[0].id,
          result.success ? 'positive' : 'negative'
        ).catch(() => {})
      }

      return JSON.stringify({
        mode: 'adaptive',
        routing: {
          method: routing.method,
          confidence: routing.confidence,
          domain: routing.domain,
          reasoning: routing.reasoning,
          scores: routing.allScores.slice(0, 3).map(s => ({
            name: s.name, codename: s.codename, score: s.score, reasons: s.reasons.slice(0, 2),
          })),
        },
        agent: result.agentName,
        codename: result.agentCodename,
        avatar: result.agentAvatar,
        tier: result.tier,
        model: result.model,
        latencyMs: result.latencyMs,
        response: result.output,
      })
    }

    // Direct agent dispatch with working memory enhancement
    const { executeAgentWithMemory } = await import('@/lib/swarm')
    const swarmResult = await executeAgentWithMemory(args.agent, userId, args.task, args.context)
    if (!swarmResult.success) {
      return JSON.stringify({ error: swarmResult.error, agent: swarmResult.agentName })
    }
    return JSON.stringify({
      agent: swarmResult.agentName,
      codename: swarmResult.agentCodename,
      avatar: swarmResult.agentAvatar,
      latencyMs: swarmResult.latencyMs,
      response: swarmResult.output,
      findings: swarmResult.findings,
      handoffSuggestion: swarmResult.handoffTo || null,
    })
  } catch (err: any) {
    return JSON.stringify({ error: `Agent delegation failed: ${err.message}` })
  }
}

async function executeBrandAnalysis(
  args: { action: string; content?: string; competitor?: string },
  userId: string
): Promise<string> {
  try {
    // Find user's active brand profile
    const brand = await prisma.brandProfile.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (!brand) {
      return JSON.stringify({ error: 'No active brand profile found. Please create a brand profile first at /brand.' })
    }

    let result
    switch (args.action) {
      case 'voice_check':
        if (!args.content) return JSON.stringify({ error: 'Content is required for voice check' })
        result = await runVoiceCheck(brand.id, userId, args.content)
        break
      case 'competitor_scan':
        result = await runCompetitorScan(brand.id, userId, args.competitor)
        break
      case 'content_strategy':
        result = await generateContentStrategy(brand.id, userId)
        break
      default:
        return JSON.stringify({ error: `Unknown brand analysis action: ${args.action}` })
    }

    return JSON.stringify({
      brandName: brand.brandName,
      analysisType: args.action,
      score: result.score,
      findings: result.findings,
      summary: result.summary,
    })
  } catch (err: any) {
    return JSON.stringify({ error: `Brand analysis failed: ${err.message}` })
  }
}

export async function executeTool(
  toolName: string,
  args: any,
  userId: string,
  apiKey: string,
  extra?: { googleAccessToken?: string; userEmail?: string }
): Promise<{ name: string; result: string }> {
  let result: string

  switch (toolName) {
    case 'web_search':
      result = await executeWebSearch(args?.query ?? '', apiKey)
      break
    case 'create_task':
      result = await executeCreateTask(args, userId)
      break
    case 'save_memory':
      result = await executeSaveMemory(args, userId)
      break
    case 'search_memories':
      result = await executeSearchMemories(args, userId)
      break
    case 'generate_environment':
      result = await executeGenerateEnvironment(args)
      break
    case 'browser_automate':
      result = await executeBrowserAutomate(args, userId)
      break
    case 'check_calendar':
      result = await executeCheckCalendar(args, extra?.googleAccessToken)
      break
    case 'triage_email':
      result = await executeTriageEmail(args, extra?.googleAccessToken, extra?.userEmail)
      break
    case 'delegate_to_agent':
      result = await executeDelegateToAgent(args, userId)
      break
    case 'brand_analysis':
      result = await executeBrandAnalysis(args, userId)
      break
    default:
      result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  return { name: toolName, result }
}
