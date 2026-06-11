/**
 * Core browser automation engine — v3 with constrained DSL + semantic safety.
 *
 * Architecture:
 *   1. LLM generates a JSON action plan (not raw Puppeteer)
 *   2. Action plan is validated against the DSL schema
 *   3. Mutation risk classified per-step AND per-sequence
 *   4. Plan compiled into safe executor with post-nav SSRF checks
 *   5. Execution with risk-aware retry:
 *      - navigation/extraction = retryable
 *      - low-risk mutation = retryable once
 *      - medium/high = never retried
 *      - critical = never retried + flagged
 *   6. Semantic idempotency: plan-structure fingerprint, not just time window
 *   7. Partial results persisted at each phase boundary
 *
 * v3 improvements over v2:
 *   - Mutation risk levels (safe/low/medium/high/critical)
 *   - Sequence-level escalation (credential + submit = critical)
 *   - Semantic idempotency key = hash(userId + normalizedTask + actionTypes + targetUrl)
 *   - Risk-scaled dedup windows: extraction=1min, low-mutation=5min, high/critical=30min
 *   - Post-navigation SSRF validation in compiled scripts
 */

import { prisma } from '@/lib/prisma'
import { executeBrowserScript, takeScreenshot } from '@/lib/browserless'
import {
  validateActionPlan,
  compileActionPlan,
  ACTION_PLAN_PROMPT,
  type ActionStep,
  type MutationRisk,
  type ValidationResult,
} from '@/lib/automation-dsl'
import { routeForBackground, getBackgroundFallback, buildHeaders, buildRequestBody } from '@/lib/model-router'
import crypto from 'crypto'

const MAX_TASK_LENGTH = 2000
const MAX_URL_LENGTH = 2048
const SCRIPT_GEN_TIMEOUT_MS = 30_000

export interface AutomationResult {
  success: boolean
  automationId: string
  data?: any
  screenshot?: string | null
  error?: string | null
  errorType?: string | null
  durationMs?: number
  stepsCompleted?: number
  stepsTotal?: number
  executionPhase?: string
  mutationRisk?: MutationRisk
  hasCriticalSequence?: boolean
}

// ─── Input Validation ───────────────────────────────────────────

function validateInput(task: string, url?: string): { valid: boolean; error?: string } {
  if (!task || typeof task !== 'string') {
    return { valid: false, error: 'Task description is required' }
  }
  if (task.trim().length < 10) {
    return { valid: false, error: 'Task description is too vague. Please provide more detail.' }
  }
  if (task.length > MAX_TASK_LENGTH) {
    return { valid: false, error: `Task description exceeds ${MAX_TASK_LENGTH} characters` }
  }
  if (url) {
    if (url.length > MAX_URL_LENGTH) {
      return { valid: false, error: 'URL is too long' }
    }
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
      const blocked = ['localhost', '127.0.0.1', '0.0.0.0']
      if (blocked.includes(parsed.hostname)) {
        return { valid: false, error: 'Internal URLs are not allowed' }
      }
    } catch {
      return { valid: false, error: 'Invalid URL format' }
    }
  }
  return { valid: true }
}

// ─── Semantic Idempotency ─────────────────────────────────────────

/**
 * Risk-scaled dedup windows.
 * The higher the mutation risk, the longer the dedup window,
 * because high-risk duplicates are more dangerous.
 */
const DEDUP_WINDOWS: Record<MutationRisk, number> = {
  safe: 60_000,        // 1 minute — extraction-only plans
  low: 5 * 60_000,     // 5 minutes — scroll/tab
  medium: 10 * 60_000, // 10 minutes — standard clicks/types
  high: 30 * 60_000,   // 30 minutes — login/checkout/payment
  critical: 60 * 60_000, // 1 hour — credential+submit sequences
}

/**
 * Pre-plan idempotency key: based on task text + URL.
 * Used before the plan is generated (fast dedup).
 */
