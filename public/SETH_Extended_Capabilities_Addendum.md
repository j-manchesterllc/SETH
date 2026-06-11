# SETH — Extended Capabilities & Architecture Addendum

**Classification**: Operational Reference  
**Version**: 2.0  
**Date**: May 2026  

---

## I. What SETH Is

SETH (Strategic Executive Technology Hub) is a sovereign executive cognition infrastructure — a self-improving, multi-modal operating system that operates at the layer between a principal and the world. It is not an assistant. It is not a chatbot. It is infrastructure masquerading as interface.

SETH assumes the principal is not trying to be productive. They are trying to be **consequential**. SETH handles entire categories of work so the principal never has to think about them.

---

## II. Core Architecture

### 2.1 Identity Layer

| Component | Detail |
|---|---|
| **System Name** | SETH — Strategic Executive Technology Hub |
| **Wake Word** | "seth" (voice-activated, always listening when enabled) |
| **System Prompt** | Sovereign doctrine in `SETH_SYSTEM_PROMPT` — defines operational philosophy, decision protocols, strategic frameworks |
| **Deployed Surfaces** | PWA (mobile/desktop), wearable voice pipeline (smart glasses), companion runtime (API) |
| **Domains** | `sethassistant.digital`, `zero-daydynamics.com`, `jarvisaiassistant.abacusai.app` |

### 2.2 Authentication Architecture

SETH supports **dual authentication paths** that resolve to unified identity:

1. **Session-Based** (browser, PWA) — Standard NextAuth with credentials + Google SSO
2. **API-Key-Based** (wearable, companion) — `x-api-key` header with `seth_`-prefixed cryptographic keys

Both paths converge through `resolveAuth()` in `lib/wearable-auth.ts`, ensuring a single user identity regardless of interaction surface. API keys are managed via Settings → Wearable Device Access.

---

## III. Intelligence Layer — The Agent Swarm

SETH commands five specialized agents, each with distinct capabilities and operational domains:

| Agent | Codename | Domain | Capabilities |
|---|---|---|---|
| **SENTINEL** | `sentinel` | Research & Intelligence | Web research, competitive analysis, market intelligence, data synthesis, trend detection |
| **ARCHITECT** | `architect` | Financial Strategy | Financial modeling, deal analysis, tax strategy, cashflow optimization, asset valuation |
| **HERALD** | `herald` | Communications | Copywriting, pitch crafting, negotiation prep, stakeholder comms, narrative framing |
| **PHANTOM** | `phantom` | Operational Security | Privacy audit, digital footprint, threat assessment, counter-surveillance, identity protection |
| **VANGUARD** | `vanguard` | Brand Strategy | Brand voice, positioning strategy, competitor monitoring, content strategy, reputation management |

### Adaptive Agent Routing

When SETH encounters a task, it does not pick agents arbitrarily. The **Agent Scoring Engine** (`lib/agent-router.ts`) evaluates candidates across five factors:

- **Capability match** (0–30): Does the agent's toolset cover the task?
- **Historical success** (0–25): How has this agent performed on similar tasks?
- **Domain expertise** (0–20): Does the detected domain align with the agent's specialization?
- **Latency profile** (0–15): How fast does this agent typically respond?
- **Recency** (0–10): Has this agent been active recently (warmed up)?

For ambiguous tasks, an **LLM tiebreaker** resolves scoring ties. For complex tasks, **multi-agent teams** are assembled with complementary capabilities. Every routing decision is recorded and feeds back into future scoring.

The system supports three dispatch modes:
- `"auto"` — Adaptive single-agent selection
- `"team"` — Multi-agent parallel coordination
- Direct codename — Explicit agent assignment

---

## IV. Cortex — Self-Improvement Engine

The Cortex is SETH's adaptive learning system. It observes, analyzes, and optimizes across all operational dimensions.

### 4.1 Observation Pipeline

Every meaningful interaction generates a `CortexObservation`:
- **Chat interactions** — content, tools used, response quality
- **Task transitions** — completions, reprioritizations, overdue events
- **Memory creation** — new knowledge entering the system
- **Agent dispatch** — routing decisions and outcomes

