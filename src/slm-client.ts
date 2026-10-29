import { getSlmConfig } from './slm-config'
import { getReviewPromptConfig, reviewOutputContract } from './review-prompts'
import type { StoredReviewFile } from './review-db'
import { trace } from './diagnostics'
import { CommentCategory, CommentSeverity } from './enums'
import {
  computeScopeSignature,
  normalizeScopeKeyText,
  ReviewScopeStorage,
  toReducedScopeSummary,
  type ReviewSkillName,
  type ScopeExecutionResult,
  type ScopeTaskDefinition,
} from './review-memory'
import type { Engram } from 'engram-ts'

export interface SlmSuggestion {
  id: string
  filePath: string
  line: number
  severity: CommentSeverity
  category: CommentCategory
  message: string
  recommendation: string
}

export interface AnalyzeFileOptions {
  reviewId?: number
  project?: string
  engram?: Engram
  maxDepth?: number
  maxConcurrency?: number
  requestTimeoutMs?: number
  concurrencyGate?: SlmConcurrencyGate
}

interface RawToolCallDelta {
  index?: number
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface ChatCompletionChunk {
  choices?: Array<{
    index?: number
    finish_reason?: string | null
    delta?: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
      tool_calls?: RawToolCallDelta[]
    }
    message?: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
      tool_calls?: Array<{
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
}

export interface ParsedToolCall {
  id: string
  name: string
  argumentsRaw: string
  args: Record<string, unknown>
}

export interface OpenAiToolSpec {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

const DEFAULT_STREAM_INACTIVITY_TIMEOUT_MS = 90_000
const MAX_SUBTASKS_PER_SCOPE = 6

/**
 * Request-level concurrency gate (FIFO semaphore) that limits the number of simultaneous
 * HTTP requests to the local SLM runtime across the entire recursion tree.
 * Because parent scopes release their slot as soon as Step 1 completes (before awaiting children),
 * parent-child semaphore deadlocks are impossible and browser HTTP connection pools are never exhausted.
 */
export class SlmConcurrencyGate {
  private active = 0
  private readonly queue: Array<() => void> = []
  private readonly limit: number

  constructor(maxConcurrent: number) {
    this.limit = Math.max(1, maxConcurrent)
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    if (this.active < this.limit) {
      this.active += 1
      let released = false
      return () => {
        if (released) return
        released = true
        this.release()
      }
    }

    return new Promise<() => void>((resolve, reject) => {
      let settled = false
      const onAbort = () => {
        if (settled) return
        settled = true
        const idx = this.queue.indexOf(wake)
        if (idx >= 0) this.queue.splice(idx, 1)
        reject(new DOMException('Aborted', 'AbortError'))
      }

      const wake = () => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        let released = false
        resolve(() => {
          if (released) return
          released = true
          this.release()
        })
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      this.queue.push(wake)
    })
  }

  private release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.active = Math.max(0, this.active - 1)
    }
  }
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function parseSeverity(val: unknown): CommentSeverity {
  if (typeof val === 'number') {
    if (val === CommentSeverity.LOW || val === CommentSeverity.MEDIUM || val === CommentSeverity.HIGH) {
      return val
    }
  }
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim()
    if (s === 'baja' || s === 'low' || s === '1' || s.includes('minor') || s.includes('info')) return CommentSeverity.LOW
    if (s === 'media' || s === 'medium' || s === '2' || s.includes('warn')) return CommentSeverity.MEDIUM
    if (s === 'alta' || s === 'high' || s === '3' || s.includes('crit') || s.includes('error')) return CommentSeverity.HIGH
  }
  return CommentSeverity.MEDIUM
}

function parseCategory(val: unknown): CommentCategory {
  if (typeof val === 'number') {
    if (val === CommentCategory.SOLID || val === CommentCategory.SECURITY || val === CommentCategory.QUALITY) {
      return val
    }
  }
  if (typeof val === 'string') {
    const c = val.toLowerCase().trim()
    if (c === 'solid' || c === '1' || c.includes('solid') || c.includes('design') || c.includes('diseño')) return CommentCategory.SOLID
    if (c === 'security' || c === 'seguridad' || c === '2' || c.includes('secur') || c.includes('segur') || c.includes('vulnerab')) return CommentCategory.SECURITY
    if (c === 'quality' || c === 'calidad' || c === '3' || c.includes('qual') || c.includes('calid') || c.includes('style') || c.includes('mant')) return CommentCategory.QUALITY
  }
  return CommentCategory.SOLID
}

function normalizeSuggestions(items: unknown[], fallbackFilePath?: string): SlmSuggestion[] {
  return items.flatMap((item, index): SlmSuggestion[] => {
    if (!item || typeof item !== 'object') {
      trace('slm.suggestion.normalize_discarded', { reason: 'not_an_object', rawItemType: typeof item })
      return []
    }
    const raw = item as Record<string, unknown>
    const rawFilePath = typeof raw.filePath === 'string' ? raw.filePath.trim() : typeof raw.file === 'string' ? raw.file.trim() : typeof raw.path === 'string' ? raw.path.trim() : ''
    const filePath = fallbackFilePath ?? (rawFilePath || 'unknown')

    const lineRaw = raw.line ?? raw.lineNumber ?? raw.line_number
    const lineNum = typeof lineRaw === 'string' ? Number.parseInt(lineRaw, 10) : typeof lineRaw === 'number' ? Math.round(lineRaw) : 1
    const line = Number.isInteger(lineNum) && lineNum > 0 ? lineNum : 1

    const severity = parseSeverity(raw.severity)
    const category = parseCategory(raw.category)

    const rawMessage = typeof raw.message === 'string' ? raw.message.trim()
      : typeof raw.description === 'string' ? raw.description.trim()
      : typeof raw.comment === 'string' ? raw.comment.trim()
      : typeof raw.details === 'string' ? raw.details.trim()
      : typeof raw.text === 'string' ? raw.text.trim()
      : typeof raw.observation === 'string' ? raw.observation.trim()
      : ''

    const rawRec = typeof raw.recommendation === 'string' ? raw.recommendation.trim()
      : typeof raw.suggestion === 'string' ? raw.suggestion.trim()
      : typeof raw.remediation === 'string' ? raw.remediation.trim()
      : typeof raw.solution === 'string' ? raw.solution.trim()
      : typeof raw.proposal === 'string' ? raw.proposal.trim()
      : typeof raw.propuesta === 'string' ? raw.propuesta.trim()
      : ''

    const message = rawMessage || rawRec
    const recommendation = rawRec || rawMessage

    if (!message) {
      trace('slm.suggestion.normalize_discarded', {
        reason: 'missing_message_and_recommendation',
        filePath,
        line,
        rawKeys: Object.keys(raw),
      })
      return []
    }

    const id = raw.id !== undefined && raw.id !== null && String(raw.id).trim().length > 0
      ? String(raw.id).trim()
      : `sug-${index + 1}-${line}-${Date.now()}`

    return [{
      id,
      filePath,
      line,
      severity,
      category,
      message,
      recommendation,
    }]
  })
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export function getGenericFilterReason(suggestion: SlmSuggestion): string | null {
  const text = normalizeText(`${suggestion.message} ${suggestion.recommendation}`)
  if (text.length < 24) {
    return 'length_below_minimum'
  }
  if (/(?:todas las lineas|cada linea|nombre .* no cumple|cumple con el estandar|asegurate de que .* sea unico|mejora la calidad del codigo|sigue las buenas practicas|revisa este codigo)/i.test(text)) {
    return 'matched_generic_pattern'
  }
  return null
}

export function isGenericSuggestion(suggestion: SlmSuggestion) {
  return getGenericFilterReason(suggestion) !== null
}

export function filterSuggestions(suggestions: SlmSuggestion[]) {
  const seen = new Set<string>()
  const result: SlmSuggestion[] = []
  for (const suggestion of suggestions) {
    const genericReason = getGenericFilterReason(suggestion)
    if (genericReason !== null) {
      trace('slm.suggestion.discarded', {
        filePath: suggestion.filePath,
        line: suggestion.line,
        reason: 'generic_filter',
        detail: genericReason,
        message: suggestion.message,
        recommendation: suggestion.recommendation,
      })
      continue
    }
    const key = `${suggestion.filePath}:${suggestion.line}:${normalizeText(suggestion.message)}`
    if (seen.has(key)) {
      trace('slm.suggestion.discarded', {
        filePath: suggestion.filePath,
        line: suggestion.line,
        reason: 'duplicate_in_file',
        key,
        message: suggestion.message,
      })
      continue
    }
    seen.add(key)
    result.push(suggestion)
  }
  return result
}

function completeJsonObjects(content: string) {
  const objects: string[] = []
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < content.length; index += 1) {
      const character = content[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === '{') depth += 1
      else if (character === '}') {
        depth -= 1
        if (depth === 0) {
          objects.push(content.slice(start, index + 1))
          start = index
          break
        }
      }
    }
  }
  return objects
}

