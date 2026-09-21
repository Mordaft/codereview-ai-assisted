import { getSlmConfig } from './slm-config'
import { getReviewPromptConfig, reviewOutputContract } from './review-prompts'
import type { StoredReviewFile } from './review-db'
import { trace } from './diagnostics'
import { CommentCategory, CommentSeverity } from './enums'

export interface SlmSuggestion {
  id: string
  filePath: string
  line: number
  severity: CommentSeverity
  category: CommentCategory
  message: string
  recommendation: string
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
    }
  }>
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
    if (!item || typeof item !== 'object') return []
    const raw = item as Record<string, unknown>
    const rawFilePath = typeof raw.filePath === 'string' ? raw.filePath.trim() : typeof raw.file === 'string' ? raw.file.trim() : typeof raw.path === 'string' ? raw.path.trim() : ''
    const filePath = fallbackFilePath ?? (rawFilePath || 'unknown')

    const lineRaw = raw.line ?? raw.lineNumber ?? raw.line_number
    const lineNum = typeof lineRaw === 'string' ? Number.parseInt(lineRaw, 10) : typeof lineRaw === 'number' ? Math.round(lineRaw) : 1
    const line = Number.isInteger(lineNum) && lineNum > 0 ? lineNum : 1

    const severity = parseSeverity(raw.severity)
    const category = parseCategory(raw.category)

    const rawMessage = typeof raw.message === 'string' ? raw.message.trim() : typeof raw.description === 'string' ? raw.description.trim() : ''
    const rawRec = typeof raw.recommendation === 'string' ? raw.recommendation.trim() : typeof raw.suggestion === 'string' ? raw.suggestion.trim() : ''
    const message = rawMessage || rawRec
    const recommendation = rawRec || rawMessage

    if (!message) return []

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

function isGenericSuggestion(suggestion: SlmSuggestion) {
  const text = normalizeText(`${suggestion.message} ${suggestion.recommendation}`)
  return text.length < 24 || /(?:todas las lineas|cada linea|nombre .* no cumple|cumple con el estandar|asegurate de que .* sea unico|mejora la calidad del codigo|sigue las buenas practicas|revisa este codigo)/i.test(text)
}

