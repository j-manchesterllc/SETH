/**
 * Automation DSL — Constrained Action Plan System (v2)
 *
 * Instead of generating arbitrary Puppeteer scripts, the LLM produces
 * a structured JSON action plan using whitelisted primitives.
 * This plan is validated, then compiled into a safe executor script.
 *
 * Trust boundary: LLM → JSON schema → validated plan → compiled executor
 * vs. old: LLM → arbitrary code → execute (dangerous)
 *
 * Action types are categorized into phases:
 *   - NAVIGATION: retryable, no side effects (goto, waitFor)
 *   - EXTRACTION: retryable, read-only (extract, screenshot)
 *   - MUTATION: NOT retried blindly (click, type, select)
 *
 * v2 improvements:
 *   - Semantic mutation detection (login/checkout/payment/MFA patterns)
 *   - Selector complexity constraints
 *   - Dangerous target detection (click on payment/submit/delete buttons)
 *   - Sequence-level analysis (credential entry → submit = elevated mutation)
 *   - Post-navigation SSRF validation injected into compiled scripts
 */

// ─── Action Type Definitions ──────────────────────────────────────────

export type ActionPhase = 'navigation' | 'extraction' | 'mutation'

/**
 * Mutation risk level — drives retry and idempotency behavior.
 *  - 'safe':     action itself has no side effects (navigation, extraction)
 *  - 'low':      mutation unlikely to cause damage (scroll, press Tab)
 *  - 'medium':   standard mutation (click, type)
 *  - 'high':     detected as financially/auth significant (checkout, login, delete)
 *  - 'critical': sequence-level escalation (credential entry + submit)
 */
export type MutationRisk = 'safe' | 'low' | 'medium' | 'high' | 'critical'

export interface ActionStep {
  id: number
  action: ActionType
  phase: ActionPhase
  params: Record<string, any>
  description: string
  retryable: boolean
  mutationRisk: MutationRisk
}

export type ActionType =
  // Navigation phase — retryable
  | 'goto'
  | 'wait_for_selector'
  | 'wait_for_navigation'
  | 'wait_for_timeout'
  // Extraction phase — retryable
  | 'extract_text'
  | 'extract_attribute'
  | 'extract_list'
  | 'extract_table'
  | 'evaluate_js'
  | 'screenshot'
  // Mutation phase — NOT retried
  | 'click'
  | 'type_text'
  | 'select_option'
  | 'press_key'
  | 'scroll'

// Phase classification
const ACTION_PHASES: Record<ActionType, ActionPhase> = {
  goto: 'navigation',
  wait_for_selector: 'navigation',
  wait_for_navigation: 'navigation',
  wait_for_timeout: 'navigation',
  extract_text: 'extraction',
  extract_attribute: 'extraction',
  extract_list: 'extraction',
  extract_table: 'extraction',
  evaluate_js: 'extraction',
  screenshot: 'extraction',
  click: 'mutation',
  type_text: 'mutation',
  select_option: 'mutation',
  press_key: 'mutation',
  scroll: 'mutation',
}

// Retryability by phase
const RETRYABLE_PHASES: Record<ActionPhase, boolean> = {
  navigation: true,
  extraction: true,
  mutation: false, // Never blindly retry mutations
}

// Max allowed values
const MAX_STEPS = 20
const MAX_TIMEOUT_MS = 30_000
const MAX_SELECTOR_LENGTH = 500
const MAX_TEXT_LENGTH = 1000
const MAX_SELECTOR_DEPTH = 8 // max CSS combinator depth
const MAX_JS_EXPRESSION_LENGTH = 2000