export function parseSuggestions(content: string, allowEmpty = false, fallbackFilePath?: string): SlmSuggestion[] {
  const jsonContent = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content
  try {
    const parsed = JSON.parse(jsonContent.trim()) as { suggestions?: unknown }
    if (Array.isArray(parsed.suggestions)) {
      trace('slm.parse.json_array_success', {
        filePath: fallbackFilePath,
        rawCount: parsed.suggestions.length,
      })
      return normalizeSuggestions(parsed.suggestions, fallbackFilePath)
    }
  } catch {
    // A length-limited response can contain complete suggestion objects without closing the outer JSON.
  }
  const rawObjects = completeJsonObjects(jsonContent)
  trace('slm.parse.fallback_objects', {
    filePath: fallbackFilePath,
    objectCount: rawObjects.length,
  })
  const candidateItems: unknown[] = []
  for (const raw of rawObjects) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        if ('suggestions' in parsed && Array.isArray((parsed as { suggestions: unknown[] }).suggestions)) {
          candidateItems.push(...(parsed as { suggestions: unknown[] }).suggestions)
        } else if ('message' in parsed || 'description' in parsed || 'recommendation' in parsed || 'suggestion' in parsed) {
          candidateItems.push(parsed)
        }
      }
    } catch {
      // Skip unparseable slice
    }
  }
  const suggestions = normalizeSuggestions(candidateItems, fallbackFilePath)
  if (!suggestions.length && !allowEmpty) {
    trace('slm.parse.empty_or_invalid', {
      filePath: fallbackFilePath,
      contentLength: content.length,
    })
    throw new Error('El SLM devolvio un JSON incompleto o sin sugerencias validas.')
  }
  return suggestions
}

/**
 * Executes async tasks with a maximum concurrency limit.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runNext()))
  return results
}

const suggestionItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    filePath: { type: 'string' },
    line: { type: 'integer', minimum: 1 },
    severity: { type: 'string', enum: ['baja', 'media', 'alta'] },
    category: { type: 'string', enum: ['solid', 'security', 'quality'] },
    message: { type: 'string' },
    recommendation: { type: 'string' },
  },
  required: ['id', 'filePath', 'line', 'severity', 'category', 'message', 'recommendation'],
}

/**
 * Builds the native OpenAI Function Calling (`tools`) definitions for Step 1 of a Scope node:
 * - `ejecutar_tarea_atomica` (base case: solve in this scope)
 * - `descomponer_en_subtareas` (recursive case: split into concurrent child sub-scopes, available when depth < maxDepth)
 * - `reutilizar_scope_memoria` (memory case: reuse an already-executed scope from engram-ts)
 */
export function buildStep1ScopeTools(allowDecompose: boolean, hasMemoryHeaders: boolean): OpenAiToolSpec[] {
  const tools: OpenAiToolSpec[] = [
    {
      type: 'function',
      function: {
        name: 'ejecutar_tarea_atomica',
        description:
          'Úsala si la tarea asignada a este Scope se puede resolver directamente en este paso sin subdividir en más sub-hilos.',
        parameters: {
          type: 'object',
          properties: {
            skill_a_usar: {
              type: 'string',
              enum: ['skill_solid', 'skill_security', 'skill_quality', 'skill_general'],
              description: 'Skill especializada para ejecutar el análisis atómico del código de este Scope.',
            },
            argumentos: {
              type: 'object',
              properties: {
                foco: {
                  type: 'string',
                  description: 'Aspecto concreto del código a revisar en esta ejecución atómica.',
                },
                lineStart: { type: 'integer', minimum: 1 },
                lineEnd: { type: 'integer', minimum: 1 },
                sumario_ejecutivo: {
                  type: 'string',
                  description: 'Resumen ejecutivo de hasta 3 líneas si ya has determinado el resultado.',
                },
                suggestions: {
                  type: 'array',
                  items: suggestionItemSchema,
                  description: 'Lista opcional de hallazgos directos si la tarea atómica ya ha sido resuelta.',
                },
              },
              required: ['foco'],
            },
          },
          required: ['skill_a_usar', 'argumentos'],
        },
      },
    },
  ]

  if (allowDecompose) {
    tools.push({
      type: 'function',
      function: {
        name: 'descomponer_en_subtareas',
        description:
          'Úsala si la tarea o fichero es complejo y requiere delegar el trabajo en sub-scopes concurrentes más específicos (por bloques de líneas o por skills especializadas) para evitar saturar el contexto.',
        parameters: {
          type: 'object',
          properties: {
            justificacion: {
              type: 'string',
              description: 'Motivo por el que se divide el análisis en sub-scopes independientes.',
            },
            subtareas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id_subtarea: { type: 'string' },
                  descripcion: { type: 'string' },
                  skill_requerida: {
                    type: 'string',
                    enum: ['skill_solid', 'skill_security', 'skill_quality', 'skill_general'],
                  },
                  lineStart: { type: 'integer', minimum: 1 },
                  lineEnd: { type: 'integer', minimum: 1 },
                },
                required: ['id_subtarea', 'descripcion'],
              },
            },
          },
          required: ['subtareas'],
        },
      },
    })
  }

  if (hasMemoryHeaders) {
    tools.push({
      type: 'function',
      function: {
        name: 'reutilizar_scope_memoria',
        description:
          'Úsala si en el catálogo de memorias de engram-ts ya existe un sub-scope completado equivalente a esta tarea, para reutilizar su resultado sin generar un scope adicional.',
        parameters: {
          type: 'object',
          properties: {
            id_scope: {
              type: 'string',
              description: 'ID de memoria o referencia engram_ref del scope previamente ejecutado.',
            },
            motivo: {
              type: 'string',
              description: 'Justificación de por qué el resultado almacenado cubre esta tarea.',
            },
          },
          required: ['id_scope'],
        },
      },
    })
  }

  return tools
}

export function buildAtomicSkillTools(): OpenAiToolSpec[] {
  return [
    {
      type: 'function',
      function: {
        name: 'registrar_hallazgos_atomicos',
        description:
          'Registra el sumario ejecutivo y la lista exacta de sugerencias/hallazgos detectados por la Skill en este Scope atómico.',
        parameters: {
          type: 'object',
          properties: {
            sumario_ejecutivo: {
              type: 'string',
              description: 'Resumen ejecutivo de máximo 3 líneas con las conclusiones de este Scope.',
            },
            suggestions: {
              type: 'array',
              items: suggestionItemSchema,
            },
          },
          required: ['sumario_ejecutivo', 'suggestions'],
        },
      },
    },
  ]
}