function generatePrePlanIdempotencyKey(userId: string, task: string, url?: string): string {
  const normalized = task.trim().toLowerCase().replace(/\s+/g, ' ')
  const payload = `v3:pre:${userId}:${normalized}:${url ?? ''}`
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

/**
 * Post-plan semantic idempotency key: based on action plan structure.
 * This catches semantically identical plans even if task wording differs.
 * Fingerprint = hash(userId + URL + sorted action types + target selectors)
 */
function generateSemanticIdempotencyKey(userId: string, plan: ActionStep[], url?: string): string {
  const actionSignature = plan.map(s => {
    const selectorPart = s.params.selector ? `:${s.params.selector}` : ''
    const urlPart = s.params.url ? `:${s.params.url}` : ''
    return `${s.action}${selectorPart}${urlPart}`
  }).join('|')
  const payload = `v3:sem:${userId}:${url ?? ''}:${actionSignature}`
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

async function checkIdempotency(
  prePlanKey: string,
  maxRisk: MutationRisk
): Promise<string | null> {
  const window = DEDUP_WINDOWS[maxRisk] ?? DEDUP_WINDOWS.medium
  try {
    const existing = await prisma.browserAutomation.findFirst({
      where: {
        idempotencyKey: prePlanKey,
        status: { in: ['running', 'completed'] },
        createdAt: { gte: new Date(Date.now() - window) },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    })
    return existing?.id ?? null
  } catch {
    return null
  }
}

async function checkSemanticIdempotency(
  semanticKey: string,
  maxRisk: MutationRisk
): Promise<string | null> {
  // Only check semantic dedup for medium+ risk
  if (maxRisk === 'safe' || maxRisk === 'low') return null

  const window = DEDUP_WINDOWS[maxRisk] ?? DEDUP_WINDOWS.medium
  try {
    // We store the semantic key in actionPlan metadata
    // Search by looking at recent automations with same semantic fingerprint
    const existing = await prisma.browserAutomation.findFirst({
      where: {
        partialResult: { contains: semanticKey }, // Stored in partialResult metadata
        status: { in: ['running', 'completed'] },
        createdAt: { gte: new Date(Date.now() - window) },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    })
    return existing?.id ?? null
  } catch {
    return null
  }
}

// ─── Main Execution ───────────────────────────────────────────

export async function runBrowserAutomation(
  userId: string,
  task: string,
  url?: string,
  existingAutomationId?: string
): Promise<AutomationResult> {
  // Validate input
  const inputCheck = validateInput(task, url)
  if (!inputCheck.valid) {
    return {
      success: false,
      automationId: existingAutomationId ?? '',
      error: inputCheck.error,
      errorType: 'validation_error',
    }
  }

  // Pre-plan idempotency check (fast, before LLM call)
  // Uses 'medium' risk as default since we don't know the plan yet
  const prePlanKey = generatePrePlanIdempotencyKey(userId, task, url)
  if (!existingAutomationId) {
    const dupId = await checkIdempotency(prePlanKey, 'medium')
    if (dupId) {
      console.log(`[BrowserAutomate] Pre-plan duplicate detected: ${dupId}`)
      const existing = await prisma.browserAutomation.findUnique({ where: { id: dupId } })
      return {
        success: existing?.status === 'completed',
        automationId: dupId,
        data: existing?.result ? JSON.parse(existing.result) : null,
        error: existing?.status === 'running' ? 'This automation is already running' : (existing?.error ?? null),
        errorType: 'duplicate',
      }
    }
  }

  // Create or update automation record
  let autoId = existingAutomationId
  if (!autoId) {
    const auto = await prisma.browserAutomation.create({
      data: {
        userId,
        taskDesc: task.slice(0, MAX_TASK_LENGTH),
        targetUrl: url?.slice(0, MAX_URL_LENGTH) ?? null,
        status: 'running',
        executionPhase: 'planning',
        idempotencyKey: prePlanKey,
      },
    })
    autoId = auto.id
  } else {
    const prev = await prisma.browserAutomation.findUnique({ where: { id: autoId }, select: { retryCount: true } })
    await prisma.browserAutomation.update({
      where: { id: autoId },
      data: {
        status: 'running',
        error: null,
        executionPhase: 'planning',
        retryCount: (prev?.retryCount ?? 0) + 1,
      },
    })
  }

  try {
    // ─── Phase 1: Planning — LLM generates structured action plan ───
    await updatePhase(autoId, 'planning')
    const rawPlan = await generateActionPlan(task, url)

    // Validate the plan against DSL schema
    const planValidation: ValidationResult = validateActionPlan(rawPlan)
    if (!planValidation.valid || !planValidation.sanitizedPlan) {
      const errorMsg = `Action plan validation failed: ${planValidation.errors.join('; ')}`
      console.warn(`[BrowserAutomate] ${errorMsg}`)
      await prisma.browserAutomation.update({
        where: { id: autoId },
        data: {
          status: 'failed',
          actionPlan: JSON.stringify(rawPlan),
          error: 'Failed to generate a valid automation plan. Try rephrasing your task.',
          errorType: 'validation_error',
          executionPhase: 'planning',
        },
      })
      return {
        success: false,
        automationId: autoId,
        error: 'Failed to generate a valid automation plan. Try rephrasing your task with more specific selectors or URLs.',
        errorType: 'validation_error',
        executionPhase: 'planning',
      }
    }

    const plan = planValidation.sanitizedPlan
    const maxRisk = planValidation.maxMutationRisk ?? 'safe'
    const hasCritical = planValidation.hasCriticalSequence ?? false

    // ─── Post-plan semantic idempotency check ───
    const semanticKey = generateSemanticIdempotencyKey(userId, plan, url)
    if (!existingAutomationId) {
      const semDupId = await checkSemanticIdempotency(semanticKey, maxRisk)
      if (semDupId) {
        console.log(`[BrowserAutomate] Semantic duplicate detected (risk=${maxRisk}): ${semDupId}`)
        // Don't fail the current record — mark it as deduped
        await prisma.browserAutomation.update({
          where: { id: autoId },
          data: {
            status: 'failed',
            error: `Duplicate automation detected (semantic match, window=${Math.round(DEDUP_WINDOWS[maxRisk] / 60_000)}min). Previous run: ${semDupId}`,
            errorType: 'duplicate',
          },
        })
        const existing = await prisma.browserAutomation.findUnique({ where: { id: semDupId } })
        return {
          success: existing?.status === 'completed',
          automationId: semDupId,
          data: existing?.result ? JSON.parse(existing.result) : null,
          error: `This automation was already executed within the last ${Math.round(DEDUP_WINDOWS[maxRisk] / 60_000)} minutes (risk level: ${maxRisk}).`,
          errorType: 'duplicate',
          mutationRisk: maxRisk,
        }
      }
    }

    // Save validated plan with semantic key for future dedup
    await prisma.browserAutomation.update({
      where: { id: autoId },
      data: {
        actionPlan: JSON.stringify(plan),
        stepsTotal: plan.length,
        stepsCompleted: 0,
        idempotencyKey: prePlanKey,
        // Store semantic key in partialResult for dedup lookups
        // (will be overwritten with actual partial results during execution)
        partialResult: JSON.stringify({ _semanticKey: semanticKey, _maxRisk: maxRisk }),
      },
    })

    // ─── Phase 2: Compile plan into safe executor script ───
    const script = compileActionPlan(plan)
    await prisma.browserAutomation.update({
      where: { id: autoId },
      data: { script },
    })

    // Log risk classification
    const riskBreakdown = plan.reduce((acc, s) => {
      acc[s.mutationRisk] = (acc[s.mutationRisk] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`[BrowserAutomate] Plan: ${plan.length} steps, maxRisk=${maxRisk}, critical=${hasCritical}, breakdown=${JSON.stringify(riskBreakdown)}`)

    // Determine execution phase label
    const startPhase = plan[0]?.phase ?? 'navigating'
    await updatePhase(autoId, startPhase === 'navigation' ? 'navigating' : 'acting')

    // ─── Phase 3: Execute with risk-aware retry ───
    console.log(`[BrowserAutomate] Executing ${plan.length}-step plan: ${task.slice(0, 80)}...`)
    let result = await executeBrowserScript(script, { task, url })

    // Risk-aware retry logic:
    //  - If ALL steps are safe/low risk AND failure was timeout → retry entire plan
    //  - If plan has medium+ mutations → only retry if failure was BEFORE first mutation
    //  - If plan has high/critical mutations → never retry
    if (!result.success && result.errorType === 'timeout') {
      const firstMutationIdx = plan.findIndex(s => s.phase === 'mutation' && s.mutationRisk !== 'low')
      const stepsCompleted = result.data?.stepsCompleted ?? 0

      const canRetry =
        // No mutations at all → always retryable
        (firstMutationIdx === -1) ||
        // Failure happened before reaching first significant mutation
        (stepsCompleted < firstMutationIdx)

      if (canRetry && maxRisk !== 'high' && maxRisk !== 'critical') {
        console.log(`[BrowserAutomate] Retrying (failed before mutation step, risk=${maxRisk})...`)
        await updatePhase(autoId, 'navigating')
        result = await executeBrowserScript(script, { task, url })
      } else {
        console.log(`[BrowserAutomate] NOT retrying: risk=${maxRisk}, stepsCompleted=${stepsCompleted}, firstMutation=${firstMutationIdx}`)
      }
    }

    // Parse step completion from result
    const resultData = result.data
    const stepsCompleted = resultData?.stepsCompleted ?? (result.success ? plan.length : 0)

    // ─── Phase 4: Optional screenshot ───
    let screenshotUrl: string | undefined
    if (url && result.success) {
      await updatePhase(autoId, 'screenshot')
      try {
        const screenshotResult = await takeScreenshot(url)
        if (screenshotResult.success) {
          screenshotUrl = screenshotResult.screenshot
        }
      } catch {
        // Non-critical
      }
    }

    // ─── Phase 5: Persist results ───
    const isPartial = !result.success && stepsCompleted > 0
    const finalStatus = result.success ? 'completed' : isPartial ? 'partial' : 'failed'
    const ssrfBlocked = result.data?.errorType === 'ssrf_blocked' || result.error?.includes('SSRF:')

    const updateData: Record<string, any> = {
      status: finalStatus,
      result: JSON.stringify(resultData?.data ?? resultData ?? null),
      durationMs: result.durationMs ?? null,
      error: result.error ?? null,
      errorType: ssrfBlocked ? 'ssrf_blocked' : (result.errorType ?? null),
      executionPhase: result.success ? 'completed' : (ssrfBlocked ? 'ssrf_blocked' : (result.errorType ?? 'failed')),
      stepsCompleted,
      // Preserve semantic key in partialResult alongside actual partial data
      partialResult: JSON.stringify({
        _semanticKey: semanticKey,
        _maxRisk: maxRisk,
        _hasCritical: hasCritical,
        ...(isPartial && resultData?.data ? { data: resultData.data } : {}),
      }),
    }
    if (screenshotUrl) {
      updateData.screenshotUrl = screenshotUrl
    }

    await prisma.browserAutomation.update({
      where: { id: autoId },
      data: updateData,
    })

    return {
      success: result.success,
      automationId: autoId,
      data: resultData?.data ?? resultData,
      screenshot: screenshotUrl ?? null,
      error: result.error ?? null,
      errorType: ssrfBlocked ? 'ssrf_blocked' : (result.errorType ?? null),
      durationMs: result.durationMs,
      stepsCompleted,
      stepsTotal: plan.length,
      executionPhase: finalStatus,
      mutationRisk: maxRisk,
      hasCriticalSequence: hasCritical,
    }
  } catch (error: any) {
    console.error('[BrowserAutomate] Error:', error?.message)
    await prisma.browserAutomation.update({
      where: { id: autoId },
      data: {
        status: 'failed',
        error: error?.message ?? 'Unknown execution error',
        errorType: 'unknown',
      },
    }).catch(() => {})

    return {
      success: false,
      automationId: autoId,
      error: error?.message ?? 'Automation failed',
    }
  }
}

async function updatePhase(id: string, phase: string): Promise<void> {
  await prisma.browserAutomation.update({
    where: { id },
    data: { executionPhase: phase },
  }).catch(() => {})
}

// ─── Action Plan Generation via LLM ─────────────────────────────

async function generateActionPlan(task: string, url?: string): Promise<any> {
  const userPrompt = `Task: ${task}
${url ? `Target URL: ${url}` : 'No specific URL — determine the best URL.'}

Respond with ONLY a JSON array. No markdown fences, no explanation.`

  let route = routeForBackground()
  const messages = [
    { role: 'system' as const, content: ACTION_PLAN_PROMPT },
    { role: 'user' as const, content: userPrompt },
  ]

  let response: Response | null = null
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    try {
      const headers = buildHeaders(route)
      const body = buildRequestBody(route, messages, { maxTokens: 2000 })
      console.log(`[BrowserAutomate] Plan gen via ${route.tier}/${route.model} (attempt ${attempts})`)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SCRIPT_GEN_TIMEOUT_MS)

      try {
        response = await fetch(route.apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      if (response.ok) break

      console.error(`[BrowserAutomate] ${route.model} failed: ${response.status}`)
      const fallback = getBackgroundFallback(route.model)
      if (fallback) {
        route = fallback
      } else {
        break
      }
    } catch (err: any) {
      console.error(`[BrowserAutomate] ${route.model} error:`, err?.message)
      const fallback = getBackgroundFallback(route.model)
      if (fallback) {
        route = fallback
      } else {
        break
      }
    }
  }

  if (!response?.ok) {
    throw new Error('Failed to generate action plan — all models failed')
  }

  const data = await response.json()
  let content = data?.choices?.[0]?.message?.content ?? ''

  // Clean up: remove markdown fences if present
  content = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  // Try direct parse first
  try {
    return JSON.parse(content)
  } catch {
    // Try to extract JSON array from surrounding text
    const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0])
      } catch { /* fall through */ }
    }
    // Try to extract JSON object
    const objMatch = content.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0])
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch { /* fall through */ }
    }
    console.error('[BrowserAutomate] Failed to parse action plan JSON:', content.slice(0, 300))
    throw new Error('LLM returned invalid JSON for action plan')
  }
}