export function filterSuggestions(suggestions: SlmSuggestion[]) {
  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    if (isGenericSuggestion(suggestion)) return false
    const key = `${suggestion.filePath}:${suggestion.line}:${normalizeText(suggestion.message)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
    if (Array.isArray(parsed.suggestions)) return normalizeSuggestions(parsed.suggestions, fallbackFilePath)
  } catch {
    // A length-limited response can contain complete suggestion objects without closing the outer JSON.
  }
  const rawObjects = completeJsonObjects(jsonContent)
  const candidateItems: unknown[] = []
  for (const raw of rawObjects) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        if ('suggestions' in parsed && Array.isArray((parsed as { suggestions: unknown }).suggestions)) {
          candidateItems.push(...(parsed as { suggestions: unknown[] }).suggestions)
        } else if ('message' in parsed || 'description' in parsed || 'recommendation' in parsed) {
          candidateItems.push(parsed)
        }
      }
    } catch {
      // Skip unparseable slice
    }
  }
  const suggestions = normalizeSuggestions(candidateItems, fallbackFilePath)
  if (!suggestions.length && !allowEmpty) {
    throw new Error('El SLM devolvio un JSON incompleto o sin sugerencias validas.')
  }
  return suggestions
}

function reviewInput(file: StoredReviewFile) {
  const source = file.content ? `CONTENT:\n${file.content}` : `PATCH:\n${file.patch ?? ''}`
  return `FILE: ${file.path}\nSTATUS: ${file.status}\n\n${source}`
}

function systemPrompt(instructions: string) {
  return `${instructions}\n\n${reviewOutputContract}\n\nNo respondas con bloques markdown fuera del JSON. Si no encuentras hallazgos, responde exactamente {"suggestions":[]}.`
}

async function requestFileAnalysis(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
  onThinking?: (thought: string) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<SlmSuggestion[]> {
  const config = getSlmConfig()
  const prompts = getReviewPromptConfig()
  const userContent = `Revisa únicamente este fichero. Asocia cada hallazgo al fichero y línea exactos.\n\n${reviewInput(file)}`
  const startedAt = performance.now()

  trace('slm.stream.start', { filePath: file.path, model: config.model, maxTokens: config.maxTokens })

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
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
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'code_review_suggestions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
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
                  additionalProperties: false,
                },
              },
            },
            required: ['suggestions'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: systemPrompt(prompts.reviewInstructions) },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`El runtime SLM respondio ${response.status}.`)
  }
  if (!response.body) {
    throw new Error('El runtime SLM no devolvio un cuerpo de respuesta.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let streamBuffer = ''
  let contentBuffer = ''
  let finishReason: string | null = null
  let reasoningChars = 0
  let contentChars = 0
  let accumulatedThought = ''

  let inThinkTag = false
  let thinkTagBuffer = ''

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
    const itemsToCheck: unknown[] = []
    for (const raw of rawObjects) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
          if ('suggestions' in parsed && Array.isArray((parsed as { suggestions: unknown[] }).suggestions)) {
            itemsToCheck.push(...(parsed as { suggestions: unknown[] }).suggestions)
          } else if ('message' in parsed || 'description' in parsed || 'recommendation' in parsed) {
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
        const key = `${suggestion.filePath}:${suggestion.line}:${normalizeText(suggestion.message)}`
        if (!seenSuggestionKeys.has(key) && !isGenericSuggestion(suggestion)) {
          seenSuggestionKeys.add(key)
          streamedSuggestions.push(suggestion)
          if (onSuggestion) {
            try {
              void onSuggestion(suggestion)
            } catch {
              // Ignore callback errors during streaming
            }
          }
        }
      }
    }
  }

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) break

    streamBuffer += decoder.decode(value, { stream: true })
    const lines = streamBuffer.split('\n')
    streamBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const dataStr = trimmed.slice(5).trim()
      if (dataStr === '[DONE]') continue

      try {
        const parsed = JSON.parse(dataStr) as ChatCompletionChunk
        const choice = parsed.choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason

        const delta = choice?.delta
        if (!delta) continue

        // 1. Check reasoning_content / reasoning fields
        const rawReasoning = delta.reasoning_content ?? delta.reasoning
        if (typeof rawReasoning === 'string' && rawReasoning.length > 0) {
          accumulatedThought += rawReasoning
          reasoningChars += rawReasoning.length
          if (onThinking) {
            try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
          }
        }

        // 2. Check content field (may contain <think>...</think> tags)
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          const cleanDelta = processContentDelta(delta.content)
          if (cleanDelta.length > 0) {
            contentBuffer += cleanDelta
            contentChars += cleanDelta.length
            checkIncrementalSuggestions(contentBuffer)
          }
        }
      } catch {
        // Skip unparseable SSE chunk
      }
    }
  }

  // Flush any remaining partial buffer
  if (streamBuffer.trim().startsWith('data:')) {
    const dataStr = streamBuffer.trim().slice(5).trim()
    if (dataStr !== '[DONE]') {
      try {
        const parsed = JSON.parse(dataStr) as ChatCompletionChunk
        const delta = parsed.choices?.[0]?.delta
        const rawReasoning = delta?.reasoning_content ?? delta?.reasoning
        if (typeof rawReasoning === 'string' && rawReasoning.length > 0) {
          accumulatedThought += rawReasoning
          reasoningChars += rawReasoning.length
          if (onThinking) {
            try { void onThinking(accumulatedThought) } catch { /* Ignore callback error */ }
          }
        }
        if (typeof delta?.content === 'string' && delta.content.length > 0) {
          const cleanDelta = processContentDelta(delta.content)
          if (cleanDelta.length > 0) {
            contentBuffer += cleanDelta
            contentChars += cleanDelta.length
            checkIncrementalSuggestions(contentBuffer)
          }
        }
      } catch {
        // Skip
      }
    }
  }

  // If think tag wasn't closed before stream ended, flush remaining think tag buffer
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

  trace('slm.stream.complete', {
    filePath: file.path,
    elapsedMs: Math.round(performance.now() - startedAt),
    reasoningChars,
    contentChars,
    finishReason,
    streamedCount: streamedSuggestions.length,
  })

  // Attempt final parsing
  let finalSuggestions: SlmSuggestion[] = []
  try {
    finalSuggestions = parseSuggestions(contentBuffer, finishReason !== 'length', file.path)
  } catch (parseError) {
    if (streamedSuggestions.length > 0) {
      finalSuggestions = streamedSuggestions
    } else if (finishReason === 'length') {
      throw new Error(
        `El SLM agotó el límite de tokens (${config.maxTokens}) principalmente por razonamiento (${reasoningChars} caracteres de razonamiento) sin generar propuestas completas. Aumenta "maxTokens" en la configuración.`,
      )
    } else {
      throw parseError
    }
  }

  if (finalSuggestions.length === 0 && streamedSuggestions.length > 0) {
    finalSuggestions = streamedSuggestions
  }

  // If truncated by length but we have suggestions recovered, accept and trace them
  if (finishReason === 'length') {
    const candidateList = finalSuggestions.length ? finalSuggestions : streamedSuggestions
    const recovered = filterSuggestions(candidateList)
    if (recovered.length > 0) {
      trace('slm.stream.truncated_recovered', {
        filePath: file.path,
        recoveredCount: recovered.length,
        reasoningChars,
        contentChars,
      })
      return recovered
    }
    throw new Error(
      `El SLM agotó el límite de tokens (${config.maxTokens}) principalmente por razonamiento (${reasoningChars} caracteres de razonamiento) sin generar propuestas completas. Aumenta "maxTokens" en la configuración.`,
    )
  }

  return filterSuggestions(finalSuggestions.length ? finalSuggestions : streamedSuggestions)
}

export async function analyzeFileWithSlm(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
  onThinking?: (thought: string) => void | Promise<void>,
  signal?: AbortSignal,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (signal?.aborted) return []
    try {
      const suggestions = await requestFileAnalysis(file, onSuggestion, onThinking, signal)
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
