/**
 * Seth Intelligent Model Router
 *
 * Routes requests across 4 tiers based on task complexity:
 * - Tier 1 (Privacy/Default): Venice venice-uncensored — general chat, strategic advice, uncensored
 * - Tier 2 (Free/Grunt Work): OpenRouter free models — tool classification, simple lookups
 * - Tier 3 (Paid/Complex): OpenRouter paid models — deep analysis, code gen, multi-step reasoning
 * - Tier 4 (Gateway): Vercel AI Gateway — GPT-4o / GPT-5.5 via OIDC, no API key needed
 */

export type ModelTier = 'privacy' | 'free' | 'paid' | 'gateway'

export interface ModelConfig {
  tier: ModelTier
  model: string
  provider: 'venice' | 'openrouter' | 'gateway'
  apiUrl: string
  reason: string
}

// --- Provider configs ---
const VENICE_URL = 'https://api.venice.ai/api/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'

// --- Model catalog ---
const MODELS = {
  // Tier 1: Privacy (Venice)
  venice_uncensored: { id: 'venice-uncensored', provider: 'venice' as const, url: VENICE_URL },
  venice_qwen3: { id: 'qwen3-235b-a22b-instruct-2507', provider: 'venice' as const, url: VENICE_URL },

  // Tier 2: Free (OpenRouter)
  deepseek_chat_free: { id: 'deepseek/deepseek-chat-v3-0324:free', provider: 'openrouter' as const, url: OPENROUTER_URL },
  gemma4_31b_free: { id: 'google/gemma-4-31b-it:free', provider: 'openrouter' as const, url: OPENROUTER_URL },
  nemotron_free: { id: 'nvidia/nemotron-3-super-120b-a12b:free', provider: 'openrouter' as const, url: OPENROUTER_URL },
  qwen3_coder_free: { id: 'qwen/qwen3-coder:free', provider: 'openrouter' as const, url: OPENROUTER_URL },

  // Tier 3: Paid (OpenRouter) — cheap but powerful
  deepseek_v4_pro: { id: 'deepseek/deepseek-v4-pro', provider: 'openrouter' as const, url: OPENROUTER_URL },
  gpt41_mini: { id: 'openai/gpt-4.1-mini', provider: 'openrouter' as const, url: OPENROUTER_URL },

  // Tier 4: Vercel AI Gateway — OIDC-authenticated, no separate API key
  gateway_claude_sonnet: { id: 'anthropic/claude-sonnet-4-5', provider: 'gateway' as const, url: GATEWAY_URL },
  gateway_claude_haiku: { id: 'anthropic/claude-haiku-4-5', provider: 'gateway' as const, url: GATEWAY_URL },
  gateway_gpt4o: { id: 'openai/gpt-4o', provider: 'gateway' as const, url: GATEWAY_URL },
  gateway_gpt55: { id: 'openai/gpt-5.5', provider: 'gateway' as const, url: GATEWAY_URL },
} as const

// Ordered fallback chains
const FREE_FALLBACKS = [
  MODELS.nemotron_free,
  MODELS.gemma4_31b_free,
  MODELS.qwen3_coder_free,
  MODELS.deepseek_chat_free,
]

const PAID_FALLBACKS = [
  MODELS.gpt41_mini,
  MODELS.deepseek_v4_pro,
]

// Gateway fallback chain: Claude Sonnet → Claude Haiku → GPT-4o → GPT-5.5
const GATEWAY_FALLBACKS = [
  MODELS.gateway_claude_sonnet,
  MODELS.gateway_claude_haiku,
  MODELS.gateway_gpt4o,
  MODELS.gateway_gpt55,
]

// --- Complexity classification ---

const COMPLEX_PATTERNS = [
  // Multi-step reasoning / analysis
  /\b(analy[sz]e|compare|evaluate|critique|assess|audit|benchmark|dissect)\b.*\b(strateg|business|market|financ|invest|portfolio|competitor)\b/i,
  // Code generation
  /\b(write|create|build|implement|code|program|script|develop)\b.*\b(function|class|api|app|algorithm|component|system|architecture)\b/i,
  // Deep research
  /\b(research|investigate|deep.?dive|thorough|comprehensive|exhaustive|detailed analysis)\b/i,
  // Math/quantitative
  /\b(calculate|compute|model|forecast|project|simulate|optimize|quantif)\b.*\b(revenue|cost|roi|irr|npv|margin|growth|valuation)\b/i,
  // Legal/contractual
  /\b(draft|review|negotiate)\b.*\b(contract|agreement|terms|clause|legal|compliance)\b/i,
  // Long-form content
  /\b(write|draft|compose|create)\b.*\b(essay|article|report|proposal|plan|whitepaper|pitch|deck|business plan)\b/i,
]