// Blocked JavaScript patterns in evaluate_js
const BLOCKED_JS_PATTERNS = [
  /fetch\s*\(/i,           // No network requests from evaluate
  /XMLHttpRequest/i,
  /navigator\.sendBeacon/i,
  /window\.open/i,
  /document\.cookie/i,     // No cookie access
  /localStorage/i,
  /sessionStorage/i,
  /indexedDB/i,
  /\.postMessage\s*\(/i,   // No cross-frame messaging
  /eval\s*\(/i,            // No eval inside evaluate
  /Function\s*\(/i,        // No dynamic function construction
  /import\s*\(/i,          // No dynamic imports
  /require\s*\(/i,         // No require
]

// ─── Semantic Mutation Detection ──────────────────────────────────────

/**
 * Patterns that indicate a click target has financial/auth significance.
 * A "click" on these selectors is classified as HIGH mutation risk.
 */
const DANGEROUS_CLICK_PATTERNS = [
  // Payment/checkout
  /buy|purchase|checkout|pay(?:ment)?|order|confirm(?:ation)?|place.?order/i,
  /add.?to.?cart|cart/i,
  // Account/auth
  /log.?in|sign.?in|sign.?up|register|submit|auth/i,
  /log.?out|sign.?out|deactivat|delet.?account/i,
  // Destructive
  /delet|remov|cancel|revok|unsubscrib|terminat/i,
  // Financial
  /transfer|send.?money|withdraw|deposit|subscribe/i,
  // MFA/verification
  /verif|confirm|approv|mfa|otp|two.?factor|2fa/i,
]

/**
 * Patterns for type_text that indicate credential entry (HIGH risk).
 */
const CREDENTIAL_INPUT_PATTERNS = [
  /password|passwd|secret|pin|otp|code|token|mfa/i,
  /credit.?card|card.?number|cvv|cvc|expir/i,
  /ssn|social.?security|account.?number|routing/i,
]

/**
 * Low-risk mutation keys — these are mutations but unlikely to cause side effects.
 */
const LOW_RISK_KEYS = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']

function classifySingleStepRisk(step: { action: string; params?: Record<string, any>; description?: string }): MutationRisk {
  const action = step.action
  const params = step.params ?? {}
  const desc = (step.description ?? '').toLowerCase()
  const selector = (params.selector ?? '').toLowerCase()
  const text = (params.text ?? '').toLowerCase()
  const combined = `${selector} ${desc} ${text}`

  if (ACTION_PHASES[action as ActionType] !== 'mutation') return 'safe'

  // Scroll is always low risk
  if (action === 'scroll') return 'low'

  // press_key with navigation-only keys is low risk
  if (action === 'press_key') {
    return LOW_RISK_KEYS.includes(params.key) ? 'low' : 'medium'
  }

  // type_text into credential fields is high risk
  if (action === 'type_text') {
    if (CREDENTIAL_INPUT_PATTERNS.some(p => p.test(combined))) return 'high'
    return 'medium'
  }

  // click — check against dangerous patterns
  if (action === 'click') {
    if (DANGEROUS_CLICK_PATTERNS.some(p => p.test(combined))) return 'high'
    return 'medium'
  }

  // select_option is generally medium
  return 'medium'
}

/**
 * Sequence-level mutation escalation.
 * Detects patterns like:
 *   type_text(password field) + click(submit) → CRITICAL
 *   type_text(card number) + click(pay) → CRITICAL
 *   click(delete) after any confirmation → CRITICAL
 */
function classifySequenceRisk(steps: ActionStep[]): ActionStep[] {
  const escalated = [...steps]
  
  for (let i = 0; i < escalated.length; i++) {
    const step = escalated[i]
    if (step.mutationRisk !== 'high') continue

    // Look backward: if a high-risk type_text precedes a high-risk click,
    // both escalate to CRITICAL
    if (step.action === 'click' && step.mutationRisk === 'high') {
      // Check if any preceding step within 3 steps is a high-risk type_text
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (escalated[j].action === 'type_text' && escalated[j].mutationRisk === 'high') {
          escalated[j] = { ...escalated[j], mutationRisk: 'critical', retryable: false }
          escalated[i] = { ...escalated[i], mutationRisk: 'critical', retryable: false }
        }
      }
    }

    // Forward look: if a destructive click follows a confirmation click within 2 steps
    if (step.action === 'click' && i + 1 < escalated.length) {
      const next = escalated[i + 1]
      if (next.action === 'click' && next.mutationRisk === 'high') {
        escalated[i + 1] = { ...escalated[i + 1], mutationRisk: 'critical', retryable: false }
      }
    }
  }

  return escalated
}

// ─── Selector Complexity Constraints ──────────────────────────────────

/**
 * Validate selector complexity to prevent:
 *  - Overly deep selectors that indicate fragile scraping
 *  - Selectors with JS execution (attr selectors with special chars)
 *  - Empty or wildcard-only selectors
 */
function validateSelector(selector: string): string[] {
  const errors: string[] = []
  const trimmed = selector.trim()

  if (!trimmed) {
    errors.push('Selector cannot be empty')
    return errors
  }

  if (trimmed.length > MAX_SELECTOR_LENGTH) {
    errors.push(`Selector exceeds ${MAX_SELECTOR_LENGTH} chars`)
  }

  // Depth check: count combinators (space, >, +, ~)
  const combinators = trimmed.split(/\s+|>|\+|~/).filter(Boolean).length
  if (combinators > MAX_SELECTOR_DEPTH) {
    errors.push(`Selector depth ${combinators} exceeds max ${MAX_SELECTOR_DEPTH}. Simplify the selector.`)
  }

  // Block wildcard-only selectors (too broad)
  if (trimmed === '*') {
    errors.push('Wildcard-only selector (*) is not allowed — too broad')
  }

  // Block selectors that look like JS injection via attr selectors
  if (/\[.*(?:javascript|expression|eval|url\s*\().*\]/i.test(trimmed)) {
    errors.push('Selector contains suspicious attribute pattern')
  }

  // Block overly broad pseudo-selectors used for exfiltration
  if (/::?(?:before|after)\s*\{/i.test(trimmed)) {
    errors.push('CSS pseudo-element blocks are not valid selectors')
  }

  return errors
}

// ─── Validation ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitizedPlan?: ActionStep[]
  maxMutationRisk?: MutationRisk
  hasCriticalSequence?: boolean
}

export function validateActionPlan(rawPlan: any): ValidationResult {
  const errors: string[] = []

  if (!Array.isArray(rawPlan)) {
    return { valid: false, errors: ['Action plan must be an array of steps'] }
  }

  if (rawPlan.length === 0) {
    return { valid: false, errors: ['Action plan cannot be empty'] }
  }

  if (rawPlan.length > MAX_STEPS) {
    return { valid: false, errors: [`Action plan exceeds maximum of ${MAX_STEPS} steps`] }
  }

  const sanitized: ActionStep[] = []

  for (let i = 0; i < rawPlan.length; i++) {
    const step = rawPlan[i]
    const stepErrors = validateStep(step, i)
    if (stepErrors.length > 0) {
      errors.push(...stepErrors.map(e => `Step ${i + 1}: ${e}`))
      continue
    }

    const phase = ACTION_PHASES[step.action as ActionType]
    const risk = classifySingleStepRisk(step)
    sanitized.push({
      id: i + 1,
      action: step.action as ActionType,
      phase,
      params: sanitizeParams(step.action, step.params ?? {}),
      description: (step.description ?? '').slice(0, 200),
      retryable: RETRYABLE_PHASES[phase],
      mutationRisk: risk,
    })
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Must start with navigation
  if (sanitized.length > 0 && sanitized[0].phase !== 'navigation') {
    errors.push('Action plan must start with a navigation step (goto)')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Sequence-level risk escalation
  const withSequenceRisk = classifySequenceRisk(sanitized)

  // Compute aggregate risk
  const riskLevels: MutationRisk[] = ['safe', 'low', 'medium', 'high', 'critical']
  const maxRiskIdx = Math.max(...withSequenceRisk.map(s => riskLevels.indexOf(s.mutationRisk)))
  const maxMutationRisk = riskLevels[maxRiskIdx] ?? 'safe'
  const hasCriticalSequence = withSequenceRisk.some(s => s.mutationRisk === 'critical')

  return {
    valid: true,
    errors: [],
    sanitizedPlan: withSequenceRisk,
    maxMutationRisk,
    hasCriticalSequence,
  }
}

function validateStep(step: any, index: number): string[] {
  const errors: string[] = []

  if (!step || typeof step !== 'object') {
    errors.push('Step must be an object')
    return errors
  }

  if (!step.action || typeof step.action !== 'string') {
    errors.push('Missing or invalid action type')
    return errors
  }

  if (!(step.action in ACTION_PHASES)) {
    errors.push(`Unknown action type: ${step.action}. Allowed: ${Object.keys(ACTION_PHASES).join(', ')}`)
    return errors
  }

  // Action-specific validation
  const params = step.params ?? {}

  switch (step.action) {
    case 'goto':
      if (!params.url || typeof params.url !== 'string') {
        errors.push('goto requires a url parameter')
      }
      break
    case 'wait_for_selector':
    case 'click':
    case 'extract_text':
    case 'extract_attribute': {
      if (!params.selector || typeof params.selector !== 'string') {
        errors.push(`${step.action} requires a selector parameter`)
      } else {
        const selectorErrors = validateSelector(params.selector)
        errors.push(...selectorErrors)
      }
      break
    }
    case 'type_text':
      if (!params.selector || typeof params.selector !== 'string') {
        errors.push('type_text requires a selector parameter')
      } else {
        const selectorErrors = validateSelector(params.selector)
        errors.push(...selectorErrors)
      }
      if (params.text === undefined || typeof params.text !== 'string') {
        errors.push('type_text requires a text parameter')
      } else if (params.text.length > MAX_TEXT_LENGTH) {
        errors.push(`text exceeds ${MAX_TEXT_LENGTH} chars`)
      }
      break
    case 'evaluate_js':
      if (!params.expression || typeof params.expression !== 'string') {
        errors.push('evaluate_js requires an expression parameter')
      } else {
        if (params.expression.length > MAX_JS_EXPRESSION_LENGTH) {
          errors.push(`evaluate_js expression exceeds ${MAX_JS_EXPRESSION_LENGTH} chars`)
        }
        for (const pattern of BLOCKED_JS_PATTERNS) {
          if (pattern.test(params.expression)) {
            errors.push(`evaluate_js contains blocked pattern: ${pattern.source}`)
            break
          }
        }
      }
      break
    case 'wait_for_timeout':
      if (params.ms && (typeof params.ms !== 'number' || params.ms > MAX_TIMEOUT_MS)) {
        errors.push(`timeout must be a number <= ${MAX_TIMEOUT_MS}ms`)
      }
      break
    case 'extract_list': {
      if (!params.selector || typeof params.selector !== 'string') {
        errors.push('extract_list requires a selector parameter')
      } else {
        const selectorErrors = validateSelector(params.selector)
        errors.push(...selectorErrors)
      }
      break
    }
    case 'extract_table': {
      if (!params.selector || typeof params.selector !== 'string') {
        errors.push('extract_table requires a selector parameter')
      } else {
        const selectorErrors = validateSelector(params.selector)
        errors.push(...selectorErrors)
      }
      break
    }
    case 'select_option': {
      if (!params.selector || typeof params.selector !== 'string') {
        errors.push('select_option requires a selector parameter')
      } else {
        const selectorErrors = validateSelector(params.selector)
        errors.push(...selectorErrors)
      }
      break
    }
    case 'press_key': {
      if (!params.key || typeof params.key !== 'string') {
        errors.push('press_key requires a key parameter')
      } else if (params.key.length > 20) {
        errors.push('press_key key name is too long')
      }
      break
    }
  }

  return errors
}

function sanitizeParams(action: string, params: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}

  switch (action) {
    case 'goto':
      clean.url = String(params.url ?? '').trim()
      clean.waitUntil = params.waitUntil === 'domcontentloaded' ? 'domcontentloaded' : 'networkidle2'
      break
    case 'wait_for_selector':
      clean.selector = String(params.selector ?? '').trim()
      clean.timeout = Math.min(Number(params.timeout) || 10000, MAX_TIMEOUT_MS)
      break
    case 'wait_for_navigation':
      clean.timeout = Math.min(Number(params.timeout) || 15000, MAX_TIMEOUT_MS)
      break
    case 'wait_for_timeout':
      clean.ms = Math.min(Number(params.ms) || 1000, MAX_TIMEOUT_MS)
      break
    case 'click':
      clean.selector = String(params.selector ?? '').trim()
      clean.timeout = Math.min(Number(params.timeout) || 10000, MAX_TIMEOUT_MS)
      break
    case 'type_text':
      clean.selector = String(params.selector ?? '').trim()
      clean.text = String(params.text ?? '').slice(0, MAX_TEXT_LENGTH)
      clean.delay = Math.min(Number(params.delay) || 50, 200)
      clean.clearFirst = Boolean(params.clearFirst)
      break
    case 'select_option':
      clean.selector = String(params.selector ?? '').trim()
      clean.value = String(params.value ?? '')
      break
    case 'press_key':
      clean.key = String(params.key ?? 'Enter')
      break
    case 'scroll':
      clean.direction = params.direction === 'up' ? 'up' : 'down'
      clean.amount = Math.min(Number(params.amount) || 500, 5000)
      break
    case 'extract_text':
      clean.selector = String(params.selector ?? '').trim()
      clean.resultKey = String(params.resultKey ?? `text_${Date.now()}`)
      break
    case 'extract_attribute':
      clean.selector = String(params.selector ?? '').trim()
      clean.attribute = String(params.attribute ?? 'href')
      clean.resultKey = String(params.resultKey ?? `attr_${Date.now()}`)
      break
    case 'extract_list':
      clean.selector = String(params.selector ?? '').trim()
      clean.childSelector = params.childSelector ? String(params.childSelector).trim() : undefined
      clean.attributes = Array.isArray(params.attributes) ? params.attributes.map(String) : undefined
      clean.resultKey = String(params.resultKey ?? `list_${Date.now()}`)
      clean.limit = Math.min(Number(params.limit) || 50, 100)
      break
    case 'extract_table':
      clean.selector = String(params.selector ?? '').trim()
      clean.resultKey = String(params.resultKey ?? `table_${Date.now()}`)
      break
    case 'evaluate_js':
      clean.expression = String(params.expression ?? '')
      clean.resultKey = String(params.resultKey ?? `eval_${Date.now()}`)
      break
    case 'screenshot':
      clean.fullPage = Boolean(params.fullPage)
      break
  }

  return clean
}

// ─── Compile Action Plan → Executor Script ────────────────────────────

/**
 * Compile a validated action plan into a safe Puppeteer script.
 * Each step maps to a whitelisted Puppeteer primitive.
 * Results accumulate in a `results` object keyed by resultKey.
 *
 * v2: Injects post-navigation SSRF validation to catch redirect chains
 * that resolve to internal/private IPs after the initial URL check.
 */
export function compileActionPlan(plan: ActionStep[]): string {
  const stepCode = plan.map((step, i) => compileStep(step, i)).join('\n\n')

  return `export default async function({ page, context }) {
  const results = {};
  const stepStatus = [];
  let lastError = null;

  // ── Post-navigation SSRF guard ──
  // Validates the ACTUAL page URL after navigation (catches redirect chains,
  // DNS rebinding to internal IPs, protocol downgrades)
  const SSRF_BLOCKED_HOSTS = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
    'metadata.google.internal', 'metadata.internal', 'instance-data'
  ];
  const SSRF_BLOCKED_PREFIXES = [
    '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.',
    '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.',
    'fc00:', 'fd', 'fe80:', '100.64.'
  ];
  const SSRF_BLOCKED_TLDS = ['.internal', '.local', '.localhost'];

  function checkPostNavUrl(pageUrl) {
    try {
      const u = new URL(pageUrl);
      const h = u.hostname.toLowerCase();
      if (SSRF_BLOCKED_HOSTS.includes(h)) throw new Error('SSRF: Redirect resolved to blocked host: ' + h);
      if (SSRF_BLOCKED_PREFIXES.some(p => h.startsWith(p))) throw new Error('SSRF: Redirect resolved to private IP range');
      if (SSRF_BLOCKED_TLDS.some(t => h.endsWith(t))) throw new Error('SSRF: Redirect resolved to internal TLD');
      if (/^\\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h) || /^0[0-7]+$/.test(h)) throw new Error('SSRF: Redirect resolved to encoded IP');
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('SSRF: Protocol downgrade to ' + u.protocol);
      if (u.username || u.password) throw new Error('SSRF: Redirect introduced embedded credentials');
    } catch (e) {
      if (e.message?.startsWith('SSRF:')) throw e;
      // URL parse error — allow (might be about:blank during loading)
    }
  }

  try {
${stepCode}

    return {
      success: true,
      action: context.task,
      data: results,
      stepsCompleted: stepStatus.filter(s => s.ok).length,
      stepsTotal: ${plan.length},
      stepStatus,
      message: 'All ${plan.length} steps completed successfully'
    };
  } catch (err) {
    return {
      success: false,
      action: context.task,
      data: results,
      stepsCompleted: stepStatus.filter(s => s.ok).length,
      stepsTotal: ${plan.length},
      stepStatus,
      error: err.message || 'Unknown error',
      errorType: err.message?.startsWith('SSRF:') ? 'ssrf_blocked' : undefined,
      message: lastError || err.message
    };
  }
}`
}

function compileStep(step: ActionStep, index: number): string {
  const indent = '    '
  const p = step.params
  const riskTag = step.mutationRisk !== 'safe' ? `, risk: '${step.mutationRisk}'` : ''
  const stepTrack = `stepStatus.push({ id: ${step.id}, action: '${step.action}', phase: '${step.phase}', ok: true${riskTag} });`
  const stepFail = `(stepErr) => { stepStatus.push({ id: ${step.id}, action: '${step.action}', phase: '${step.phase}', ok: false${riskTag}, error: stepErr?.message }); lastError = stepErr?.message; }`

  let code = `${indent}// Step ${step.id}: ${step.description || step.action} [${step.phase}/${step.mutationRisk}]`

  switch (step.action) {
    case 'goto':
      code += `\n${indent}await page.goto(${JSON.stringify(p.url)}, { waitUntil: ${JSON.stringify(p.waitUntil)}, timeout: 30000 });`
      // Post-navigation SSRF check
      code += `\n${indent}checkPostNavUrl(page.url());`
      code += `\n${indent}${stepTrack}`
      break

    case 'wait_for_selector':
      code += `\n${indent}await page.waitForSelector(${JSON.stringify(p.selector)}, { timeout: ${p.timeout} });`
      code += `\n${indent}${stepTrack}`
      break

    case 'wait_for_navigation':
      code += `\n${indent}await page.waitForNavigation({ timeout: ${p.timeout}, waitUntil: 'networkidle2' });`
      // Post-navigation SSRF check
      code += `\n${indent}checkPostNavUrl(page.url());`
      code += `\n${indent}${stepTrack}`
      break

    case 'wait_for_timeout':
      code += `\n${indent}await new Promise(r => setTimeout(r, ${p.ms}));`
      code += `\n${indent}${stepTrack}`
      break

    case 'click':
      code += `\n${indent}await page.waitForSelector(${JSON.stringify(p.selector)}, { timeout: ${p.timeout} });`
      code += `\n${indent}await page.click(${JSON.stringify(p.selector)});`
      // Post-click navigation check (clicks often cause navigation)
      code += `\n${indent}try { await page.waitForNavigation({ timeout: 2000, waitUntil: 'networkidle2' }).then(() => checkPostNavUrl(page.url())); } catch(e) { if (e.message?.startsWith('SSRF:')) throw e; /* no nav is ok */ }`
      code += `\n${indent}${stepTrack}`
      break

    case 'type_text':
      code += `\n${indent}await page.waitForSelector(${JSON.stringify(p.selector)}, { timeout: 10000 });`
      if (p.clearFirst) {
        code += `\n${indent}await page.click(${JSON.stringify(p.selector)}, { clickCount: 3 });`
      }
      code += `\n${indent}await page.type(${JSON.stringify(p.selector)}, ${JSON.stringify(p.text)}, { delay: ${p.delay} });`
      code += `\n${indent}${stepTrack}`
      break

    case 'select_option':
      code += `\n${indent}await page.select(${JSON.stringify(p.selector)}, ${JSON.stringify(p.value)});`
      code += `\n${indent}${stepTrack}`
      break

    case 'press_key':
      code += `\n${indent}await page.keyboard.press(${JSON.stringify(p.key)});`
      // Enter/Return can trigger form submission → navigation
      if (p.key === 'Enter' || p.key === 'Return') {
        code += `\n${indent}try { await page.waitForNavigation({ timeout: 2000, waitUntil: 'networkidle2' }).then(() => checkPostNavUrl(page.url())); } catch(e) { if (e.message?.startsWith('SSRF:')) throw e; }`
      }
      code += `\n${indent}${stepTrack}`
      break

    case 'scroll':
      code += `\n${indent}await page.evaluate((dir, amt) => {`
      code += `\n${indent}  window.scrollBy(0, dir === 'up' ? -amt : amt);`
      code += `\n${indent}}, ${JSON.stringify(p.direction)}, ${p.amount});`
      code += `\n${indent}${stepTrack}`
      break

    case 'extract_text':
      code += `\n${indent}results[${JSON.stringify(p.resultKey)}] = await page.evaluate(`
      code += `\n${indent}  (sel) => { const el = document.querySelector(sel); return el ? el.innerText.trim() : null; },`
      code += `\n${indent}  ${JSON.stringify(p.selector)}`
      code += `\n${indent});`
      code += `\n${indent}${stepTrack}`
      break

    case 'extract_attribute':
      code += `\n${indent}results[${JSON.stringify(p.resultKey)}] = await page.evaluate(`
      code += `\n${indent}  (sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; },`
      code += `\n${indent}  ${JSON.stringify(p.selector)}, ${JSON.stringify(p.attribute)}`
      code += `\n${indent});`
      code += `\n${indent}${stepTrack}`
      break

    case 'extract_list':
      code += `\n${indent}results[${JSON.stringify(p.resultKey)}] = await page.evaluate(`
      code += `\n${indent}  (sel, childSel, attrs, lim) => {`
      code += `\n${indent}    const items = Array.from(document.querySelectorAll(sel)).slice(0, lim);`
      code += `\n${indent}    return items.map(el => {`
      code += `\n${indent}      const target = childSel ? el.querySelector(childSel) : el;`
      code += `\n${indent}      if (!target) return null;`
      code += `\n${indent}      if (attrs && attrs.length > 0) {`
      code += `\n${indent}        const obj = { text: target.innerText?.trim() };`
      code += `\n${indent}        attrs.forEach(a => { obj[a] = target.getAttribute(a); });`
      code += `\n${indent}        return obj;`
      code += `\n${indent}      }`
      code += `\n${indent}      return target.innerText?.trim();`
      code += `\n${indent}    }).filter(Boolean);`
      code += `\n${indent}  },`
      code += `\n${indent}  ${JSON.stringify(p.selector)}, ${JSON.stringify(p.childSelector ?? null)}, ${JSON.stringify(p.attributes ?? null)}, ${p.limit}`
      code += `\n${indent});`
      code += `\n${indent}${stepTrack}`
      break

    case 'extract_table':
      code += `\n${indent}results[${JSON.stringify(p.resultKey)}] = await page.evaluate(`
      code += `\n${indent}  (sel) => {`
      code += `\n${indent}    const table = document.querySelector(sel);`
      code += `\n${indent}    if (!table) return null;`
      code += `\n${indent}    const rows = Array.from(table.querySelectorAll('tr'));`
      code += `\n${indent}    const headers = Array.from(rows[0]?.querySelectorAll('th, td') ?? []).map(h => h.innerText.trim());`
      code += `\n${indent}    return rows.slice(1).map(row => {`
      code += `\n${indent}      const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());`
      code += `\n${indent}      const obj = {};`
      code += `\n${indent}      headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });`
      code += `\n${indent}      return obj;`
      code += `\n${indent}    });`
      code += `\n${indent}  },`
      code += `\n${indent}  ${JSON.stringify(p.selector)}`
      code += `\n${indent});`
      code += `\n${indent}${stepTrack}`
      break

    case 'evaluate_js':
      code += `\n${indent}results[${JSON.stringify(p.resultKey)}] = await page.evaluate(() => {`
      code += `\n${indent}  ${p.expression}`
      code += `\n${indent}});`
      code += `\n${indent}${stepTrack}`
      break

    case 'screenshot':
      code += `\n${indent}// Screenshot handled externally`
      code += `\n${indent}${stepTrack}`
      break
  }

  return code
}

// ─── LLM Prompt for Action Plan Generation ────────────────────────────

export const ACTION_PLAN_PROMPT = `You are a browser automation planner. Given a user task, produce a JSON action plan.

OUTPUT FORMAT: A JSON array of step objects. Nothing else — no markdown, no explanation.

Each step has:
- "action": one of the allowed action types
- "params": parameters for the action
- "description": brief human-readable description

ALLOWED ACTIONS:

Navigation (retryable, safe):
- goto: { url: string, waitUntil?: "networkidle2" | "domcontentloaded" }
- wait_for_selector: { selector: string, timeout?: number }
- wait_for_navigation: { timeout?: number }
- wait_for_timeout: { ms: number }  (max 30000)

Extraction (retryable, read-only):
- extract_text: { selector: string, resultKey: string }
- extract_attribute: { selector: string, attribute: string, resultKey: string }
- extract_list: { selector: string, childSelector?: string, attributes?: string[], resultKey: string, limit?: number }
- extract_table: { selector: string, resultKey: string }
- evaluate_js: { expression: string, resultKey: string }  (MUST be a return statement, no fetch/XHR/cookies/storage)
- screenshot: { fullPage?: boolean }

Mutation (NOT retried — side effects):
- click: { selector: string, timeout?: number }
- type_text: { selector: string, text: string, delay?: number, clearFirst?: boolean }
- select_option: { selector: string, value: string }
- press_key: { key: string }  (e.g., "Enter", "Tab")
- scroll: { direction: "up" | "down", amount?: number }

RULES:
1. ALWAYS start with a "goto" step
2. Use CSS selectors, prefer ID/class-based selectors over nth-child. Max 8 levels of nesting.
3. Add wait_for_selector before interacting with dynamic elements
4. Maximum 20 steps
5. For evaluate_js, the expression MUST start with "return" and MUST NOT use fetch, XMLHttpRequest, localStorage, cookies, eval, Function(), or any network calls
6. Use descriptive resultKey names (e.g., "page_title", "search_results")
7. Prefer extract_list over multiple extract_text calls when getting multiple items
8. For search engines: use the actual search URL with query params instead of typing into search box (more reliable)
9. NEVER include credentials, passwords, or payment info in type_text params
10. Prefer specific selectors (#id, .class) over positional selectors (nth-child, nth-of-type)

EXAMPLE — Extract Hacker News top posts:
[
  { "action": "goto", "params": { "url": "https://news.ycombinator.com" }, "description": "Navigate to Hacker News" },
  { "action": "wait_for_selector", "params": { "selector": ".titleline" }, "description": "Wait for posts to load" },
  { "action": "extract_list", "params": { "selector": ".titleline > a", "attributes": ["href"], "resultKey": "top_posts", "limit": 10 }, "description": "Extract top 10 post titles and URLs" }
]
`
