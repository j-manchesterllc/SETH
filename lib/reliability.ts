import { prisma } from '@/lib/prisma'

// ───────────────────────────────────────────
// SETH Reliability Metrics v2 — Three-Pillar Scorecard
// ───────────────────────────────────────────
// Pillar 1: OPERATIONAL RELIABILITY — is the infrastructure working?
//   - Tool Success Rate
//   - Agent Dispatch Success Rate
//   - System Error Rate (fallback + error / total)
//
// Pillar 2: REASONING RELIABILITY — is the thinking correct?
//   - Routing Precision (selected-vs-best gap from candidateScores)
//   - Memory Utilization (retrieved → referenced → ignored)
//   - Reasoning Drift (clarification frequency, correction signals)
//
// Pillar 3: EXECUTION RELIABILITY — are outcomes valuable?
//   - Workflow Completion Rate
//   - Decision Quality (correction frequency, follow-up clarifications)
//   - Decision Latency (p50, p95)
// ───────────────────────────────────────────

export interface OperationalReliability {
  toolSuccessRate: {
    totalCalls: number
    failures: number
    rate: number // success rate (1 - failure/total)
    byTool: Record<string, { calls: number; failures: number; rate: number }>
  }
  agentDispatchRate: {
    totalDispatches: number
    successes: number
    failures: number
    rate: number
    byAgent: Record<string, { dispatches: number; successes: number; rate: number; avgLatencyMs: number }>
  }
  systemErrorRate: {
    totalResponses: number
    fallbackCount: number
    errorCount: number
    rate: number // (fallback + error) / total — infrastructure-only failures
  }
}

export interface ReasoningReliability {
  routingPrecision: {
    total: number
    withCandidateScores: number // decisions that have scored alternatives
    avgSelectedScore: number   // avg score of the agent that was selected
    avgBestScore: number       // avg score of the best candidate
    avgScoreGap: number        // best - selected (0 = perfect, positive = suboptimal)
    // Legacy outcome tracking (kept for backward compat)
    positive: number
    negative: number
    neutral: number
    unrated: number
    outcomeRate: number
  }
  memoryUtilization: {
    totalRetrievals: number
    totalMemoriesRetrieved: number  // sum of memories retrieved across all chats
    totalMemoriesReferenced: number // sum of memories actually used in responses
    totalMemoriesIgnored: number    // retrieved but never referenced
    utilizationRate: number         // referenced / retrieved
    avgSimilarityScore: number      // average cosine similarity of retrieved memories
    avgImportance: number
  }
  reasoningDrift: {
    totalConversations: number
    clarificationRate: number    // % of conversations requiring clarification follow-ups
    correctionSignals: number    // user messages that indicate correction ("no, I meant...", "that's wrong")
    totalUserMessages: number
    correctionRate: number       // correction signals / total user messages
  }
}

export interface ExecutionReliability {
  workflowCompletion: {
    totalDelegated: number
    completed: number
    rate: number
  }
  decisionQuality: {
    totalDecisions: number
    reversals: number           // tasks that went completed → then back to pending/in-progress
    clarificationRequests: number // follow-up user messages in same conversation after agent dispatch
    avgConfidence: number       // average routing confidence
    confidenceCalibration: number // how well confidence predicts success (0-1)
  }
  decisionLatency: {
    avgMs: number
    p50Ms: number
    p95Ms: number
    samples: number
  }
}

export interface ReliabilityMetrics {
  period: string
  since: string
  operational: OperationalReliability
  reasoning: ReasoningReliability
  execution: ExecutionReliability

  // Top-level composite scores (0-100)
  compositeScores: {
    operational: number  // weighted: tools 30%, agents 40%, errors 30%
    reasoning: number    // weighted: routing 30%, memory 40%, drift 30%
    execution: number    // weighted: completion 35%, quality 35%, latency 30%
    overall: number      // average of three pillars
  }
}