export function buildReductionTools(allowDetailQuery: boolean): OpenAiToolSpec[] {
  const tools: OpenAiToolSpec[] = [
    {
      type: 'function',
      function: {
        name: 'consolidar_resultados_scope',
        description:
          'Unifica los resultados reducidos de los sub-scopes hijos en un sumario ejecutivo consolidado y una lista limpia de sugerencias sin duplicados para el Scope padre.',
        parameters: {
          type: 'object',
          properties: {
            sumario_ejecutivo: {
              type: 'string',
              description: 'Síntesis ejecutiva consolidada de este nivel de Scope.',
            },
            suggestions: {
              type: 'array',
              items: suggestionItemSchema,
            },
          },
          required: ['sumario_ejecutivo', 'suggestions'],
        },
      },
    },
  ]

  if (allowDetailQuery) {
    tools.push({
      type: 'function',
      function: {
        name: 'consultar_detalle_scope',
        description:
          'Consulta el documento completo de un sub-scope hijo almacenado en engram-ts citando su id_scope o engram_ref si necesitas verificar un detalle específico antes de consolidar.',
        parameters: {
          type: 'object',
          properties: {
            id_scope: {
              type: 'string',
              description: 'Identificador id_scope o referencia engram_ref del sub-scope a consultar.',
            },
            pregunta: {
              type: 'string',
              description: 'Dato o verificación concreta que se desea extraer del scope.',
            },
          },
          required: ['id_scope', 'pregunta'],
        },
      },
    })
  }

  return tools
}

export function extractFileCodeSlice(
  file: StoredReviewFile,
  lineStart?: number,
  lineEnd?: number,
): { codeWithLines: string; rawSlice: string; totalLines: number; startLine: number; endLine: number } {
  const rawSource = file.content ?? file.patch ?? ''
  const allLines = rawSource.split('\n')
  const totalLines = allLines.length
  const start = lineStart && lineStart >= 1 ? Math.min(lineStart, totalLines) : 1
  const end = lineEnd && lineEnd >= start ? Math.min(lineEnd, totalLines) : totalLines

  const sliced = allLines.slice(start - 1, end)
  const numbered = sliced.map((line, idx) => `L${start + idx}: ${line}`).join('\n')

  return {
    codeWithLines: numbered,
    rawSlice: sliced.join('\n'),
    totalLines,
    startLine: start,
    endLine: end,
  }
}

function getSkillInstructions(skill: ReviewSkillName, baseInstructions: string): string {
  switch (skill) {
    case 'skill_solid':
      return `${baseInstructions}\n\n[SKILL ACTIVA: skill_solid]\nEnfócate específicamente en principios SOLID (Responsabilidad Única, Abierto/Cerrado, Sustitución de Liskov, Segregación de Interfaces, Inversión de Dependencias), acoplamiento y diseño modular. Asigna category: "solid".`
    case 'skill_security':
      return `${baseInstructions}\n\n[SKILL ACTIVA: skill_security]\nEnfócate específicamente en vulnerabilidades de seguridad: inyección, exposición de secretos/tokens, falta de validación/sanitización, control de acceso y criptografía insegura. Asigna category: "security".`
    case 'skill_quality':
      return `${baseInstructions}\n\n[SKILL ACTIVA: skill_quality]\nEnfócate específicamente en calidad de código, fugas de recursos/memoria, manejo de errores, complejidad ciclomática y defectos funcionales. Asigna category: "quality".`
    case 'skill_general':
    default:
      return `${baseInstructions}\n\n[SKILL ACTIVA: skill_general]\nAnaliza integralmente principios SOLID, seguridad y calidad sobre el fragmento asignado.`
  }
}

function safeParseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    const objects = completeJsonObjects(trimmed)
    for (const candidate of objects) {
      try {
        const parsed = JSON.parse(candidate) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // Continue trying next object
      }
    }
  }
  return {}
}

interface SlmToolCallResponse {
  toolCalls: ParsedToolCall[]
  contentBuffer: string
  finishReason: string | null
  reasoningChars: number
  streamedSuggestions: SlmSuggestion[]
}

