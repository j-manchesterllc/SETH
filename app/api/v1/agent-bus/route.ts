import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Valid systems on the agent bus
const VALID_SYSTEMS = ['SETH', 'AEGIS', 'HERMES', 'CLAW', 'GHOST', 'QUANTUM']

// System token validation from environment
function validateSystemToken(request: NextRequest): { system: string } | NextResponse {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid Authorization header' },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)

  // Map tokens to system names from environment variables
  const systemTokens: Record<string, string> = {
    [process.env.BUS_TOKEN_SETH || '']: 'SETH',
    [process.env.BUS_TOKEN_AEGIS || '']: 'AEGIS',
    [process.env.BUS_TOKEN_HERMES || '']: 'HERMES',
    [process.env.BUS_TOKEN_CLAW || '']: 'CLAW',
    [process.env.BUS_TOKEN_GHOST || '']: 'GHOST',
    [process.env.BUS_TOKEN_QUANTUM || '']: 'QUANTUM',
    // Legacy token names
    [process.env.SETH_BUS_TOKEN || '']: 'SETH',
    [process.env.AEGIS_BUS_TOKEN || '']: 'AEGIS',
    [process.env.HERMES_BUS_TOKEN || '']: 'HERMES',
    [process.env.CLAW_BUS_TOKEN || '']: 'CLAW',
    [process.env.GHOST_BUS_TOKEN || '']: 'GHOST',
    [process.env.QUANTUM_BUS_TOKEN || '']: 'QUANTUM',
  }

  const system = systemTokens[token]
  if (!system) {
    return NextResponse.json(
      { success: false, error: 'Invalid system token' },
      { status: 401 }
    )
  }

  return { system }
}

export async function POST(request: NextRequest) {
  const validation = validateSystemToken(request)
  if (validation instanceof NextResponse) {
    return validation
  }
  const sourceSystem = validation.system

  try {
    const body = await request.json()
    const { target, message_type, payload, priority, source_session_id } = body

    // Validate target
    if (!target || !VALID_SYSTEMS.includes(target.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Invalid target. Must be one of: ${VALID_SYSTEMS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate message_type
    if (!message_type || typeof message_type !== 'string') {
      return NextResponse.json(
        { success: false, error: 'message_type is required and must be a string' },
        { status: 400 }
      )
    }

    // Validate payload
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'payload must be a non-empty object' },
        { status: 400 }
      )
    }

    // Validate priority
    const msgPriority = priority ?? 2
    if (![1, 2, 3].includes(msgPriority)) {
      return NextResponse.json(
        { success: false, error: 'priority must be 1 (high), 2 (normal), or 3 (low)' },
        { status: 400 }
      )
    }

    // Create the bus message
    const message = await prisma.busMessage.create({
      data: {
        source: sourceSystem,
        target: target.toUpperCase(),
        messageType: message_type,
        payload: JSON.stringify(payload),
        priority: msgPriority,
        status: 'pending',
        sourceSessionId: source_session_id,
      },
    })

    return NextResponse.json({
      success: true,
      message_id: message.id,
      status: 'queued',
    })
  } catch (error) {
    console.error('[agent-bus] Send error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for agents to poll for messages
export async function GET(request: NextRequest) {
  const validation = validateSystemToken(request)
  if (validation instanceof NextResponse) {
    return validation
  }
  const targetSystem = validation.system

  try {
    // Fetch pending messages for this system
    const messages = await prisma.busMessage.findMany({
      where: {
        target: targetSystem,
        status: 'pending',
      },
      orderBy: [
        { priority: 'asc' }, // 1 = high priority first
        { createdAt: 'asc' }, // FIFO within priority
      ],
      take: 50, // Batch limit
    })

    // Mark as delivered
    if (messages.length > 0) {
      await prisma.busMessage.updateMany({
        where: { id: { in: messages.map(m => m.id) } },
        data: { status: 'delivered', deliveredAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        source: m.source,
        messageType: m.messageType,
        payload: typeof m.payload === 'string' ? JSON.parse(m.payload) : m.payload,
        priority: m.priority,
        sourceSessionId: m.sourceSessionId,
        createdAt: m.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[agent-bus] Receive error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0