// ─── Correction Signal Detection ─────────────────────────────────
const CORRECTION_PATTERNS = [
  /\bno[,.]?\s+(i\s+meant|actually|what\s+i)/i,
  /\bthat'?s\s+(not|wrong|incorrect)/i,
  /\bi\s+didn'?t\s+(mean|say|ask)/i,
  /\bcorrection:/i,
  /\blet\s+me\s+(rephrase|clarify)/i,
  /\bwhat\s+i\s+(actually|really)\s+(want|need|meant)/i,
  /\bnot\s+what\s+i\s+(asked|meant|wanted)/i,
  /\bwrong\s+(answer|response|approach)/i,
  /\btry\s+again/i,
]

const CLARIFICATION_PATTERNS = [
  /\bwhat\s+do\s+you\s+mean/i,
  /\bcan\s+you\s+(clarify|explain)/i,
  /\bi\s+don'?t\s+understand/i,
  /\bwhat\s+exactly/i,
  /\bcould\s+you\s+be\s+more\s+specific/i,
]

function isCorrection(content: string): boolean {
  return CORRECTION_PATTERNS.some(p => p.test(content))
}

function isClarification(content: string): boolean {
  return CLARIFICATION_PATTERNS.some(p => p.test(content))
}

export async function getReliabilityMetrics(
  userId: string,
  hours: number = 24
): Promise<ReliabilityMetrics> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const period = hours <= 24 ? '24h' : hours <= 168 ? '7d' : '30d'

  // ═══════════════════════════════════════════════════════════
  // PILLAR 1: OPERATIONAL RELIABILITY
  // ═══════════════════════════════════════════════════════════

  // ─── Tool Success Rate ─────────────────────────────────────
  const toolLogs = await prisma.agentLog.findMany({
    where: { userId, action: 'tool_call', createdAt: { gte: since } },
    select: { toolName: true, success: true },
  })
  const totalToolCalls = toolLogs.length
  const toolFailures = toolLogs.filter(t => !t.success).length
  const byTool: Record<string, { calls: number; failures: number; rate: number }> = {}
  for (const t of toolLogs) {
    const name = t.toolName || 'unknown'
    if (!byTool[name]) byTool[name] = { calls: 0, failures: 0, rate: 0 }
    byTool[name].calls++
    if (!t.success) byTool[name].failures++
  }
  for (const k of Object.keys(byTool)) {
    byTool[k].rate = byTool[k].calls > 0 ? 1 - (byTool[k].failures / byTool[k].calls) : 1
  }

  // ─── Agent Dispatch Success ────────────────────────────────
  const dispatches = await prisma.agentDispatch.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { success: true, latencyMs: true, agent: { select: { name: true, codename: true } } },
  })
  const totalDispatches = dispatches.length
  const dispatchSuccesses = dispatches.filter(d => d.success).length
  const byAgent: Record<string, { dispatches: number; successes: number; rate: number; avgLatencyMs: number }> = {}
  for (const d of dispatches) {
    const name = d.agent?.name || 'Unknown'
    if (!byAgent[name]) byAgent[name] = { dispatches: 0, successes: 0, rate: 0, avgLatencyMs: 0 }
    byAgent[name].dispatches++
    if (d.success) byAgent[name].successes++
    byAgent[name].avgLatencyMs += (d.latencyMs || 0)
  }
  for (const k of Object.keys(byAgent)) {
    byAgent[k].rate = byAgent[k].dispatches > 0 ? byAgent[k].successes / byAgent[k].dispatches : 1
    byAgent[k].avgLatencyMs = byAgent[k].dispatches > 0 ? Math.round(byAgent[k].avgLatencyMs / byAgent[k].dispatches) : 0
  }

  // ─── System Error Rate (infrastructure only) ───────────────
  const chatTraces = await prisma.telemetryTrace.findMany({
    where: { userId, pipeline: 'chat', createdAt: { gte: since } },
    select: { status: true, latencyMs: true, metadata: true },
  })
  const totalChatResponses = chatTraces.length
  const fallbackChats = chatTraces.filter(t => t.status === 'fallback').length
  const errorChats = chatTraces.filter(t => t.status === 'error').length

  // ═══════════════════════════════════════════════════════════
  // PILLAR 2: REASONING RELIABILITY
  // ═══════════════════════════════════════════════════════════

  // ─── Routing Precision (candidate score analysis) ──────────
  const routingDecisions = await prisma.routingDecision.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { outcome: true, candidateScores: true, confidence: true, selectedAgentId: true },
  })

  let withCandidateScores = 0
  let sumSelectedScore = 0
  let sumBestScore = 0
  let sumScoreGap = 0
  let sumConfidence = 0

  const routingPositive = routingDecisions.filter(r => r.outcome === 'positive').length
  const routingNegative = routingDecisions.filter(r => r.outcome === 'negative').length
  const routingNeutral = routingDecisions.filter(r => r.outcome === 'neutral').length
  const routingUnrated = routingDecisions.filter(r => !r.outcome).length

  for (const rd of routingDecisions) {
    sumConfidence += rd.confidence

    if (rd.candidateScores) {
      try {
        const candidates = JSON.parse(rd.candidateScores) as Array<{ agentId: string; score: number }>
        if (candidates.length > 0) {
          withCandidateScores++
          const bestScore = Math.max(...candidates.map(c => c.score))
          const selectedCandidate = candidates.find(c => c.agentId === rd.selectedAgentId)
          const selectedScore = selectedCandidate?.score ?? 0
          sumSelectedScore += selectedScore
          sumBestScore += bestScore
          sumScoreGap += (bestScore - selectedScore)
        }
      } catch { /* malformed JSON — skip */ }
    }
  }

  // ─── Memory Utilization ────────────────────────────────────
  // Pull from chat trace metadata where we now log memory utilization signals
  let totalMemoriesRetrieved = 0
  let totalMemoriesReferenced = 0
  let sumSimilarity = 0
  let sumImportance = 0
  let similarityCount = 0
  let importanceCount = 0
  let memRetrievalCount = 0

  for (const t of chatTraces) {
    if (t.metadata) {
      try {
        const meta = JSON.parse(t.metadata)
        // New instrumented fields
        if (typeof meta.memoriesRetrieved === 'number') {
          memRetrievalCount++
          totalMemoriesRetrieved += meta.memoriesRetrieved
          totalMemoriesReferenced += (meta.memoriesReferenced ?? 0)
        }
        if (meta.avgSimilarity != null && meta.avgSimilarity > 0) {
          sumSimilarity += meta.avgSimilarity
          similarityCount++
        }
        if (meta.avgImportance != null && meta.avgImportance > 0) {
          sumImportance += meta.avgImportance
          importanceCount++
        }
      } catch { /* skip malformed */ }
    }
  }

  // Also check legacy memory-pipeline traces
  const memoryTraces = await prisma.telemetryTrace.findMany({
    where: { userId, pipeline: 'memory', createdAt: { gte: since } },
    select: { metadata: true },
  })
  for (const t of memoryTraces) {
    if (t.metadata) {
      try {
        const meta = JSON.parse(t.metadata)
        if (meta.avgSimilarity && similarityCount === 0) { sumSimilarity += meta.avgSimilarity; similarityCount++ }
        if (meta.avgImportance && importanceCount === 0) { sumImportance += meta.avgImportance; importanceCount++ }
      } catch {}
    }
  }

  // ─── Reasoning Drift (conversation pattern analysis) ──────
  // Analyze recent user messages for correction/clarification signals
  const recentConversations = await prisma.conversation.findMany({
    where: { userId, updatedAt: { gte: since } },
    select: { id: true },
    take: 100,
  })

  let totalUserMessages = 0
  let correctionSignals = 0
  let conversationsWithClarifications = 0

  if (recentConversations.length > 0) {
    const convIds = recentConversations.map(c => c.id)
    const userMessages = await prisma.message.findMany({
      where: {
        conversationId: { in: convIds },
        role: 'user',
        createdAt: { gte: since },
      },
      select: { content: true, conversationId: true },
      take: 500, // cap to prevent huge queries
    })

    totalUserMessages = userMessages.length
    const convClarifications = new Set<string>()

    for (const msg of userMessages) {
      if (isCorrection(msg.content)) {
        correctionSignals++
      }
      if (isClarification(msg.content)) {
        convClarifications.add(msg.conversationId)
      }
    }
    conversationsWithClarifications = convClarifications.size
  }

  // ═══════════════════════════════════════════════════════════
  // PILLAR 3: EXECUTION RELIABILITY
  // ═══════════════════════════════════════════════════════════

  // ─── Workflow Completion ───────────────────────────────────
  const delegatedTasks = await prisma.task.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { status: true },
  })
  const totalDelegated = delegatedTasks.length
  const completedTasks = delegatedTasks.filter(t => t.status === 'completed').length

  // ─── Decision Quality ──────────────────────────────────────
  // Reversals: tasks that were completed but then changed back
  // (proxy: tasks with status != 'completed' but executedAt is set — means it ran, then got reopened)
  const reversedTasks = await prisma.task.count({
    where: {
      userId,
      createdAt: { gte: since },
      executedAt: { not: null },
      status: { notIn: ['completed', 'archived'] },
    },
  })

  // Confidence calibration: compare avg confidence of successful vs failed dispatches
  let confCalibration = 0.5 // neutral default
  if (totalDispatches > 0) {
    const successConfidences = routingDecisions.filter(r => r.outcome === 'positive').map(r => r.confidence)
    const failConfidences = routingDecisions.filter(r => r.outcome === 'negative').map(r => r.confidence)
    const avgSuccessConf = successConfidences.length > 0
      ? successConfidences.reduce((a, b) => a + b, 0) / successConfidences.length : 0
    const avgFailConf = failConfidences.length > 0
      ? failConfidences.reduce((a, b) => a + b, 0) / failConfidences.length : 0
    // Good calibration: high confidence → success, low confidence → failure
    if (successConfidences.length > 0 && failConfidences.length > 0) {
      confCalibration = Math.min(1, Math.max(0, (avgSuccessConf - avgFailConf + 1) / 2))
    } else if (successConfidences.length > 0) {
      confCalibration = avgSuccessConf
    }
  }

  // ─── Decision Latency ──────────────────────────────────────
  const allLatencies = [
    ...dispatches.map(d => d.latencyMs).filter((l): l is number => l !== null),
    ...chatTraces.map(t => t.latencyMs),
  ].filter(l => l > 0).sort((a, b) => a - b)

  const avgMs = allLatencies.length > 0 ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length) : 0
  const p50Ms = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.5)] : 0
  const p95Ms = allLatencies.length > 0 ? allLatencies[Math.floor(allLatencies.length * 0.95)] : 0

  // ═══════════════════════════════════════════════════════════
  // COMPOSITE SCORES (0-100)
  // ═══════════════════════════════════════════════════════════

  const toolSuccessRate = totalToolCalls > 0 ? 1 - (toolFailures / totalToolCalls) : 1
  const agentRate = totalDispatches > 0 ? dispatchSuccesses / totalDispatches : 1
  const sysErrorRate = totalChatResponses > 0 ? (fallbackChats + errorChats) / totalChatResponses : 0

  const operationalScore = Math.round(
    (toolSuccessRate * 30 + agentRate * 40 + (1 - sysErrorRate) * 30)
  )

  const routingPrecisionScore = withCandidateScores > 0
    ? Math.max(0, 100 - (sumScoreGap / withCandidateScores) * 100)
    : (routingPositive + routingNegative > 0 ? (routingPositive / (routingPositive + routingNegative)) * 100 : 100)
  const memUtilRate = totalMemoriesRetrieved > 0 ? totalMemoriesReferenced / totalMemoriesRetrieved : 0
  const corrRate = totalUserMessages > 0 ? correctionSignals / totalUserMessages : 0

  const reasoningScore = Math.round(
    (Math.min(100, routingPrecisionScore) * 0.3) +
    ((memRetrievalCount > 0 ? memUtilRate : 0.5) * 100 * 0.4) +
    ((1 - Math.min(1, corrRate * 5)) * 100 * 0.3) // amplify correction rate — 20% corrections = 0 reasoning score
  )

  const completionRate = totalDelegated > 0 ? completedTasks / totalDelegated : 0
  // Latency score: sub-3s = 100, 3-10s = linear decay, >10s = low
  const latencyScore = p50Ms > 0
    ? Math.max(0, Math.min(100, p50Ms <= 3000 ? 100 : 100 - ((p50Ms - 3000) / 70)))
    : 50 // no data = neutral

  const executionScore = Math.round(
    (completionRate * 100 * 0.35) +
    (confCalibration * 100 * 0.35) +
    (latencyScore * 0.3)
  )

  const overallScore = Math.round((operationalScore + reasoningScore + executionScore) / 3)

  return {
    period,
    since: since.toISOString(),

    operational: {
      toolSuccessRate: {
        totalCalls: totalToolCalls,
        failures: toolFailures,
        rate: toolSuccessRate,
        byTool,
      },
      agentDispatchRate: {
        totalDispatches,
        successes: dispatchSuccesses,
        failures: totalDispatches - dispatchSuccesses,
        rate: agentRate,
        byAgent,
      },
      systemErrorRate: {
        totalResponses: totalChatResponses,
        fallbackCount: fallbackChats,
        errorCount: errorChats,
        rate: totalChatResponses > 0 ? (fallbackChats + errorChats) / totalChatResponses : 0,
      },
    },

    reasoning: {
      routingPrecision: {
        total: routingDecisions.length,
        withCandidateScores,
        avgSelectedScore: withCandidateScores > 0 ? Math.round((sumSelectedScore / withCandidateScores) * 100) / 100 : 0,
        avgBestScore: withCandidateScores > 0 ? Math.round((sumBestScore / withCandidateScores) * 100) / 100 : 0,
        avgScoreGap: withCandidateScores > 0 ? Math.round((sumScoreGap / withCandidateScores) * 100) / 100 : 0,
        positive: routingPositive,
        negative: routingNegative,
        neutral: routingNeutral,
        unrated: routingUnrated,
        outcomeRate: (routingPositive + routingNegative) > 0 ? routingPositive / (routingPositive + routingNegative) : 1,
      },
      memoryUtilization: {
        totalRetrievals: memRetrievalCount,
        totalMemoriesRetrieved,
        totalMemoriesReferenced,
        totalMemoriesIgnored: Math.max(0, totalMemoriesRetrieved - totalMemoriesReferenced),
        utilizationRate: totalMemoriesRetrieved > 0 ? Math.round((totalMemoriesReferenced / totalMemoriesRetrieved) * 100) / 100 : 0,
        avgSimilarityScore: similarityCount > 0 ? Math.round((sumSimilarity / similarityCount) * 100) / 100 : 0,
        avgImportance: importanceCount > 0 ? Math.round((sumImportance / importanceCount) * 10) / 10 : 0,
      },
      reasoningDrift: {
        totalConversations: recentConversations.length,
        clarificationRate: recentConversations.length > 0
          ? Math.round((conversationsWithClarifications / recentConversations.length) * 100) / 100 : 0,
        correctionSignals,
        totalUserMessages,
        correctionRate: totalUserMessages > 0
          ? Math.round((correctionSignals / totalUserMessages) * 1000) / 1000 : 0,
      },
    },

    execution: {
      workflowCompletion: {
        totalDelegated,
        completed: completedTasks,
        rate: totalDelegated > 0 ? completedTasks / totalDelegated : 0,
      },
      decisionQuality: {
        totalDecisions: routingDecisions.length,
        reversals: reversedTasks,
        clarificationRequests: conversationsWithClarifications,
        avgConfidence: routingDecisions.length > 0
          ? Math.round((sumConfidence / routingDecisions.length) * 100) / 100 : 0,
        confidenceCalibration: Math.round(confCalibration * 100) / 100,
      },
      decisionLatency: {
        avgMs,
        p50Ms,
        p95Ms,
        samples: allLatencies.length,
      },
    },

    compositeScores: {
      operational: operationalScore,
      reasoning: reasoningScore,
      execution: executionScore,
      overall: overallScore,
    },
  }
}