async function callSlmWithTools(params: {
  file: StoredReviewFile
  scopeId?: string
  messages: ChatMessage[]
  tools: OpenAiToolSpec[]
  toolChoice?: 'none' | 'auto' | 'required'
  streamSuggestionsToCallback?: boolean
  concurrencyGate?: SlmConcurrencyGate
  requestTimeoutMs?: number
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>
  onThinking?: (thought: string) => void | Promise<void>
  signal?: AbortSignal
}): Promise<SlmToolCallResponse> {
  const { file, messages, tools, onSuggestion, onThinking, signal } = params
  const releaseGate = params.concurrencyGate
    ? await params.concurrencyGate.acquire(signal)
    : () => {}

  const inactivityTimeoutMs = params.requestTimeoutMs ?? DEFAULT_STREAM_INACTIVITY_TIMEOUT_MS
  const requestAbortController = new AbortController()
  let timedOut = false
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined

  const resetInactivityTimer = () => {
    if (inactivityTimer !== undefined) clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(() => {
      timedOut = true
      requestAbortController.abort()
    }, inactivityTimeoutMs)
  }

  const onParentAbort = () => {
    requestAbortController.abort()
  }
  signal?.addEventListener('abort', onParentAbort, { once: true })
  if (signal?.aborted) {
    requestAbortController.abort()
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  try {
    const config = getSlmConfig()
    const startedAt = performance.now()
    const toolChoice = params.toolChoice ?? 'required'

    trace('slm.stream.start', {
      filePath: file.path,
      scopeId: params.scopeId,
      model: config.model,
      maxTokens: config.maxTokens,
      tools: tools.map((t) => t.function.name),
    })

    resetInactivityTimer()

    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: requestAbortController.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        max_completion_tokens: config.maxTokens,
        stream: true,
        verbosity: 'low',
        chat_template_kwargs: {
          enable_thinking: true,
        },
        tools,
        tool_choice: toolChoice,
        messages,
      }),
    })

    resetInactivityTimer()

    trace('slm.stream.response_status', {
      filePath: file.path,
      scopeId: params.scopeId,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    if (!response.ok) {
      const errorDetail = await response.text().catch(() => '')
      trace('slm.stream.response_error', {
        filePath: file.path,
        scopeId: params.scopeId,
        status: response.status,
        errorDetail: errorDetail.slice(0, 500),
      })
      throw new Error(`El runtime SLM respondio ${response.status}${errorDetail ? `: ${errorDetail.slice(0, 200)}` : '.'}`)
    }
    if (!response.body) {
      throw new Error('El runtime SLM no devolvio un cuerpo de respuesta.')
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let streamBuffer = ''
    let rawResponseText = ''
    let contentBuffer = ''
    let finishReason: string | null = null
    let reasoningChars = 0
    let contentChars = 0
    let accumulatedThought = ''

    let inThinkTag = false
    let thinkTagBuffer = ''

    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

    function recordToolCallDelta(
      idx: number,
      id: string | undefined,
      name: string | undefined,
      argsChunk: string | undefined,
    ) {
      const existing = toolCallsMap.get(idx) ?? {
        id: id || `call_${idx}_${Date.now()}`,
        name: '',
        arguments: '',
      }
      if (id) existing.id = id
      if (name) existing.name = existing.name ? existing.name : name
      if (typeof argsChunk === 'string') {
        existing.arguments += argsChunk
      }
      toolCallsMap.set(idx, existing)
      if (params.streamSuggestionsToCallback && existing.arguments.length > 0) {
        checkIncrementalSuggestions(existing.arguments)
      }
    }

    function processContentDelta(text: string): string {
      let combined = thinkTagBuffer + text
      thinkTagBuffer = ''
      let clean = ''

      while (combined.length > 0) {
        if (!inThinkTag) {
          const openIdx = combined.indexOf('<think>')
          if (openIdx !== -1) {
            clean += combined.slice(0, openIdx)
            inThinkTag = true
            combined = combined.slice(openIdx + 7)
          } else {
            const possiblePartial = combined.match(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/)
            if (possiblePartial && possiblePartial.index !== undefined) {
              clean += combined.slice(0, possiblePartial.index)
              thinkTagBuffer = possiblePartial[0]
              combined = ''
            } else {
              clean += combined
              combined = ''
            }
          }
        } else {
          const closeIdx = combined.indexOf('</think>')
          if (closeIdx !== -1) {
            const thinkChunk = combined.slice(0, closeIdx)
            accumulatedThought += thinkChunk
            reasoningChars += closeIdx
            inThinkTag = false
            combined = combined.slice(closeIdx + 8)
            if (onThinking) {
              try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
            }
          } else {
            const possiblePartial = combined.match(/<\/t(?:h(?:i(?:n(?:k)?)?)?)?$/)
            if (possiblePartial && possiblePartial.index !== undefined) {
              const thinkChunk = combined.slice(0, possiblePartial.index)
              accumulatedThought += thinkChunk
              reasoningChars += possiblePartial.index
              thinkTagBuffer = possiblePartial[0]
              combined = ''
            } else {
              accumulatedThought += combined
              reasoningChars += combined.length
              combined = ''
            }
            if (onThinking) {
              try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
            }
          }
        }
      }
      return clean
    }

    const seenSuggestionKeys = new Set<string>()
    const streamedSuggestions: SlmSuggestion[] = []

    function checkIncrementalSuggestions(currentContent: string) {
      const rawObjects = completeJsonObjects(currentContent)
      if (rawObjects.length === 0) return
      const itemsToCheck: unknown[] = []
      for (const raw of rawObjects) {
        try {
          const parsed = JSON.parse(raw) as unknown
          if (parsed && typeof parsed === 'object') {
            if ('suggestions' in parsed && Array.isArray((parsed as { suggestions: unknown[] }).suggestions)) {
              itemsToCheck.push(...(parsed as { suggestions: unknown[] }).suggestions)
            } else if (
              ('message' in parsed || 'description' in parsed || 'recommendation' in parsed || 'suggestion' in parsed) &&
              !('subtareas' in parsed) &&
              !('skill_a_usar' in parsed)
            ) {
              itemsToCheck.push(parsed)
            }
          }
        } catch {
          // Skip incomplete or unparseable object slice
        }
      }
      if (itemsToCheck.length > 0) {
        const normalized = normalizeSuggestions(itemsToCheck, file.path)
        for (const suggestion of normalized) {
          const genericReason = getGenericFilterReason(suggestion)
          if (genericReason !== null) {
            const key = `${suggestion.filePath}:${suggestion.line}:${normalizeText(suggestion.message)}`
            if (!seenSuggestionKeys.has(key)) {
              seenSuggestionKeys.add(key)
              trace('slm.suggestion.discarded', {
                filePath: suggestion.filePath,
                line: suggestion.line,
                reason: 'generic_filter_stream',
                detail: genericReason,
                message: suggestion.message,
              })
            }
            continue
          }
          const key = `${suggestion.filePath}:${suggestion.line}:${normalizeText(suggestion.message)}`
          if (seenSuggestionKeys.has(key)) {
            continue
          }
          seenSuggestionKeys.add(key)
          streamedSuggestions.push(suggestion)
          trace('slm.stream.suggestion_detected', {
            filePath: suggestion.filePath,
            line: suggestion.line,
            id: suggestion.id,
            severity: suggestion.severity,
            category: suggestion.category,
          })
          if (onSuggestion) {
            try {
              const maybePromise = onSuggestion(suggestion)
              if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
                (maybePromise as Promise<void>).catch((err: unknown) => {
                  trace('slm.stream.callback_error', {
                    filePath: file.path,
                    error: err instanceof Error ? err.message : String(err),
                  })
                })
              }
            } catch (err) {
              trace('slm.stream.callback_error', {
                filePath: file.path,
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }
        }
      }
    }

    function handleParsedChunk(parsed: ChatCompletionChunk) {
      const choice = parsed.choices?.[0]
      if (!choice) return
      if (choice.finish_reason) finishReason = choice.finish_reason

      const delta = choice.delta
      if (delta) {
        const rawReasoning = delta.reasoning_content ?? delta.reasoning
        if (typeof rawReasoning === 'string' && rawReasoning.length > 0) {
          accumulatedThought += rawReasoning
          reasoningChars += rawReasoning.length
          if (onThinking) {
            try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
          }
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const [idx, tc] of delta.tool_calls.entries()) {
            recordToolCallDelta(tc.index ?? idx, tc.id, tc.function?.name, tc.function?.arguments)
          }
        }

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          const cleanDelta = processContentDelta(delta.content)
          if (cleanDelta.length > 0) {
            contentBuffer += cleanDelta
            contentChars += cleanDelta.length
            if (params.streamSuggestionsToCallback) {
              checkIncrementalSuggestions(contentBuffer)
            }
          }
        }
      }

      const message = choice.message
      if (message) {
        const rawReasoning = message.reasoning_content ?? message.reasoning
        if (typeof rawReasoning === 'string' && rawReasoning.length > 0) {
          accumulatedThought += rawReasoning
          reasoningChars += rawReasoning.length
          if (onThinking) {
            try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
          }
        }

        if (Array.isArray(message.tool_calls)) {
          for (const [idx, tc] of message.tool_calls.entries()) {
            recordToolCallDelta(idx, tc.id, tc.function?.name, tc.function?.arguments)
          }
        }

        if (typeof message.content === 'string' && message.content.length > 0) {
          const cleanContent = processContentDelta(message.content)
          if (cleanContent.length > 0) {
            contentBuffer += cleanContent
            contentChars += cleanContent.length
            if (params.streamSuggestionsToCallback) {
              checkIncrementalSuggestions(contentBuffer)
            }
          }
        }
      }
    }

    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      resetInactivityTimer()
      if (done) break

      const decoded = decoder.decode(value, { stream: true })
      rawResponseText += decoded
      streamBuffer += decoded
      const lines = streamBuffer.split('\n')
      streamBuffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr) as ChatCompletionChunk
          handleParsedChunk(parsed)
        } catch {
          // Skip unparseable SSE chunk
        }
      }
    }

    if (streamBuffer.trim().startsWith('data:')) {
      const dataStr = streamBuffer.trim().slice(5).trim()
      if (dataStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataStr) as ChatCompletionChunk
          handleParsedChunk(parsed)
        } catch {
          // Skip
        }
      }
    } else if (toolCallsMap.size === 0 && contentBuffer.length === 0 && rawResponseText.trim().startsWith('{')) {
      // Support non-SSE standard JSON response bodies from runtimes or test mocks
      try {
        const parsed = JSON.parse(rawResponseText.trim()) as ChatCompletionChunk
        handleParsedChunk(parsed)
      } catch {
        // Ignore
      }
    }

    if (thinkTagBuffer.length > 0) {
      if (inThinkTag) {
        accumulatedThought += thinkTagBuffer
        reasoningChars += thinkTagBuffer.length
        if (onThinking) {
          try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
        }
      } else {
        contentBuffer += thinkTagBuffer
        contentChars += thinkTagBuffer.length
      }
    }

    const toolCalls: ParsedToolCall[] = [...toolCallsMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => ({
        id: tc.id,
        name: tc.name,
        argumentsRaw: tc.arguments,
        args: safeParseJsonObject(tc.arguments),
      }))
      .filter((tc) => tc.name.length > 0)

    trace('slm.stream.complete', {
      filePath: file.path,
      scopeId: params.scopeId,
      elapsedMs: Math.round(performance.now() - startedAt),
      reasoningChars,
      contentChars,
      finishReason,
      toolCallsCount: toolCalls.length,
      toolNames: toolCalls.map((t) => t.name),
      streamedCount: streamedSuggestions.length,
    })

    return {
      toolCalls,
      contentBuffer,
      finishReason,
      reasoningChars,
      streamedSuggestions,
    }
  } catch (err) {
    if (timedOut && !signal?.aborted) {
      trace('slm.stream.timeout', {
        filePath: file.path,
        scopeId: params.scopeId,
        timeoutMs: inactivityTimeoutMs,
      })
      throw new Error(`El runtime SLM excedió el tiempo de espera de inactividad (${Math.round(inactivityTimeoutMs / 1000)}s).`)
    }
    throw err
  } finally {
    if (inactivityTimer !== undefined) clearTimeout(inactivityTimer)
    signal?.removeEventListener('abort', onParentAbort)
    if (reader) {
      try {
        await reader.cancel()
      } catch {
        // Ignore cancel errors
      }
      try {
        reader.releaseLock()
      } catch {
        // Ignore lock release errors
      }
    }
    releaseGate()
  }
}

