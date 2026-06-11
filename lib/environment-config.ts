/**
 * Module → Environment mapping
 * Each module has a pre-generated panorama that anchors its cognitive mode.
 */

export interface ModuleEnvironment {
  module: string
  label: string
  cognitiveMode: string
  prompt: string         // Blockade Labs generation prompt
  style: string          // skybox style key
  fallbackColor: string  // CSS gradient fallback
}

export const MODULE_ENVIRONMENTS: ModuleEnvironment[] = [
  {
    module: 'chat',
    label: 'Command Center',
    cognitiveMode: 'Strategic Dialogue',
    prompt: 'Sleek futuristic command center with holographic displays, dark ambient lighting with electric blue accents, curved panoramic windows overlooking a digital cityscape at night, minimalist executive aesthetic',
    style: 'command-center',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0a1628 0%, #060d18 100%)',
  },
  {
    module: 'tasks',
    label: 'Strategic War Room',
    cognitiveMode: 'Decision & Execution',
    prompt: 'Dark strategic war room with massive tactical display screens showing data visualization, military-grade operations center aesthetic, blue lighting emanating from screens, heavy materials and structured architecture',
    style: 'command-center',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0f1a2e 0%, #080e1a 100%)',
  },
  {
    module: 'calendar',
    label: 'Observatory',
    cognitiveMode: 'Temporal Alignment',
    prompt: 'Elegant astronomical observatory interior at twilight, large dome opening to a star-filled sky, brass instruments and celestial maps, warm amber lighting mixed with cosmic blue, contemplative atmosphere',
    style: 'cinematic',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0d1520 0%, #06090f 100%)',
  },
  {
    module: 'email',
    label: 'Executive Boardroom',
    cognitiveMode: 'High-Stakes Communication',
    prompt: 'Ultra-modern executive boardroom in a glass skyscraper penthouse, city skyline at night visible through floor-to-ceiling windows, polished dark surfaces, ambient blue accent lighting, power and precision atmosphere',
    style: 'cinematic',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0a1220 0%, #060a12 100%)',
  },
  {
    module: 'cortex',
    label: 'Think Tank',
    cognitiveMode: 'Self-Observation & Insight',
    prompt: 'Abstract neural network visualization chamber, interconnected nodes of light floating in dark space, bioluminescent pathways, deep blue and violet tones, the interior of a thinking mind made physical, contemplative and vast',
    style: 'concept-render',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0e0a20 0%, #08061a 100%)',
  },
  {
    module: 'brand',
    label: 'Gallery',
    cognitiveMode: 'Positioning & Identity',
    prompt: 'Modern art gallery with dramatic lighting, large open spaces, white walls with strategically lit artworks, clean minimalist architecture, evening atmosphere with warm spotlights against cool ambient blue',
    style: 'cinematic',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #12101a 0%, #0a0810 100%)',
  },
  {
    module: 'memories',
    label: 'Archive Vault',
    cognitiveMode: 'Knowledge Retrieval',
    prompt: 'Vast futuristic digital library with floating holographic data archives, rows of illuminated data crystals in dark metallic shelving, blue glow from stored knowledge, cathedral-scale architecture of information',
    style: 'command-center',
    fallbackColor: 'radial-gradient(ellipse at 50% 50%, #0a0f1e 0%, #060810 100%)',
  },
]

// Map route paths to module keys
export function getModuleForPath(pathname: string): string {
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/calendar')) return 'calendar'
  if (pathname.startsWith('/email')) return 'email'
  if (pathname.startsWith('/cortex')) return 'cortex'
  if (pathname.startsWith('/brand')) return 'brand'
  if (pathname.startsWith('/memories')) return 'memories'
  if (pathname.startsWith('/agents')) return 'chat'  // agents share command center
  if (pathname.startsWith('/watches')) return 'chat'
  if (pathname.startsWith('/automations')) return 'tasks'
  if (pathname.startsWith('/environments')) return 'chat'
  if (pathname.startsWith('/settings')) return 'chat'
  if (pathname.startsWith('/profile')) return 'chat'
  if (pathname.startsWith('/system')) return 'cortex'
  return 'chat'
}

// Storage key for generated module panoramas
export const ENV_STORAGE_KEY = 'seth_module_environments'

// Settings key
export const ENV_SETTINGS_KEY = 'seth_env_settings'

export interface EnvSettings {
  enabled: boolean
  reducedMotion: boolean
}

export const DEFAULT_ENV_SETTINGS: EnvSettings = {
  enabled: true,
  reducedMotion: false,
}
