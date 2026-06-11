export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMessagesWithMemories } from '@/lib/venice'
import { SETH_TOOLS, executeTool } from '@/lib/tools'
import {
  routeForChat,
  routeForToolDetection,
  getToolDetectionFallback,
  getChatFallback,
  buildHeaders,
  buildRequestBody,
  type ModelConfig,
} from '@/lib/model-router'
import { logAgentActivity } from '@/lib/agent-logger'
import { recordObservation, getWeightedMemories, getGraphContext, processTextForEntities, autoLinkProjects } from '@/lib/cortex'
import { resolveAuth } from '@/lib/wearable-auth'
import { startTrace, startSpan, addSpan, annotate, endTrace } from '@/lib/telemetry'

const MAX_TOOL_ROUNDS = 3

async function callToolModel(
  messages: Array<Record<string, any>>,
  config: ModelConfig
): Promise<any> {
  const headers = buildHeaders(config)
  const body = buildRequestBody(config, messages, {
    tools: SETH_TOOLS,
    toolChoice: 'auto',
    maxTokens: 2000,
  })

  console.log(`[Router] Tool detection via ${config.tier}/${config.model} — ${config.reason}`)

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Tool model API error (${config.model}): ${res.status} ${errText.slice(0, 200)}`)
  }

  return res.json()
}

export async function POST(request: Request) {
  try {
    // Dual authentication: session (browser/PWA) or API key (wearable/companion)
    const trace = startTrace('chat', 'chat.full')
    const endAuthSpan = startSpan(trace, 'auth')
    const auth = await resolveAuth(request)
    if (!auth) {
      endAuthSpan({ status: 'unauthorized' })
      endTrace(trace, 'error')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const userId = auth.userId
    trace.userId = userId
    trace.authMethod = auth.source
    endAuthSpan({ method: auth.source })

    // Extract Google tokens from JWT (only available in session-based auth)
    let googleAccessToken: string | undefined
    let userEmail: string | undefined
    if (auth.source === 'session') {
      const session = await getServerSession(authOptions)
      const jwt = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET! })
      googleAccessToken = jwt?.googleAccessToken as string | undefined
      userEmail = session?.user?.email ?? undefined
    }

    const body = await request.json()
    const { message, conversationId, location } = body ?? {}

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 })
    }

    // Guard against excessively long messages
    if (message.length > 32000) {
      return new Response(JSON.stringify({ error: 'Message exceeds maximum length' }), { status: 400 })
    }

    // Get or create conversation — with ownership verification for existing conversations
    let convId = conversationId
    if (convId) {
      // FIX #3: Verify the conversation belongs to this user before injecting messages
      const existingConv = await prisma.conversation.findFirst({
        where: { id: convId, userId },
      })
      if (!existingConv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 })
      }
    } else {
      const conv = await prisma.conversation.create({
        data: {
          userId,
          title: (message as string)?.slice?.(0, 50) ?? 'New Conversation',
        },
      })
      convId = conv.id
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: message,
      },
    })

    // FIX #6: Parallelize independent DB queries (~3x faster)
    const endContextSpan = startSpan(trace, 'context.resolve')
    const contextStart = Date.now()
    const [history, memories, user, graphContext] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      getWeightedMemories(userId, 10, message),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, objectives: true, preferences: true, workingStyle: true },
      }),
      getGraphContext(userId, message).catch(() => null),
    ])
    // Compute memory retrieval stats for reliability metrics
    const memoryStats = {
      retrieved: memories?.length ?? 0,
      avgSimilarity: 0,
      avgImportance: 0,
    }
    if (memories && memories.length > 0) {
      const sims = memories.map((m: any) => m.semanticScore ?? 0).filter((s: number) => s > 0)
      const imps = memories.map((m: any) => m.importance ?? 5)
      memoryStats.avgSimilarity = sims.length > 0 ? sims.reduce((a: number, b: number) => a + b, 0) / sims.length : 0
      memoryStats.avgImportance = imps.reduce((a: number, b: number) => a + b, 0) / imps.length
    }

    endContextSpan({
      historyCount: history?.length ?? 0,
      memoryCount: memories?.length ?? 0,
      graphContextInjected: !!graphContext,
      graphContextLength: graphContext?.length ?? 0,
    })

    const veniceKey = process.env.VENICE_API_KEY
    if (!veniceKey) {
      return new Response(JSON.stringify({ error: 'Venice API key not configured' }), { status: 500 })
    }

    // Build context-enriched messages — reused for both tool detection and final response
    const historyFormatted = (history ?? []).map((m: any) => ({ role: m?.role ?? 'user', content: m?.content ?? '' }))
    const contextMessages = buildMessagesWithMemories(
      memories ?? [],
      historyFormatted,
      user ?? undefined
    )

    // Inject location context if available
    if (location && location.latitude) {
      const locParts: string[] = []
      if (location.city) locParts.push(location.city)
      if (location.region) locParts.push(location.region)
      if (location.country) locParts.push(location.country)
      const locStr = locParts.length > 0 ? locParts.join(', ') : `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
      const tz = location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      contextMessages[0].content += `\n\nCurrent Location: ${locStr}\nTimezone: ${tz}\nLocal Time: ${new Date().toLocaleString('en-US', { timeZone: tz })}\n\nUse this location context to personalize recommendations (local weather, nearby services, timezone-aware scheduling, etc.).`
    }

    // Inject graph context (entities, relations, contradictions, insights, projects)
    if (graphContext) {
      contextMessages[0].content += `\n\n${graphContext}`
    }

    // Response Cadence Optimization — wearable voice channel demands executive brevity
    if (auth.source === 'api-key') {
      contextMessages[0].content += `\n\nRESPONSE CADENCE PROTOCOL (WEARABLE VOICE CHANNEL):
You are communicating through a wearable audio device. Your output will be spoken aloud.
Rules:
- Maximum 3 sentences per response unless explicitly asked for detail.
- Lead with the decision, conclusion, or answer. Context follows only if essential.
- No preamble. No filler. No "Sure, I can help with that."
- Numbers: round to meaningful precision. "About 4.2 million" not "4,217,893".
- When listing: max 3 items. Summarize the rest as "plus N others".
- Time references: relative ("in 2 hours", "last Tuesday") not absolute timestamps.
- If the user needs to act: state the action first, reason second.
- Tone: calm authority. Like a chief of staff briefing a principal between meetings.
- Never narrate what you're doing. Just do it and report the result.`
    }

    // Enhance system prompt with tool awareness
    const toolSystemMsg = contextMessages[0]
    toolSystemMsg.content += `\n\nYou have access to the following tools and MUST use them when appropriate:\n- web_search: Search the web for ANY current information, news, market data, prices, or real-time data. ALWAYS use this for questions about current events or data.\n- create_task: Create tasks for the user when they mention action items, todos, or things that need to be done.\n- save_memory: Save important information the user shares (preferences, decisions, key facts) to long-term memory.\n- search_memories: Search stored memories for past decisions, preferences, or context.\n- generate_environment: Create immersive 360° panoramic environments/skyboxes. Use when the user asks for a visual scene, ambient background, concept visualization, or immersive environment. Available styles: command-center, above-clouds, neo-tokyo, cinematic, photoreal, digital-art, fantasy, retro-future, utopia, dystopia, concept-render, surreal.\n- browser_automate: Automate browser tasks on any website using a remote headless browser. Use this when the user asks to fill out forms, scrape/extract data from websites, check a webpage, book something online, submit applications, take screenshots, or perform any multi-step browser interaction. Provide a detailed task description and the target URL. The system will generate and execute a Puppeteer script on a cloud browser.\n- check_calendar: Read and manage the user's Google Calendar. Actions: "list" (upcoming events with optional days param, default 7), "search" (find events matching a query), "create" (create a new event with title, date, time, duration, description, location). Use when the user asks about their schedule, upcoming events, meetings, or wants to add events to their calendar.\n- triage_email: Read and manage the user's Gmail inbox. Actions: "list" (recent emails with optional maxResults), "search" (search emails by query), "archive" (remove from inbox), "star"/"unstar", "markRead"/"markUnread", "trash" (delete), "label" (apply a label), "reply" (send a reply). Use when the user asks about their emails, inbox, or wants to manage/triage messages.\n\nIMPORTANT: You MUST call tools proactively. If the user asks anything that requires current data, DO NOT answer from your training data—use web_search. If the user shares important info, use save_memory. If they mention a task, use create_task. If they want a visual environment or scene, use generate_environment. If they want to interact with a website (fill forms, extract data, automate clicks), use browser_automate. If the user asks about their schedule, meetings, or calendar, use check_calendar. If they ask about emails or want to manage their inbox, use triage_email.`

    // --- Intelligent Model Routing ---
    const chatStartTime = Date.now()
    const chatRoute = routeForChat(message)
    let toolRoute = routeForToolDetection()
    annotate(trace, {
      chatModel: chatRoute.model,
      chatTier: chatRoute.tier,
      toolModel: toolRoute.model,
      toolTier: toolRoute.tier,
    })

    // Stream setup
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversationId + routing info
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'meta',
            conversationId: convId,
            routing: {
              chatModel: chatRoute.model,
              chatTier: chatRoute.tier,
              toolModel: toolRoute.model,
              toolTier: toolRoute.tier,
              reason: chatRoute.reason,
            },
          })}\n\n`))

          console.log(`[Router] Chat: ${chatRoute.tier}/${chatRoute.model} — ${chatRoute.reason}`)

          // Phase 1: Tool calling with routed model (free tier preferred)
          let toolMessages: Array<Record<string, any>> = [...contextMessages]
          let toolsUsed: Array<{ name: string; query?: string; result?: string }> = []
          let round = 0

          while (round < MAX_TOOL_ROUNDS) {
            round++

            let toolResponse: any
            try {
              toolResponse = await callToolModel(toolMessages, toolRoute)
            } catch (err: any) {
              console.error(`[Router] Tool model ${toolRoute.model} failed:`, err?.message)
              // Try fallback
              const fallback = getToolDetectionFallback(toolRoute.model)
              if (fallback) {
                console.log(`[Router] Falling back to ${fallback.model} — ${fallback.reason}`)
                toolRoute = fallback
                try {
                  toolResponse = await callToolModel(toolMessages, toolRoute)
                } catch (err2: any) {
                  console.error(`[Router] Fallback ${toolRoute.model} also failed:`, err2?.message)
                  break
                }
              } else {
                break
              }
            }

            const choice = toolResponse?.choices?.[0]
            const assistantMsg = choice?.message

            if (!assistantMsg) break

            // Check if model wants to use tools
            const hasToolCalls = assistantMsg?.tool_calls?.length > 0
            if (hasToolCalls) {
              toolMessages.push({
                role: 'assistant',
                content: assistantMsg.content ?? '',
                tool_calls: assistantMsg.tool_calls,
              })

              for (const toolCall of assistantMsg.tool_calls) {
                const fnName = toolCall?.function?.name ?? ''
                let fnArgs: any = {}
                try {
                  fnArgs = JSON.parse(toolCall?.function?.arguments ?? '{}')
                } catch (e) {
                  fnArgs = {}
                }

                // Notify client about tool execution
                const toolNotif = {
                  type: 'tool_use',
                  tool: fnName,
                  args: fnName === 'web_search' ? { query: fnArgs.query } :
                        fnName === 'create_task' ? { title: fnArgs.title } :
                        fnName === 'save_memory' ? { type: fnArgs.type } :
                        fnName === 'search_memories' ? { query: fnArgs.query } :
                        fnName === 'generate_environment' ? { prompt: fnArgs.prompt?.slice(0, 60) } :
                        fnName === 'browser_automate' ? { task: fnArgs.task?.slice(0, 60), url: fnArgs.url } :
                        fnName === 'check_calendar' ? { action: fnArgs.action, query: fnArgs.query } :
                        fnName === 'triage_email' ? { action: fnArgs.action, query: fnArgs.query } : {},
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolNotif)}\n\n`))

                // Execute tool
                const toolStart = Date.now()
                const toolResult = await executeTool(fnName, fnArgs, userId, veniceKey, { googleAccessToken, userEmail })
                addSpan(trace, `tool.${fnName}`, Date.now() - toolStart, {
                  success: !toolResult.result?.includes('"error"'),
                  resultLength: toolResult.result?.length ?? 0,
                })
                toolsUsed.push({ name: fnName, query: fnArgs.query ?? fnArgs.title ?? fnArgs.content, result: toolResult.result?.slice(0, 200) })

                // Log tool call
                logAgentActivity({
                  userId,
                  action: 'tool_call',
                  tier: toolRoute.tier,
                  model: toolRoute.model,
                  provider: toolRoute.provider,
                  toolName: fnName,
                  latencyMs: Date.now() - toolStart,
                  success: !toolResult.result?.includes('"error"'),
                  metadata: { args: fnArgs },
                })

                // Add tool result to messages
                toolMessages.push({
                  role: 'tool',
                  content: toolResult.result,
                  tool_call_id: toolCall.id,
                  name: fnName,
                })

                // Notify client about tool result
                const toolResultEvent: Record<string, any> = { type: 'tool_result', tool: fnName, success: true }

                if (fnName === 'generate_environment') {
                  try {
                    const skyboxData = JSON.parse(toolResult.result)
                    if (skyboxData?.success && skyboxData?.fileUrl) {
                      toolResultEvent.skyboxUrl = skyboxData.fileUrl
                    }
                  } catch {}
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolResultEvent)}\n\n`))
              }

              continue
            }

            break
          }

          // Phase 2: Generate final response with routed model (streaming)
          let responseRoute = chatRoute

          // FIX #7: Reuse contextMessages instead of rebuilding — just clone and inject tool results
          const finalMessages = contextMessages.map(m => ({ ...m }))

          if (toolsUsed.length > 0) {
            const toolResultsSummary = toolMessages
              .filter((m: any) => m.role === 'tool')
              .map((m: any) => `[${m.name?.toUpperCase() ?? 'TOOL'} RESULT]: ${m.content}`)
              .join('\n\n')

            finalMessages.splice(finalMessages.length - 1, 0, {
              role: 'system',
              content: `The following tool results were gathered to answer the user's question. Use this information in your response:\n\n${toolResultsSummary}`,
            })
          }

          // Build request using the router
          const responseHeaders = buildHeaders(responseRoute)
          const responseBody = buildRequestBody(responseRoute, finalMessages, {
            stream: true,
            maxTokens: 2500,
            webSearch: responseRoute.provider === 'venice'
              ? (toolsUsed.some(t => t.name === 'web_search') ? false : 'auto')
              : undefined,
          })

          console.log(`[Router] Response via ${responseRoute.tier}/${responseRoute.model}`)

          let chatResponse = await fetch(responseRoute.apiUrl, {
            method: 'POST',
            headers: responseHeaders,
            body: JSON.stringify(responseBody),
          })

          // If response model fails, try fallback
          if (!chatResponse.ok) {
            const errorText = await chatResponse.text().catch(() => 'Unknown error')
            console.error(`[Router] Response model ${responseRoute.model} failed: ${chatResponse.status}`, errorText)

            const fallback = getChatFallback(responseRoute.model)
            if (fallback) {
              console.log(`[Router] Falling back response to ${fallback.model} — ${fallback.reason}`)
              responseRoute = fallback
              const fbHeaders = buildHeaders(responseRoute)
              const fbBody = buildRequestBody(responseRoute, finalMessages, {
                stream: true,
                maxTokens: 2500,
                webSearch: responseRoute.provider === 'venice'
                  ? (toolsUsed.some(t => t.name === 'web_search') ? false : 'auto')
                  : undefined,
              })
              chatResponse = await fetch(responseRoute.apiUrl, {
                method: 'POST',
                headers: fbHeaders,
                body: JSON.stringify(fbBody),
              })
            }
          }

          if (!chatResponse.ok) {
            const errorText = await chatResponse.text().catch(() => 'Unknown error')
            console.error('Final response API error:', chatResponse.status, errorText)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate response' })}\n\n`))
            controller.close()
            return
          }

          // Stream the final response
          let fullResponse = ''
          const reader = chatResponse.body?.getReader()
          const decoder = new TextDecoder()

          if (!reader) {
            controller.close()
            return
          }

          // FIX #5: Wrap reader loop in try/catch to send error event on stream failure
          let partialRead = ''
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              partialRead += decoder.decode(value, { stream: true })
              const lines = partialRead.split('\n')
              partialRead = lines.pop() ?? ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    // Save assistant message to DB
                    await prisma.message.create({
                      data: {
                        conversationId: convId,
                        role: 'assistant',
                        content: fullResponse,
                      },
                    })

                    // Log the chat interaction
                    logAgentActivity({
                      userId,
                      action: 'chat',
                      tier: responseRoute.tier,
                      model: responseRoute.model,
                      provider: responseRoute.provider,
                      latencyMs: Date.now() - chatStartTime,
                      metadata: {
                        toolsUsed: toolsUsed.map(t => t.name),
                        toolModel: toolRoute.model,
                        toolTier: toolRoute.tier,
                        responseLength: fullResponse.length,
                      },
                    })

                    // Estimate memory utilization: how many retrieved memories were referenced in the response
                    let memoriesReferenced = 0
                    if (memories && memories.length > 0 && fullResponse.length > 0) {
                      const responseLower = fullResponse.toLowerCase()
                      for (const mem of memories) {
                        const content = (mem as any).content || ''
                        // Extract key phrases (first 5 significant words) as fingerprint
                        const words = content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4).slice(0, 5)
                        // Memory is "referenced" if 3+ key words appear in response
                        const matches = words.filter((w: string) => responseLower.includes(w)).length
                        if (matches >= Math.min(3, words.length)) memoriesReferenced++
                      }
                    }

                    // Finalize telemetry trace with memory utilization data
                    annotate(trace, {
                      toolsUsed: toolsUsed.map(t => t.name),
                      responseModel: responseRoute.model,
                      responseTier: responseRoute.tier,
                      responseLength: fullResponse.length,
                      memoriesRetrieved: memoryStats.retrieved,
                      memoriesReferenced,
                      avgSimilarity: memoryStats.avgSimilarity,
                      avgImportance: memoryStats.avgImportance,
                    })
                    endTrace(trace, 'ok')

                    // Cortex observation (fire-and-forget)
                    recordObservation({
                      userId,
                      source: 'chat',
                      category: toolsUsed.length > 0 ? 'execution' : 'communication',
                      event: `Chat interaction: ${message.slice(0, 120)}${message.length > 120 ? '...' : ''}`,
                      metadata: {
                        toolsUsed: toolsUsed.map(t => t.name),
                        model: responseRoute.model,
                        responseLength: fullResponse.length,
                        latencyMs: Date.now() - chatStartTime,
                      },
                      outcome: 'positive',
                      confidence: 0.7,
                      importance: toolsUsed.length > 0 ? 6 : 4,
                    }).catch(() => {})

                    // Entity extraction + project auto-linking (fire-and-forget)
                    processTextForEntities(userId, `${message}\n\n${fullResponse}`, 'chat').catch(() => {})
                    autoLinkProjects(userId, `${message} ${fullResponse}`, 'conversation', conversationId).catch(() => {})

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'done',
                      toolsUsed: toolsUsed.map(t => t.name),
                      routing: {
                        chatModel: responseRoute.model,
                        chatTier: responseRoute.tier,
                        toolModel: toolRoute.model,
                        toolTier: toolRoute.tier,
                      },
                    })}\n\n`))
                    controller.close()
                    return
                  }
                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed?.choices?.[0]?.delta?.content ?? ''
                    if (content) {
                      fullResponse += content
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          } catch (readerError: any) {
            console.error('Stream reader error:', readerError)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Response stream interrupted' })}\n\n`))
          }

          // If we got here without [DONE], save what we have
          if (fullResponse) {
            await prisma.message.create({
              data: {
                conversationId: convId,
                role: 'assistant',
                content: fullResponse,
              },
            })
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            toolsUsed: toolsUsed.map(t => t.name),
            routing: {
              chatModel: responseRoute.model,
              chatTier: responseRoute.tier,
              toolModel: toolRoute.model,
              toolTier: toolRoute.tier,
            },
          })}\n\n`))
        } catch (error: any) {
          console.error('Stream error:', error)
          annotate(trace, { error: error?.message })
          endTrace(trace, 'error')
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`))
          } catch {}
        } finally {
          try { controller.close() } catch {}
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    return new Response(JSON.stringify({ error: 'Chat request failed' }), { status: 500 })
  }
}