interface ScopeExecutionContext {
  file: StoredReviewFile
  baseInstructions: string
  maxDepth: number
  maxConcurrency: number
  concurrencyGate: SlmConcurrencyGate
  requestTimeoutMs?: number
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>
  onThinking?: (thought: string) => void | Promise<void>
  signal?: AbortSignal
}

/**
 * Executes a specialized atomic Skill in an isolated context using native Function Calling (`registrar_hallazgos_atomicos`).
 */
async function ejecutarSkillLocal(
  skill: ReviewSkillName,
  argumentos: Record<string, unknown>,
  task: ScopeTaskDefinition,
  storage: ReviewScopeStorage,
  context: ScopeExecutionContext,
): Promise<{ sumario_ejecutivo: string; suggestions: SlmSuggestion[] }> {
  const lineStart = typeof argumentos.lineStart === 'number' ? argumentos.lineStart : task.lineStart
  const lineEnd = typeof argumentos.lineEnd === 'number' ? argumentos.lineEnd : task.lineEnd
  const foco = typeof argumentos.foco === 'string' && argumentos.foco.trim()
    ? argumentos.foco.trim()
    : task.descripcion

  // If the SLM already supplied the atomic suggestions inside `ejecutar_tarea_atomica`, normalize and filter them directly
  const inlineSuggestionsRaw = Array.isArray(argumentos.suggestions) ? argumentos.suggestions : undefined
  if (inlineSuggestionsRaw) {
    const normalized = filterSuggestions(normalizeSuggestions(inlineSuggestionsRaw, context.file.path))
    const inlineSummary = typeof argumentos.sumario_ejecutivo === 'string' && argumentos.sumario_ejecutivo.trim()
      ? argumentos.sumario_ejecutivo.trim()
      : `Análisis atómico (${skill}) en ${context.file.path} [L${lineStart ?? 1}-L${lineEnd ?? 'fin'}]: ${normalized.length} hallazgo(s).`
    return {
      sumario_ejecutivo: inlineSummary,
      suggestions: normalized,
    }
  }

  const slice = extractFileCodeSlice(context.file, lineStart, lineEnd)
  const skillSystemPrompt = `${getSkillInstructions(skill, context.baseInstructions)}\n\nInvoca obligatoriamente la herramienta "registrar_hallazgos_atomicos" con el sumario_ejecutivo (máximo 3 líneas) y la lista de suggestions encontradas en este fragmento. Si no hay problemas concretos, devuelve suggestions: [].`
  const userPrompt = [
    `SCOPE ID: ${storage.scopeId}`,
    `SKILL: ${skill}`,
    `TAREA ATÓMICA: ${foco}`,
    `FICHERO: ${context.file.path} (Líneas ${slice.startLine} a ${slice.endLine} de ${slice.totalLines})`,
    `STATUS: ${context.file.status}`,
    '',
    'CÓDIGO DEL SCOPE:',
    slice.codeWithLines,
  ].join('\n')

  const response = await callSlmWithTools({
    file: context.file,
    scopeId: storage.scopeId,
    messages: [
      { role: 'system', content: skillSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: buildAtomicSkillTools(),
    toolChoice: 'required',
    streamSuggestionsToCallback: true,
    concurrencyGate: context.concurrencyGate,
    requestTimeoutMs: context.requestTimeoutMs,
    onSuggestion: context.onSuggestion,
    onThinking: context.onThinking,
    signal: context.signal,
  })

  const toolCall = response.toolCalls.find((tc) => tc.name === 'registrar_hallazgos_atomicos') ?? response.toolCalls[0]
  let rawSuggestions: SlmSuggestion[] = []
  let sumarioEjecutivo = ''

  if (toolCall) {
    if (typeof toolCall.args.sumario_ejecutivo === 'string') {
      sumarioEjecutivo = toolCall.args.sumario_ejecutivo.trim()
    }
    if (Array.isArray(toolCall.args.suggestions)) {
      rawSuggestions = normalizeSuggestions(toolCall.args.suggestions, context.file.path)
    } else if (toolCall.argumentsRaw) {
      rawSuggestions = parseSuggestions(toolCall.argumentsRaw, true, context.file.path)
    }
  } else if (response.contentBuffer.trim().length > 0) {
    rawSuggestions = parseSuggestions(response.contentBuffer, response.finishReason !== 'length', context.file.path)
  }

  if (rawSuggestions.length === 0 && response.streamedSuggestions.length > 0) {
    rawSuggestions = response.streamedSuggestions
  }

  const filtered = filterSuggestions(rawSuggestions)
  if (!sumarioEjecutivo) {
    sumarioEjecutivo = `Scope ${storage.scopeId} (${skill}) completado sobre ${context.file.path} [L${slice.startLine}-L${slice.endLine}]: ${filtered.length} hallazgo(s) detectado(s).`
  }

  return {
    sumario_ejecutivo: sumarioEjecutivo,
    suggestions: filtered,
  }
}

/**
 * Step 3 of the Homogeneous Scope Loop:
 * Consolidates and reduces the compact results of concurrent child sub-scopes in the Parent Scope.
 * Supports iterative on-demand detail retrieval (`consultar_detalle_scope`) from `engram-ts`.
 */
async function llamarLLMParaReduccion(
  resultadosSubHilos: ScopeExecutionResult[],
  task: ScopeTaskDefinition,
  storage: ReviewScopeStorage,
  context: ScopeExecutionContext,
): Promise<{ sumario_ejecutivo: string; suggestions: SlmSuggestion[] }> {
  const childSuggestions = resultadosSubHilos.flatMap((r) => r.suggestions)
  const fallbackSummary = resultadosSubHilos
    .map((r) => `[${r.id_scope}] ${r.sumario_ejecutivo}`)
    .join(' | ')
    .slice(0, 320)

  // Fast-path: if there is at most 1 child scope or 0 findings across all child scopes, consolidate deterministically
  if (resultadosSubHilos.length <= 1 || childSuggestions.length === 0) {
    return {
      sumario_ejecutivo: fallbackSummary || `Scope ${storage.scopeId} consolidado sin hallazgos.`,
      suggestions: filterSuggestions(childSuggestions),
    }
  }

  const reducedPayload = {
    estado: 'exitoso',
    scope_padre: storage.scopeId,
    fichero: context.file.path,
    resultados_reducidos: resultadosSubHilos.map(toReducedScopeSummary),
    nota_orquestador:
      'Los datos crudos y detalles completos se encuentran indexados en sus respectivos scopes en engram-ts. Puedes solicitar detalles específicos de un scope si es necesario citando su id_scope o engram_ref mediante consultar_detalle_scope, o unificar directamente con consolidar_resultados_scope.',
  }

  const systemContent = [
    'Eres el Redactor Agregador del Scope Padre.',
    'Tu objetivo es tomar los resultados fragmentados de los sub-scopes hijos concurrentes que han analizado distintas partes o dimensiones del código y unificarlos en un único resultado coherente, estructurado y sin redundancias.',
    'Si necesitas inspeccionar el detalle completo de un sub-scope indexado en engram-ts antes de consolidar, invoca "consultar_detalle_scope".',
    'Para emitir la síntesis final del Scope, invoca "consolidar_resultados_scope".',
  ].join('\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `Consolida los engramas resultantes del almacenamiento de subtareas para la tarea "${task.descripcion}" en el fichero ${context.file.path}:\n\n${JSON.stringify(reducedPayload, null, 2)}`,
    },
  ]

  try {
    // First reduction turn (allows `consultar_detalle_scope` or `consolidar_resultados_scope`)
    let response = await callSlmWithTools({
      file: context.file,
      scopeId: storage.scopeId,
      messages,
      tools: buildReductionTools(true),
      toolChoice: 'required',
      streamSuggestionsToCallback: true,
      concurrencyGate: context.concurrencyGate,
      requestTimeoutMs: context.requestTimeoutMs,
      onSuggestion: context.onSuggestion,
      onThinking: context.onThinking,
      signal: context.signal,
    })

    const detailCall = response.toolCalls.find((tc) => tc.name === 'consultar_detalle_scope')
    if (detailCall) {
      const requestedScopeId = String(detailCall.args.id_scope ?? '')
      const pregunta = String(detailCall.args.pregunta ?? 'Detalle completo del scope')
      trace('slm.scope.consultar_detalle', {
        parentScopeId: storage.scopeId,
        requestedScopeId,
        pregunta,
      })

      const detailResult = await storage.getScopeResultByMemoryId(requestedScopeId)
      messages.push({
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: detailCall.id,
            type: 'function',
            function: {
              name: detailCall.name,
              arguments: detailCall.argumentsRaw || JSON.stringify(detailCall.args),
            },
          },
        ],
      })
      messages.push({
        role: 'tool',
        tool_call_id: detailCall.id,
        name: 'consultar_detalle_scope',
        content: JSON.stringify(
          detailResult
            ? {
                estado: 'encontrado',
                id_scope: detailResult.id_scope,
                engram_ref: detailResult.engram_ref,
                pregunta,
                sumario_ejecutivo: detailResult.sumario_ejecutivo,
                suggestions: detailResult.suggestions,
              }
            : {
                estado: 'no_encontrado',
                id_scope: requestedScopeId,
                nota: 'Usa los resultados_reducidos ya disponibles para consolidar.',
              },
        ),
      })

      // Second turn: force final consolidation
      response = await callSlmWithTools({
        file: context.file,
        scopeId: storage.scopeId,
        messages,
        tools: buildReductionTools(false),
        toolChoice: 'required',
        streamSuggestionsToCallback: true,
        concurrencyGate: context.concurrencyGate,
        requestTimeoutMs: context.requestTimeoutMs,
        onSuggestion: context.onSuggestion,
        onThinking: context.onThinking,
        signal: context.signal,
      })
    }

    const consolidateCall = response.toolCalls.find((tc) => tc.name === 'consolidar_resultados_scope') ?? response.toolCalls[0]

    let aggregatedSuggestions: SlmSuggestion[] = []
    let sumarioConsolidado = ''

    if (consolidateCall) {
      if (typeof consolidateCall.args.sumario_ejecutivo === 'string') {
        sumarioConsolidado = consolidateCall.args.sumario_ejecutivo.trim()
      }
      if (Array.isArray(consolidateCall.args.suggestions)) {
        aggregatedSuggestions = normalizeSuggestions(consolidateCall.args.suggestions, context.file.path)
      }
    } else if (response.contentBuffer.trim().length > 0) {
      aggregatedSuggestions = parseSuggestions(response.contentBuffer, true, context.file.path)
    }

    const combinedSuggestions = filterSuggestions(
      aggregatedSuggestions.length > 0 ? [...aggregatedSuggestions, ...childSuggestions] : childSuggestions,
    )

    return {
      sumario_ejecutivo: sumarioConsolidado || fallbackSummary,
      suggestions: combinedSuggestions,
    }
  } catch (err) {
    if (context.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err
    }
    trace('slm.scope.reduction_fallback', {
      scopeId: storage.scopeId,
      reason: err instanceof Error ? err.message : String(err),
      childSuggestionsCount: childSuggestions.length,
    })
    return {
      sumario_ejecutivo: fallbackSummary,
      suggestions: filterSuggestions(childSuggestions),
    }
  }
}

