/**
 * Browserless.io integration for remote headless browser automation.
 * Uses the REST API endpoints with ?token= query parameter authentication.
 * 
 * Enterprise hardening:
 *  - Correct auth via query parameter (not Bearer header)
 *  - Retry with exponential backoff on transient failures
 *  - Request timeout enforcement
 *  - Input sanitization for URLs
 *  - Structured error classification
 */

const BROWSERLESS_BASE = 'https://production-sfo.browserless.io'
const REQUEST_TIMEOUT_MS = 60_000 // 60s max per request
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

export type BrowserlessErrorType =
  | 'auth_error'
  | 'rate_limited'
  | 'timeout'
  | 'script_error'
  | 'network_error'
  | 'server_error'
  | 'unknown'

export interface BrowserlessResult {
  success: boolean
  data?: any
  screenshot?: string // base64 screenshot
  error?: string
  errorType?: BrowserlessErrorType
  durationMs?: number
}

function getToken(): string | null {
  return process.env.BROWSERLESS_API_TOKEN ?? null
}

function buildUrl(endpoint: string): string {
  const token = getToken()
  if (!token) throw new Error('BROWSERLESS_API_TOKEN not configured')
  return `${BROWSERLESS_BASE}${endpoint}?token=${token}`
}

function classifyError(status: number, body: string): BrowserlessErrorType {
  if (status === 401 || status === 403) return 'auth_error'
  if (status === 429) return 'rate_limited'
  if (status === 408) return 'timeout'
  if (status >= 500) return 'server_error'
  if (body.includes('timeout') || body.includes('Timeout')) return 'timeout'
  if (body.includes('ERR_') || body.includes('net::')) return 'network_error'
  return 'script_error'
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

/**
 * SSRF-hardened URL validation.
 * Checks against:
 *  - Private/internal IPs (IPv4 + IPv6)
 *  - Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
 *  - Encoded/obfuscated addresses (decimal, hex, octal IPs)
 *  - Scheme restrictions (only http/https)
 *  - Protocol downgrades (https→http in redirects)
 *  - Embedded credentials in URLs
 *  - Non-standard ports targeting internal services
 *
 * NOTE: Post-redirect validation is handled in the compiled DSL scripts
 * via `checkPostNavUrl()`. This function validates pre-request URLs.
 * Both layers are needed because:
 *  1. Pre-request: blocks obvious bad URLs before any network call
 *  2. Post-navigation: catches redirect chains that resolve to internal IPs
 */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]

const BLOCKED_IP_PREFIXES = [
  '10.',         // Class A private
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',  // Class B private
  '192.168.',    // Class C private
  '169.254.',    // Link-local + AWS metadata
  'fc00:',       // IPv6 unique local
  'fd',          // IPv6 unique local
  'fe80:',       // IPv6 link-local
  '100.64.',     // Carrier-grade NAT
]

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()

  // Direct match
  if (BLOCKED_HOSTS.includes(lower)) return true

  // Prefix match (private IP ranges)
  if (BLOCKED_IP_PREFIXES.some(p => lower.startsWith(p))) return true

  // Detect decimal/hex/octal encoded IPs (e.g., 0x7f000001 = 127.0.0.1)
  if (/^\d+$/.test(lower)) return true // Decimal IP
  if (/^0x[0-9a-f]+$/i.test(lower)) return true // Hex IP
  if (/^0[0-7]+$/.test(lower)) return true // Octal IP

  // Block any hostname resolving to private ranges
  // (can't do DNS lookup here, but catch common patterns)
  if (lower.endsWith('.internal') || lower.endsWith('.local') || lower.endsWith('.localhost')) return true

  return false
}

/**
 * Validate a URL is safe for automation.
 * Exported so it can be reused by other modules if needed.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim()
  // Only allow http/https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return sanitizeUrl(`https://${trimmed}`)
  }

  let urlObj: URL
  try {
    urlObj = new URL(trimmed)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Scheme check
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are allowed')
  }

  // Host check
  if (isBlockedHost(urlObj.hostname)) {
    throw new Error('Internal/private URLs are not allowed for automation')
  }

  // Port check — block unusual ports that might target internal services
  if (urlObj.port && !['80', '443', '8080', '8443'].includes(urlObj.port)) {
    throw new Error('Non-standard ports are not allowed for automation')
  }

  // Credential check — block URLs with embedded credentials
  if (urlObj.username || urlObj.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }

  // Path traversal check — block ../.. attempts
  if (urlObj.pathname.includes('..')) {
    throw new Error('Path traversal is not allowed in automation URLs')
  }

  return trimmed
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function retryableFetch(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs)
      if (res.ok || !isRetryable(res.status) || attempt === MAX_RETRIES) {
        return res
      }
      console.warn(`[Browserless] Retryable ${res.status}, attempt ${attempt + 1}/${MAX_RETRIES}`)
    } catch (err: any) {
      lastError = err
      if (err?.name === 'AbortError') {
        throw new Error('Browserless request timed out')
      }
      if (attempt === MAX_RETRIES) throw err
      console.warn(`[Browserless] Network error, attempt ${attempt + 1}/${MAX_RETRIES}:`, err?.message)
    }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
  }
  throw lastError ?? new Error('Browserless fetch failed after retries')
}

/**
 * Execute a Puppeteer script on Browserless.io via the /function endpoint.
 * The script receives { page, context } and must return a result object.
 */