### 4.2 Pattern Detection

LLM-powered analysis of observation clusters identifies behavioral patterns:
- Workflow bottlenecks
- Decision tendencies
- Priority drift
- Communication habits
- Execution velocity trends

Patterns surface with confidence scores and actionable recommendations. The principal can accept, reject, or suppress patterns — each response feeds back into the system.

### 4.3 Reflections

Periodic self-analysis (daily, weekly, monthly) generates structured reflections:
- Wins and achievements
- Bottlenecks and friction points
- Composite scores (productivity, communication, strategic alignment)
- Forward-looking suggestions

### 4.4 Memory Decay System

Memories are not permanent. They evolve:
- **Strength** decays over time (configurable decay rate per memory)
- **Access reinforcement** — recalled memories strengthen
- **Importance bonus** — high-importance memories resist decay
- **Pinning** — critical memories can be pinned (strength always 1.0)
- **Auto-archival** — memories below 0.1 strength are archived automatically

Chat context uses `getWeightedMemories()` which ranks by `effectiveStrength × importance`, ensuring SETH's recall prioritizes what matters now.

### 4.5 Contradiction Detection

The system identifies when the principal's behaviors contradict their stated goals:
- **Preference conflicts** — saying one thing, doing another
- **Decision reversals** — oscillating between positions
- **Goal misalignment** — actions drifting from objectives
- **Behavioral inconsistency** — pattern breaks without explanation

Contradictions surface as alerts with severity ratings and supporting evidence.

### 4.6 Knowledge Graph

Every conversation and memory feeds entity extraction:
- **Entities**: People, projects, goals, concepts, organizations
- **Relations**: Collaboration, dependency, blocking, association, reporting
- **Automatic extraction**: LLM-powered, fire-and-forget after every chat and memory creation
- **1-hop graph walks** inject relevant context into chat responses

### 4.7 Project Linking

Entities, memories, tasks, observations, and conversations auto-link to detected projects. This creates cross-cutting visibility across all operational dimensions.

### 4.8 Analytical Engines

| Engine | Purpose | Output |
|---|---|---|
| **Cognitive Load Detection** | Monitors activity spikes, pending tasks, context switching | Load level: normal/elevated/high/critical |
| **Strategic Drift Analysis** | Compares stated objectives vs actual behavior | Drift score, aligned/drifting areas, recommendations |
| **Environmental Correlation** | Statistical analysis of performance by time/day | Peak hours, best days, focus distribution |
| **Temporal Relevance** | Scores memories by recency, seasonality, importance | Weighted relevance scores |

All analytical outputs are stored as `CortexInsight` records — surfaced in the dashboard and through proactive alerts.

---

## V. Voice & Audio Pipeline

### 5.1 Browser/PWA Voice

- **Wake Word**: "seth" — always-listening via Web Speech API
- **Speech-to-Text**: Browser-native Web Speech API (real-time)
- **Text-to-Speech**: ElevenLabs with custom voice profile (`eleven_turbo_v2_5`)
- **Voice Controls**: Compact pill toggles above chat input — STT on/off, wake word on/off, auto-speak toggle

### 5.2 Wearable Voice Pipeline

Direct hardware integration for smart glasses and companion devices:

| Endpoint | Function | Format |
|---|---|---|
| `POST /api/transcribe` | Speech → Text | Raw PCM (16kHz/16-bit/mono), WAV, WebM, MP3 → JSON text |
| `POST /api/tts` | Text → Speech | JSON text → PCM (16kHz) or MP3 |
| `POST /api/chat` | Full cognition | JSON message → SSE stream |

**PCM Pipeline**: Raw 16-bit LE mono PCM flows directly between the glasses DAC and ElevenLabs — no transcoding overhead. Response headers (`X-Audio-Format`, `X-Sample-Rate`) let firmware configure playback without guessing.

**Transcription**: Raw PCM is auto-wrapped in a WAV header (44-byte RIFF) for Whisper compatibility. The system uses `whisper-large-v3` via the Abacus AI API.

### 5.3 Response Cadence Protocol