const SIMPLE_PATTERNS = [
  // Greetings & small talk
  /^(hey|hi|hello|sup|yo|good morning|good evening|thanks|thank you|ok|okay|cool|nice|got it|sure)\b/i,
  // Single word/short queries
  /^[\w\s]{1,20}[?]?$/,
  // Status checks
  /\b(how are you|what's up|status|update me)\b/i,
  // Simple lookups
  /\b(what is|what's|who is|when did|where is|define|meaning of)\b.{0,50}$/i,
  // Yes/no answers
  /^(yes|no|yep|nope|yeah|nah|correct|wrong|exactly|agreed)\b/i,
]

function classifyComplexity(message: string): 'simple' | 'moderate' | 'complex' {
  const trimmed = message.trim()

  // Check complex patterns first (they're more specific)
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(trimmed)) return 'complex'
  }

  // Check simple patterns
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(trimmed)) return 'simple'
  }

  // Heuristics for length & structure
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 100) return 'complex'
  if (wordCount < 10) return 'simple'

  // Has multiple questions or bullet points?
  const questionMarks = (trimmed.match(/\?/g) ?? []).length
  const bullets = (trimmed.match(/^[-•*\d+\.]/gm) ?? []).length
  if (questionMarks >= 3 || bullets >= 3) return 'complex'

  return 'moderate'
}

// --- Router ---

export function routeForChat(userMessage: string): ModelConfig {
  const complexity = classifyComplexity(userMessage)

  switch (complexity) {
    case 'complex':
      // Use paid model for genuinely complex tasks
      return {
        tier: 'paid',
        model: PAID_FALLBACKS[0].id,
        provider: PAID_FALLBACKS[0].provider,
        apiUrl: PAID_FALLBACKS[0].url,
        reason: `Complex task detected → using premium model`,
      }
    case 'simple':
    case 'moderate':
    default:
      // Venice uncensored for everything else (privacy first)
      return {
        tier: 'privacy',
        model: MODELS.venice_uncensored.id,
        provider: MODELS.venice_uncensored.provider,
        apiUrl: MODELS.venice_uncensored.url,
        reason: complexity === 'simple'
          ? 'Simple query → Venice private model'
          : 'Standard query → Venice private model (default)',
      }
  }
}

/**
 * Route for background/non-critical tasks: auto-execution, watch checking, etc.
 * Always defaults to free models to minimize cost. Falls back to Venice only if needed.
 */
export function routeForBackground(): ModelConfig {
  return {
    tier: 'free',
    model: FREE_FALLBACKS[0].id,
    provider: FREE_FALLBACKS[0].provider,
    apiUrl: FREE_FALLBACKS[0].url,
    reason: 'Background task → free model (cost-efficient)',
  }
}

export function getBackgroundFallback(failedModel: string): ModelConfig | null {
  const failedIdx = FREE_FALLBACKS.findIndex(m => m.id === failedModel)
  const nextFree = FREE_FALLBACKS[failedIdx + 1]
  if (nextFree) {
    return {
      tier: 'free',
      model: nextFree.id,
      provider: nextFree.provider,
      apiUrl: nextFree.url,
      reason: `Background fallback (${failedModel} failed)`,
    }
  }
  // Last resort: Venice (always available, no rate limits)
  return {
    tier: 'privacy',
    model: MODELS.venice_uncensored.id,
    provider: MODELS.venice_uncensored.provider,
    apiUrl: MODELS.venice_uncensored.url,
    reason: 'All free models failed → Venice fallback for background task',
  }
}

export function routeForToolDetection(): ModelConfig {
  // Use free OpenRouter model for tool classification (grunt work)
  return {
    tier: 'free',
    model: FREE_FALLBACKS[0].id,
    provider: FREE_FALLBACKS[0].provider,
    apiUrl: FREE_FALLBACKS[0].url,
    reason: 'Tool detection → free model (grunt work)',
  }
}

export function getToolDetectionFallback(failedModel: string): ModelConfig | null {
  // Find next free model in fallback chain
  const failedIdx = FREE_FALLBACKS.findIndex(m => m.id === failedModel)
  const nextFree = FREE_FALLBACKS[failedIdx + 1]
  if (nextFree) {
    return {
      tier: 'free',
      model: nextFree.id,
      provider: nextFree.provider,
      apiUrl: nextFree.url,
      reason: `Fallback free model (${failedModel} failed)`,
    }
  }

  // All free models failed → fall back to Venice qwen3 (reliable)
  return {
    tier: 'privacy',
    model: MODELS.venice_qwen3.id,
    provider: MODELS.venice_qwen3.provider,
    apiUrl: MODELS.venice_qwen3.url,
    reason: 'All free models failed → Venice qwen3 fallback',
  }
}