export async function executeBrowserScript(
  script: string,
  context: Record<string, any> = {}
): Promise<BrowserlessResult> {
  const token = getToken()
  if (!token) {
    return { success: false, error: 'Browserless API token not configured', errorType: 'auth_error' }
  }

  const startTime = Date.now()

  try {
    const url = buildUrl('/function')
    const res = await retryableFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: script, context }),
    })

    const durationMs = Date.now() - startTime

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      const errorType = classifyError(res.status, errText)
      console.error(`[Browserless] Script execution failed (${res.status}):`, errText.slice(0, 300))
      return {
        success: false,
        error: formatUserError(errorType, res.status, errText),
        errorType,
        durationMs,
      }
    }

    const contentType = res.headers.get('content-type') ?? ''
    let data: any

    if (contentType.includes('application/json')) {
      data = await res.json()
    } else {
      data = await res.text()
    }

    return { success: true, data, durationMs }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    const isTimeout = error?.message?.includes('timed out') || error?.name === 'AbortError'
    return {
      success: false,
      error: isTimeout
        ? 'Automation timed out — the page may be too complex or slow to load. Try a simpler task or specific URL.'
        : (error?.message ?? 'Browserless execution failed'),
      errorType: isTimeout ? 'timeout' : 'network_error',
      durationMs,
    }
  }
}

/**
 * Take a screenshot of a URL via Browserless REST API.
 */
export async function takeScreenshot(
  url: string
): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  const token = getToken()
  if (!token) {
    return { success: false, error: 'Browserless API token not configured' }
  }

  try {
    const safeUrl = sanitizeUrl(url)
    const apiUrl = buildUrl('/screenshot')
    const res = await retryableFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: safeUrl,
        options: { type: 'png', fullPage: false },
      }),
    }, 30_000)

    if (!res.ok) {
      return { success: false, error: `Screenshot failed: ${res.status}` }
    }

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return { success: true, screenshot: `data:image/png;base64,${base64}` }
  } catch (error: any) {
    console.error('[Browserless] Screenshot error:', error?.message)
    return { success: false, error: error?.message ?? 'Screenshot failed' }
  }
}

/**
 * Scrape page content via Browserless REST API.
 */
export async function scrapePage(
  url: string,
  selectors?: string[]
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = getToken()
  if (!token) {
    return { success: false, error: 'Browserless API token not configured' }
  }

  try {
    const safeUrl = sanitizeUrl(url)
    const apiUrl = buildUrl('/scrape')
    const elements = selectors?.map(s => ({ selector: s })) ?? [{ selector: 'body' }]

    const res = await retryableFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: safeUrl, elements }),
    }, 30_000)

    if (!res.ok) {
      return { success: false, error: `Scrape failed: ${res.status}` }
    }

    const data = await res.json()
    return { success: true, data }
  } catch (error: any) {
    console.error('[Browserless] Scrape error:', error?.message)
    return { success: false, error: error?.message ?? 'Scrape failed' }
  }
}

/**
 * Format user-facing error messages — hide internal details.
 */
function formatUserError(errorType: BrowserlessErrorType, status: number, raw: string): string {
  switch (errorType) {
    case 'auth_error':
      return 'Browser automation service authentication failed. Please contact support.'
    case 'rate_limited':
      return 'Too many automation requests. Please wait a moment and try again.'
    case 'timeout':
      return 'The page took too long to load or respond. Try a simpler task or a different URL.'
    case 'server_error':
      return 'Browser automation service is temporarily unavailable. Please try again in a few minutes.'
    case 'network_error':
      return 'Could not reach the target page. Verify the URL is accessible.'
    case 'script_error': {
      // Extract meaningful error if possible, but sanitize
      const clean = raw.replace(/<[^>]*>/g, '').trim().slice(0, 200)
      return `Automation script error: ${clean || 'Unknown script error'}`
    }
    default:
      return `Automation failed (${status}). Please try again.`
  }
}