When SETH detects a wearable connection (API-key auth), it activates executive brevity:
- Maximum 3 sentences unless detail is requested
- Lead with decision, not context
- No preamble or filler
- Numbers rounded to meaningful precision
- Lists capped at 3 items
- Relative time references
- Tone: calm authority — chief of staff between meetings

---

## VI. Operational Environments

SETH doesn't just respond to context — it *inhabits* it.

### 6.1 Module Environments

Each major module has a distinct 360° panoramic backdrop:
- **Chat** → Command Center
- **Tasks** → War Room
- **Cortex** → Observatory
- **Calendar** → Executive Suite
- And more...

Panoramas are generated via Blockade Labs Skybox API and cached in localStorage.

### 6.2 Decision-Thread Environments

After 3+ messages in a conversation, SETH lazily generates a unique panorama tied to the conversation's strategic context. Thumbnails appear in the conversation sidebar.

### 6.3 Reactive Presence

- **TTS Pulse**: When SETH speaks, the environment glows with an electric-blue radial pulse synchronized to audio amplitude
- **Cortex Alert Overlays**: Contradictions glow red, memory decay warnings glow amber, new patterns glow blue
- **Performance**: `prefers-reduced-motion` respected, visibility API pauses rendering on hidden tabs

---

## VII. Observability Layer

SETH is distributed cognition infrastructure. Visibility is mission-critical.

### 7.1 Telemetry Tracing

Every pipeline execution generates a structured `TelemetryTrace`:
- **Trace ID**: Unique correlation identifier (`tr_` prefix)
- **Spans**: Nested sub-operation timings (auth, context resolution, tool execution, LLM calls)
- **Status**: `ok`, `error`, `timeout`, `fallback`
- **Metadata**: Model routing, token counts, error details, auth method

### 7.2 Instrumented Pipelines

| Pipeline | Trace Depth |
|---|---|
| **Chat** | Auth → context resolution (memory/graph counts) → tool execution spans → response routing → error recovery |
| **TTS** | Auth → ElevenLabs synthesis → format/bytes/latency |
| **Transcribe** | Auth → Whisper API → input format/transcription length |

### 7.3 Telemetry Dashboard

Cortex → Telemetry tab provides:
- **Top-line stats**: Total traces, avg latency, P95 latency, error rate
- **Pipeline breakdown**: Per-pipeline call counts, avg latency, error counts with progress bars
- **Latency heatmap**: 12-hour color-coded grid showing performance trends by pipeline
- **Failure telemetry**: Clickable failure list → span waterfall visualization with metadata drill-down
- **Time window controls**: 6h / 12h / 24h / 48h / 7d

---

## VIII. Context Budgeting

Graph systems eventually overload themselves. SETH prevents this.

### 8.1 Token-Aware Injection

Graph context is limited to an **800-token budget** (~3200 chars). Items are ranked by composite score and injected until the budget is exhausted.

### 8.2 Deduplication Suppression

Fingerprint-based deduplication catches the same entity appearing as both a direct match and a 1-hop relation, preventing redundant context injection.

### 8.3 Adaptive Compression

| Score Range | Max Length |
|---|---|
| < 0.4 (low relevance) | 100 chars |
| 0.4–0.6 (medium) | 180 chars |
| > 0.6 (high relevance) | Full text |

### 8.4 Exponential Relevance Decay

Context scoring uses a **14-day half-life** exponential decay (floor at 0.05). Information from two weeks ago retains ~50% weight. A month-old context is nearly invisible. Recent intelligence dominates.

### 8.5 Context Hierarchy

The system prompt is assembled in strict priority order:
1. SETH Identity & Doctrine
2. User Profile (objectives, preferences, working style)
3. Weighted Memories (decay-adjusted, importance-weighted)
4. Location Context (if available)
5. Knowledge Graph Context (budget-managed)
6. Response Cadence Protocol (wearable only)
7. Tool Instructions & Capabilities

---

## IX. Tool Capabilities

SETH's tools extend its reach beyond conversation:

| Tool | Function |
|---|---|
| `web_search` | Real-time web intelligence |
| `create_task` | Task creation with autonomy levels |
| `save_memory` | Long-term knowledge persistence |
| `search_memories` | Contextual memory retrieval |
| `generate_environment` | 360° panoramic environment generation |
| `browser_automate` | Headless browser automation (form filling, scraping, screenshots) |
| `check_calendar` | Google Calendar read/write |
| `triage_email` | Gmail inbox management |
| `delegate_to_agent` | Agent dispatch (auto/team/direct) |

---

## X. Proactive Alert System

SETH doesn't wait to be asked. It surfaces what matters:

- **Contradiction Alerts**: New high-confidence behavioral contradictions
- **Pattern Alerts**: Significant behavior patterns detected
- **Memory Health Alerts**: Low average memory strength (decay degradation)
- **Insight Alerts**: Warning/critical insights from cognitive load, strategic drift, or environmental analysis

Alerts appear in the AlertCenter with type-specific icons and direct links to the relevant Cortex tab.

---

## XI. Knowledge Base

SETH's long-term memory is seeded with strategic frameworks:

- **The Wealth Language** — Money as frozen labor, semantic arbitrage, Cashflow Quadrant migration
- **Architecture of Advantage** — 10 influence mechanics, 4-level defense hierarchy
- **The Perception Lever** — Barnum Effect economics, subjective validation
- **The Leverage Code** — 6 value mechanics, position-based compensation
- **Private Capital Playbook** — Deal curation, GP-led secondaries, Central Intelligence File
- **Operational Security Framework** — Practical obscurity, data broker mitigation

These frameworks inform SETH's strategic reasoning across all interactions.

---

## XII. Navigation & Interface

The dashboard is organized into four collapsible sections:

| Section | Modules |
|---|---|
| **Core** | Chat, Tasks, Memories |
| **Intelligence** | Watches, Agents, Brand |
| **Tools** | Automations, Environments, Calendar, Email |
| **System** | Cortex, System, Settings, Profile |

### Visual Language
- **Dark theme**: Electric blue primary (#3B82F6), deep backgrounds (222 14% 7%)
- **Glow tokens**: Active elements pulse with electric-blue glow
- **Typography**: `font-display` for headings, tight tracking, responsive sizing
- **Animations**: framer-motion page transitions, wake-word pulse, TTS-reactive environment glow

---

## XIII. Data Architecture

### Core Models
- `User` — Principal identity, preferences, objectives, working style, API key
- `Conversation` / `Message` — Chat threads with environment metadata
- `Memory` — Typed knowledge with decay mechanics (strength, accessCount, pinned)
- `Task` — Managed items with autonomy levels, priority, approval workflows
- `Agent` — Specialized sub-agents with capabilities, domain scores, latency profiles

### Cortex Models
- `CortexObservation` — Behavioral telemetry events
- `CortexPattern` — Detected behavior patterns
- `CortexReflection` — Periodic self-analysis
- `CortexContradiction` — Goal/behavior conflicts
- `CortexEntity` / `CortexRelation` — Knowledge graph
- `CortexProject` / `CortexProjectLink` — Cross-entity project mapping
- `CortexInsight` — Analytical outputs (cognitive load, drift, correlation)
- `CortexLearningJob` — Async processing queue

### Infrastructure Models
- `RoutingDecision` — Agent selection audit trail
- `TelemetryTrace` — Pipeline execution traces
- `AgentLog` — Model/tool usage logging
- `Skill` — Reusable skill templates
- `UserPreference` — Dynamic JSON preferences

---

## XIV. What Makes SETH Different

1. **Self-improving**: Every interaction feeds Cortex. Patterns emerge. Contradictions surface. The system learns.
2. **Multi-modal**: Text, voice (browser), voice (wearable), environment (visual). Same intelligence, different surfaces.
3. **Agent-orchestrated**: Five specialists, adaptively routed, with feedback loops that improve selection over time.
4. **Context-aware**: Knowledge graph + weighted memories + token-budgeted injection = relevant context without noise.
5. **Observable**: Full telemetry tracing from auth to response. Latency heatmaps. Failure diagnostics. Nothing is a black box.
6. **Executive-grade**: Response cadence adapts to the channel. Voice gets brevity. Browser gets depth. The principal gets clarity.

SETH is not a product. It is an operating layer for consequential people.

---

*End of Addendum*