/**
 * Homogeneous Fractal Orchestrator Loop (`procesarNodoScope`).
 * Every scope thread (whether the root file scope or a descendant sub-scope) executes the exact same 3-step lifecycle:
 * 1. Check `engram-ts` memory for an already-completed equivalent sub-scope; if not cached, ask the SLM via native `tools`
 *    whether to solve atomically (`ejecutar_tarea_atomica`), reuse memory (`reutilizar_scope_memoria`), or decompose (`descomponer_en_subtareas`).
 * 2. If decomposed, persist the sub-plan in `engram-ts` and launch child sub-scopes concurrently (bounded by `SlmConcurrencyGate`).
 * 3. Reduce and consolidate child scope results into the current Scope Storage (`engram-ts`) and return the compact result to the parent.
 */
export async function procesarNodoScope(
  task: ScopeTaskDefinition,
  parentStorage: ReviewScopeStorage,
  context: ScopeExecutionContext,
  isRootScope = false,
): Promise<ScopeExecutionResult> {
  if (context.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  await yieldToMainThread()

  const currentStorage = isRootScope
    ? parentStorage
    : parentStorage.createChildScopeStorage(task.id_subtarea)

  const slice = extractFileCodeSlice(context.file, task.lineStart, task.lineEnd)

  // Pre-Step 1: Check engram-ts memory to see if an equivalent scope was already executed by a non-ancestor scope
  const cachedResult = await currentStorage.findReusableScopeResult(task, slice.rawSlice)
  if (cachedResult) {
    trace('slm.scope.memory_reused', {
      scopeId: currentStorage.scopeId,
      reusedFromScopeId: cachedResult.id_scope,
      engramRef: cachedResult.engram_ref,
      depth: currentStorage.depth,
      suggestionsCount: cachedResult.suggestions.length,
    })
    if (context.onThinking) {
      try {
        void context.onThinking(`[engram-ts] Reutilizando memoria de scope ${cachedResult.id_scope} (${cachedResult.engram_ref})`)
      } catch {
        // Ignore callback error
      }
    }
    if (context.onSuggestion) {
      for (const suggestion of cachedResult.suggestions) {
        try {
          await context.onSuggestion(suggestion)
        } catch {
          // Ignore callback error
        }
      }
    }
    return cachedResult
  }

  const { sigTag } = computeScopeSignature({
    filePath: context.file.path,
    skill: task.skill_requerida,
    lineStart: task.lineStart,
    lineEnd: task.lineEnd,
    codeSlice: slice.rawSlice,
    descripcion: task.descripcion,
  })

  const executionPromise = (async (): Promise<ScopeExecutionResult> => {
    const canDecompose = currentStorage.depth < context.maxDepth && task.requiere_sub_planificacion !== false
    const relatedHeaders = await currentStorage.listRelatedScopeHeaders(task)
    const step1Tools = buildStep1ScopeTools(canDecompose, relatedHeaders.length > 0)

    const memoryCatalogText = relatedHeaders.length > 0
      ? `\n\nMEMORIAS DISPONIBLES EN ENGRAM-TS (Scopes ya ejecutados en este proyecto/fichero):\n${relatedHeaders
          .map((h) => `- id_scope/memory_id: "${h.id}" | título: "${h.title}" | tags: [${h.tags.join(', ')}]`)
          .join('\n')}\nSi alguna memoria ya cubre exactamente esta tarea, invoca "reutilizar_scope_memoria".`
      : ''

    const step1SystemPrompt = [
      'Eres un nodo de procesamiento autónomo dentro de una arquitectura fractal de revisión de código con memoria engram-ts.',
      context.baseInstructions,
      '',
      'CATÁLOGO DE SKILLS DISPONIBLES:',
      '- skill_solid: Principios SOLID, acoplamiento, diseño modular y responsabilidades.',
      '- skill_security: Seguridad, inyecciones, validación de entradas, secretos y autenticación.',
      '- skill_quality: Calidad, gestión de recursos/errores, legibilidad y defectos funcionales.',
      '- skill_general: Revisión global para fragmentos pequeños y autocontenidos.',
      '',
      canDecompose
        ? `Profundidad actual: ${currentStorage.depth}/${context.maxDepth}. Analiza la tarea asignada a tu Scope: si es acotada o pequeña, resuélvela directamente invocando "ejecutar_tarea_atomica". Si el fichero/bloque es complejo y conviene dividirlo por bloques de líneas o por skills especializadas para no saturar el contexto, invoca "descomponer_en_subtareas".`
        : `Profundidad máxima alcanzada (${currentStorage.depth}/${context.maxDepth}). Debes resolver este Scope de forma atómica invocando "ejecutar_tarea_atomica".`,
      reviewOutputContract,
    ].join('\n')

    const step1UserPrompt = [
      `SCOPE ACTUAL: ${currentStorage.scopeId} (Profundidad ${currentStorage.depth}/${context.maxDepth})`,
      `TAREA ASIGNADA: ${task.descripcion}`,
      `SKILL SUGERIDA: ${task.skill_requerida ?? 'skill_general'}`,
      `FICHERO: ${context.file.path} (Líneas ${slice.startLine} a ${slice.endLine} de ${slice.totalLines})`,
      `STATUS: ${context.file.status}`,
      memoryCatalogText,
      '',
      'CÓDIGO DEL SCOPE:',
      slice.codeWithLines,
    ].join('\n')

    // STEP 1: Ask the local SLM how to process this Scope via native tools
    const step1Response = await callSlmWithTools({
      file: context.file,
      scopeId: currentStorage.scopeId,
      messages: [
        { role: 'system', content: step1SystemPrompt },
        { role: 'user', content: step1UserPrompt },
      ],
      tools: step1Tools,
      toolChoice: 'required',
      streamSuggestionsToCallback: true,
      concurrencyGate: context.concurrencyGate,
      requestTimeoutMs: context.requestTimeoutMs,
      onSuggestion: context.onSuggestion,
      onThinking: context.onThinking,
      signal: context.signal,
    })

    const decisionCall = step1Response.toolCalls[0]

    // CASE 0: SLM explicitly chose to reuse an existing scope from engram-ts memory
    if (decisionCall?.name === 'reutilizar_scope_memoria') {
      const targetScopeRef = String(decisionCall.args.id_scope ?? '')
      const recovered = await currentStorage.getScopeResultByMemoryId(targetScopeRef)
      if (recovered) {
        trace('slm.scope.llm_memory_reused', {
          scopeId: currentStorage.scopeId,
          targetScopeRef,
          engramRef: recovered.engram_ref,
        })
        return recovered
      }
    }

    // CASE B: SLM decided to decompose into concurrent sub-scopes (Recursive Step)
    if (decisionCall?.name === 'descomponer_en_subtareas' && canDecompose) {
      const rawSubtasks = Array.isArray(decisionCall.args.subtareas) ? decisionCall.args.subtareas : []
      const seenSubtaskKeys = new Set<string>()
      const parentNormDesc = normalizeScopeKeyText(task.descripcion)

      const subPlan: ScopeTaskDefinition[] = []
      for (const [idx, item] of rawSubtasks.entries()) {
        if (!item || typeof item !== 'object') continue
        const rawItem = item as Record<string, unknown>
        const rawSkill = typeof rawItem.skill_requerida === 'string' ? rawItem.skill_requerida : task.skill_requerida
        const skill: ReviewSkillName =
          rawSkill === 'skill_solid' || rawSkill === 'skill_security' || rawSkill === 'skill_quality' || rawSkill === 'skill_general'
            ? rawSkill
            : 'skill_general'
        const lineStart = typeof rawItem.lineStart === 'number' && rawItem.lineStart >= 1 ? Math.round(rawItem.lineStart) : task.lineStart
        const lineEnd = typeof rawItem.lineEnd === 'number' && rawItem.lineEnd >= 1 ? Math.round(rawItem.lineEnd) : task.lineEnd
        const descripcion =
          typeof rawItem.descripcion === 'string' && rawItem.descripcion.trim()
            ? rawItem.descripcion.trim()
            : `${task.descripcion} (${skill} #${idx + 1})`
        const normDesc = normalizeScopeKeyText(descripcion)

        const dedupKey = `${skill}:${lineStart ?? 1}-${lineEnd ?? 'end'}:${normDesc}`
        if (seenSubtaskKeys.has(dedupKey)) continue
        seenSubtaskKeys.add(dedupKey)

        const rawId =
          typeof rawItem.id_subtarea === 'string' && rawItem.id_subtarea.trim()
            ? rawItem.id_subtarea.trim()
            : `${currentStorage.scopeId}_sub_${idx + 1}`
        const safeSubtaskId =
          rawId === currentStorage.scopeId || currentStorage.ancestorScopeIds.has(rawId)
            ? `${currentStorage.scopeId}_${rawId}_${idx + 1}`
            : rawId

        // If a child subtask covers the exact same range and task as its parent, force atomic execution at the child level
        const sameRangeAsParent =
          (lineStart ?? slice.startLine) === slice.startLine && (lineEnd ?? slice.endLine) === slice.endLine
        const sameAsParent = sameRangeAsParent && normDesc === parentNormDesc

        subPlan.push({
          id_subtarea: safeSubtaskId,
          descripcion,
          skill_requerida: skill,
          lineStart,
          lineEnd,
          requiere_sub_planificacion: sameAsParent ? false : undefined,
        })

        if (subPlan.length >= MAX_SUBTASKS_PER_SCOPE) break
      }

      // Guard against degenerate single-child decomposition with identical range: execute atomically instead of recursing
      if (
        subPlan.length === 1 &&
        (subPlan[0].lineStart ?? slice.startLine) === slice.startLine &&
        (subPlan[0].lineEnd ?? slice.endLine) === slice.endLine
      ) {
        trace('slm.scope.single_subtask_collapsed_to_atomic', {
          scopeId: currentStorage.scopeId,
          depth: currentStorage.depth,
          subtaskId: subPlan[0].id_subtarea,
        })
        const singleChild = subPlan[0]
        const resultadoAtomico = await ejecutarSkillLocal(
          singleChild.skill_requerida ?? 'skill_general',
          {
            foco: singleChild.descripcion,
            lineStart: singleChild.lineStart,
            lineEnd: singleChild.lineEnd,
          },
          singleChild,
          currentStorage,
          context,
        )
        return currentStorage.saveScopeResult({
          task: singleChild,
          codeSlice: slice.rawSlice,
          sumarioEjecutivo: resultadoAtomico.sumario_ejecutivo,
          suggestions: resultadoAtomico.suggestions,
          isAggregated: false,
        })
      }

      if (subPlan.length > 0) {
        // Clear parent from inFlight before launching children so no child can ever collide with its parent's inFlight entry
        currentStorage.clearInFlight(sigTag)

        const justification = typeof decisionCall.args.justificacion === 'string' ? decisionCall.args.justificacion : undefined
        await currentStorage.saveSubPlan(subPlan, justification)

        trace('slm.scope.decomposed', {
          scopeId: currentStorage.scopeId,
          depth: currentStorage.depth,
          subtasksCount: subPlan.length,
          maxConcurrency: context.maxConcurrency,
        })

        // STEP 2: Concurrent execution of child sub-scopes (HTTP concurrency is globally bounded by context.concurrencyGate)
        const resultadosSubHilos = await Promise.all(
          subPlan.map((subTarea) => procesarNodoScope(subTarea, currentStorage, context, false)),
        )

        // STEP 3: Reduction / Aggregation of child scopes into current Scope Storage
        const sintesisConsolidada = await llamarLLMParaReduccion(
          resultadosSubHilos,
          task,
          currentStorage,
          context,
        )

        return currentStorage.saveScopeResult({
          task,
          codeSlice: slice.rawSlice,
          sumarioEjecutivo: sintesisConsolidada.sumario_ejecutivo,
          suggestions: sintesisConsolidada.suggestions,
          isAggregated: true,
        })
      }
    }

    // CASE A: Base Case — Atomic Execution (`ejecutar_tarea_atomica`)
    if (decisionCall?.name === 'ejecutar_tarea_atomica') {
      const rawSkill = typeof decisionCall.args.skill_a_usar === 'string'
        ? decisionCall.args.skill_a_usar
        : task.skill_requerida
      const skill: ReviewSkillName =
        rawSkill === 'skill_solid' || rawSkill === 'skill_security' || rawSkill === 'skill_quality' || rawSkill === 'skill_general'
          ? rawSkill
          : (task.skill_requerida ?? 'skill_general')

      const argumentos =
        decisionCall.args.argumentos && typeof decisionCall.args.argumentos === 'object'
          ? (decisionCall.args.argumentos as Record<string, unknown>)
          : decisionCall.args

      const resultadoAtomico = await ejecutarSkillLocal(skill, argumentos, task, currentStorage, context)
      return currentStorage.saveScopeResult({
        task: { ...task, skill_requerida: skill },
        codeSlice: slice.rawSlice,
        sumarioEjecutivo: resultadoAtomico.sumario_ejecutivo,
        suggestions: resultadoAtomico.suggestions,
        isAggregated: false,
      })
    }

    // Resilience fallback: if the local SLM returned direct JSON content or streamed suggestions without a tool_call wrapper
    let fallbackSuggestions: SlmSuggestion[] = []
    if (step1Response.contentBuffer.trim().length > 0) {
      try {
        fallbackSuggestions = parseSuggestions(
          step1Response.contentBuffer,
          step1Response.finishReason !== 'length',
          context.file.path,
        )
      } catch (parseErr) {
        if (step1Response.streamedSuggestions.length > 0) {
          fallbackSuggestions = step1Response.streamedSuggestions
        } else if (step1Response.finishReason === 'length') {
          const config = getSlmConfig()
          throw new Error(
            `El SLM agotó el límite de tokens (${config.maxTokens}) principalmente por razonamiento (${step1Response.reasoningChars} caracteres de razonamiento) sin generar propuestas completas. Aumenta "maxTokens" en la configuración.`,
          )
        } else {
          throw parseErr
        }
      }
    } else if (step1Response.streamedSuggestions.length > 0) {
      fallbackSuggestions = step1Response.streamedSuggestions
    } else if (step1Response.finishReason === 'length') {
      const config = getSlmConfig()
      throw new Error(
        `El SLM agotó el límite de tokens (${config.maxTokens}) principalmente por razonamiento (${step1Response.reasoningChars} caracteres de razonamiento) sin generar propuestas completas. Aumenta "maxTokens" en la configuración.`,
      )
    }

    const filteredFallback = filterSuggestions(fallbackSuggestions)
    return currentStorage.saveScopeResult({
      task,
      codeSlice: slice.rawSlice,
      sumarioEjecutivo: `Análisis directo de ${context.file.path}: ${filteredFallback.length} hallazgo(s).`,
      suggestions: filteredFallback,
      isAggregated: false,
    })
  })()

  currentStorage.setInFlight(sigTag, executionPromise)
  try {
    return await executionPromise
  } finally {
    currentStorage.clearInFlight(sigTag)
  }
}

async function requestFileAnalysis(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
  onThinking?: (thought: string) => void | Promise<void>,
  signal?: AbortSignal,
  options?: AnalyzeFileOptions,
): Promise<{ suggestions: SlmSuggestion[]; rootScopeResult: ScopeExecutionResult }> {
  const config = getSlmConfig()
  const prompts = getReviewPromptConfig()
  const maxDepth = options?.maxDepth ?? config.maxDepth
  const maxConcurrency = options?.maxConcurrency ?? config.maxConcurrency
  const concurrencyGate = options?.concurrencyGate ?? new SlmConcurrencyGate(maxConcurrency)
  const project = options?.project ?? (options?.reviewId ? `review-${options.reviewId}` : 'codereview-default')
  const rootScopeId = `scope_file_${file.path.replace(/[^a-zA-Z0-9_.-]/g, '_')}`

  const rootStorage = new ReviewScopeStorage({
    engram: options?.engram,
    project,
    filePath: file.path,
    scopeId: rootScopeId,
    depth: 0,
  })

  const rootTask: ScopeTaskDefinition = {
    id_subtarea: rootScopeId,
    descripcion: `Analizar el fichero ${file.path} aplicando principios SOLID, seguridad y calidad de código. Si el fichero es extenso o aborda múltiples responsabilidades, descomponer en sub-scopes por bloques o skills especializadas.`,
    skill_requerida: 'skill_general',
  }

  const rootScopeResult = await procesarNodoScope(
    rootTask,
    rootStorage,
    {
      file,
      baseInstructions: prompts.reviewInstructions,
      maxDepth,
      maxConcurrency,
      concurrencyGate,
      requestTimeoutMs: options?.requestTimeoutMs,
      onSuggestion,
      onThinking,
      signal,
    },
    true,
  )

  const filtered = filterSuggestions(rootScopeResult.suggestions)
  trace('slm.analysis.file_result', {
    filePath: file.path,
    engramRef: rootScopeResult.engram_ref,
    fromMemoryCache: Boolean(rootScopeResult.fromMemoryCache),
    candidatesCount: rootScopeResult.suggestions.length,
    keptCount: filtered.length,
    suggestions: filtered.map((s) => ({ id: s.id, line: s.line, severity: s.severity })),
  })

  return {
    suggestions: filtered,
    rootScopeResult: {
      ...rootScopeResult,
      suggestions: filtered,
    },
  }
}

export async function analyzeFileWithSlm(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
  onThinking?: (thought: string) => void | Promise<void>,
  signal?: AbortSignal,
  options?: AnalyzeFileOptions,
) {
  const config = getSlmConfig()
  const sharedGate = options?.concurrencyGate ?? new SlmConcurrencyGate(options?.maxConcurrency ?? config.maxConcurrency)
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (signal?.aborted) return []
    try {
      const { suggestions } = await requestFileAnalysis(file, onSuggestion, onThinking, signal, {
        ...options,
        concurrencyGate: sharedGate,
      })
      trace('slm.file.parsed', { filePath: file.path, attempt, suggestions: suggestions.length })
      return suggestions
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        trace('slm.file.aborted', { filePath: file.path })
        return []
      }
      trace('slm.file.retry', { filePath: file.path, attempt, reason: error instanceof Error ? error.message : 'unknown' })
      if (attempt === 2) {
        trace('slm.file.skipped', { filePath: file.path })
        return []
      }
    }
  }
  return []
}
