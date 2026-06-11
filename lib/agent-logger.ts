import { prisma } from '@/lib/prisma'

export interface LogEntry {
  userId: string
  messageId?: string
  action: string // chat, tool_call, auto_execute, consolidation, reprioritize
  tier?: string
  model?: string
  provider?: string
  toolName?: string
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
  success?: boolean
  error?: string
  metadata?: Record<string, any>
}

export async function logAgentActivity(entry: LogEntry): Promise<void> {
  try {
    await prisma.agentLog.create({
      data: {
        userId: entry.userId,
        messageId: entry.messageId,
        action: entry.action,
        tier: entry.tier,
        model: entry.model,
        provider: entry.provider,
        toolName: entry.toolName,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        latencyMs: entry.latencyMs,
        success: entry.success ?? true,
        error: entry.error,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
      },
    })
  } catch (err) {
    // Never let logging break the main flow
    console.error('[AgentLogger] Failed to log:', err)
  }
}