export function getChatFallback(failedModel: string): ModelConfig | null {
  // If paid model failed, try next paid
  const paidIdx = PAID_FALLBACKS.findIndex(m => m.id === failedModel)
  if (paidIdx >= 0 && PAID_FALLBACKS[paidIdx + 1]) {
    const next = PAID_FALLBACKS[paidIdx + 1]
    return {
      tier: 'paid',
      model: next.id,
      provider: next.provider,
      apiUrl: next.url,
      reason: `Paid fallback (${failedModel} failed)`,
    }
  }

  // Ultimate fallback: Venice uncensored always works
  if (failedModel !== MODELS.venice_uncensored.id) {
    return {
      tier: 'privacy',
      model: MODELS.venice_uncensored.id,
      provider: MODELS.venice_uncensored.provider,
      apiUrl: MODELS.venice_uncensored.url,
      reason: 'Ultimate fallback → Venice private model',
    }
  }

  return null
}

// --- API call helpers ---

export function buildHeaders(config: ModelConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.provider === 'venice') {
    headers['Authorization'] = `Bearer ${process.env.VENICE_API_KEY}`
  } else if (config.provider === 'gateway') {
    // Vercel AI Gateway: authenticate via OIDC token (no separate API key needed)
    headers['Authorization'] = `Bearer ${process.env.VERCEL_OIDC_TOKEN}`
  } else {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`
    headers['HTTP-Referer'] = process.env.NEXTAUTH_URL ?? 'https://sethassistant.digital'
    headers['X-Title'] = 'Seth Assistant'
  }

  return headers
}

/**
 * Returns true if the Vercel AI Gateway is available in this runtime.
 * In production Vercel deployments VERCEL_OIDC_TOKEN is injected automatically.
 */
export function isGatewayAvailable(): boolean {
  return !!process.env.VERCEL_OIDC_TOKEN
}

/**
 * Route a request through the Vercel AI Gateway.
 * Falls back to openrouter paid tier if OIDC token is unavailable.
 */
export type GatewayModel = 'claude-sonnet' | 'claude-haiku' | 'gpt-4o' | 'gpt-5.5'

export function routeForGateway(preferredModel: GatewayModel = 'claude-sonnet'): ModelConfig {
  if (!isGatewayAvailable()) {
    // Fallback to paid OpenRouter if not running on Vercel
    return {
      tier: 'paid',
      model: MODELS.gpt41_mini.id,
      provider: MODELS.gpt41_mini.provider,
      apiUrl: MODELS.gpt41_mini.url,
      reason: 'Gateway unavailable (no OIDC token) → OpenRouter paid fallback',
    }
  }
  const modelMap: Record<GatewayModel, typeof MODELS[keyof typeof MODELS]> = {
    'claude-sonnet': MODELS.gateway_claude_sonnet,
    'claude-haiku': MODELS.gateway_claude_haiku,
    'gpt-4o': MODELS.gateway_gpt4o,
    'gpt-5.5': MODELS.gateway_gpt55,
  }
  const m = modelMap[preferredModel]
  return {
    tier: 'gateway',
    model: m.id,
    provider: m.provider,
    apiUrl: m.url,
    reason: `Vercel AI Gateway → ${m.id} (OIDC auth)`,
  }
}

export function buildRequestBody(
  config: ModelConfig,
  messages: Array<Record<string, any>>,
  options: {
    stream?: boolean
    tools?: any[]
    toolChoice?: string
    maxTokens?: number
    webSearch?: boolean | 'auto'
    temperature?: number
  } = {}
): Record<string, any> {
  const body: Record<string, any> = {
    model: config.model,
    messages,
    max_tokens: options.maxTokens ?? 2500,
  }

  if (options.temperature !== undefined) body.temperature = options.temperature

  if (options.stream) body.stream = true
  if (options.tools) {
    body.tools = options.tools
    body.tool_choice = options.toolChoice ?? 'auto'
  }

  // Venice-specific web search parameter
  if (config.provider === 'venice' && options.webSearch !== undefined) {
    body.venice_parameters = {
      enable_web_search: options.webSearch === true ? 'on' : options.webSearch === false ? 'off' : 'auto',
    }
  }

  return body
}
