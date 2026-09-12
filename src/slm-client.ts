import { getSlmConfig } from './slm-config'
import { getReviewPromptConfig, reviewOutputContract } from './review-prompts'
import type { StoredReviewFile } from './review-db'
import { trace } from './diagnostics'

export interface SlmSuggestion {
  id: string
  filePath: string
  line: number
  severity: 'baja' | 'media' | 'alta'
  category: 'solid' | 'security' | 'quality'
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

function normalizeSuggestions(items: unknown[]): SlmSuggestion[] {
  return items.flatMap((item): SlmSuggestion[] => {
    if (!item || typeof item !== 'object') return []
    const suggestion = item as Partial<SlmSuggestion>
    const line = typeof suggestion.line === 'string' ? Number(suggestion.line) : suggestion.line
    if (typeof suggestion.id !== 'string' || typeof suggestion.filePath !== 'string' || typeof line !== 'number' || !Number.isInteger(line) || line <= 0 || !['baja', 'media', 'alta'].includes(suggestion.severity ?? '') || !['solid', 'security', 'quality'].includes(suggestion.category ?? '') || typeof suggestion.message !== 'string' || typeof suggestion.recommendation !== 'string') return []
    return [{ ...suggestion, line } as SlmSuggestion]
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
  }).slice(0, 5)
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

function parseSuggestions(content: string, allowEmpty = false): SlmSuggestion[] {
  const jsonContent = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content
  try {
    const parsed = JSON.parse(jsonContent.trim()) as { suggestions?: unknown }
    if (Array.isArray(parsed.suggestions)) return normalizeSuggestions(parsed.suggestions)
  } catch {
    // A length-limited response can contain complete suggestion objects without closing the outer JSON.
  }
  const recovered = completeJsonObjects(jsonContent)
    .map((value) => {
      try { return JSON.parse(value) as unknown } catch { return undefined }
    })
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && 'filePath' in item && 'message' in item))
  const suggestions = normalizeSuggestions(recovered)
  if (!suggestions.length && !allowEmpty) {
    throw new Error('El SLM devolvio un JSON incompleto o sin sugerencias validas.')
  }
  return suggestions
}

function reviewInput(file: StoredReviewFile) {
  const source = file.content ? `CONTENT:\n${file.content}` : `PATCH:\n${file.patch ?? ''}`
  return `FILE: ${file.path}\nSTATUS: ${file.status}\n${source}`
}

function systemPrompt(instructions: string) {
  return `${instructions}\n\n${reviewOutputContract}\n\nNo respondas con bloques markdown. No expliques el análisis fuera del JSON. Si no encuentras hallazgos, responde exactamente {"suggestions":[]}.`
}

async function requestFileAnalysis(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
): Promise<SlmSuggestion[]> {
  const config = getSlmConfig()
  const prompts = getReviewPromptConfig()
  const userContent = `Revisa únicamente este fichero. Asocia cada hallazgo al fichero y línea exactos.\n\n${reviewInput(file)}`
  const startedAt = performance.now()

  trace('slm.stream.start', { filePath: file.path, model: config.model, maxTokens: config.maxTokens })

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      max_completion_tokens: config.maxTokens,
      stream: true,
      verbosity: 'low',
      reasoning: {
        effort: 'minimal',
      },
      chat_template_kwargs: {
        enable_thinking: false,
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
                maxItems: 5,
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
          reasoningChars += closeIdx
          inThinkTag = false
          combined = combined.slice(closeIdx + 8)
        } else {
          const possiblePartial = combined.match(/<\/t(?:h(?:i(?:n(?:k)?)?)?)?$/)
          if (possiblePartial && possiblePartial.index !== undefined) {
            reasoningChars += possiblePartial.index
            thinkTagBuffer = possiblePartial[0]
            combined = ''
          } else {
            reasoningChars += combined.length
            combined = ''
          }
        }
      }
    }
    return clean
  }

  const seenSuggestionIds = new Set<string>()
  const streamedSuggestions: SlmSuggestion[] = []

  function checkIncrementalSuggestions(currentContent: string) {
    const rawObjects = completeJsonObjects(currentContent)
    for (const raw of rawObjects) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object' && 'filePath' in parsed && 'message' in parsed) {
          const normalized = normalizeSuggestions([parsed])
          for (const suggestion of normalized) {
            if (!seenSuggestionIds.has(suggestion.id) && !isGenericSuggestion(suggestion)) {
              seenSuggestionIds.add(suggestion.id)
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
      } catch {
        // Skip incomplete or unparseable object slice
      }
    }
  }

  while (true) {
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
        if (!choice) continue

        if (choice.finish_reason) {
          finishReason = choice.finish_reason
        }

        const delta = choice.delta
        if (!delta) continue

        if (delta.reasoning_content) {
          reasoningChars += delta.reasoning_content.length
        } else if (delta.reasoning) {
          reasoningChars += delta.reasoning.length
        }

        if (delta.content) {
          const clean = processContentDelta(delta.content)
          if (clean) {
            contentBuffer += clean
            contentChars += clean.length
            checkIncrementalSuggestions(contentBuffer)
          }
        }
      } catch {
        // Skip unparseable SSE line
      }
    }
  }

  // Flush any remaining partial think buffer
  if (thinkTagBuffer) {
    if (!inThinkTag) {
      contentBuffer += thinkTagBuffer
      contentChars += thinkTagBuffer.length
    } else {
      reasoningChars += thinkTagBuffer.length
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
    finalSuggestions = parseSuggestions(contentBuffer, finishReason !== 'length')
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

  // If truncated by length but we have suggestions recovered, accept and trace them
  if (finishReason === 'length') {
    const recovered = filterSuggestions(finalSuggestions.length ? finalSuggestions : streamedSuggestions)
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

  return filterSuggestions(finalSuggestions)
}

export async function analyzeFileWithSlm(
  file: StoredReviewFile,
  onSuggestion?: (suggestion: SlmSuggestion) => void | Promise<void>,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const suggestions = await requestFileAnalysis(file, onSuggestion)
      trace('slm.file.parsed', { filePath: file.path, attempt, suggestions: suggestions.length })
      return suggestions
    } catch (error) {
      trace('slm.file.retry', { filePath: file.path, attempt, reason: error instanceof Error ? error.message : 'unknown' })
      if (attempt === 2) {
        trace('slm.file.skipped', { filePath: file.path })
        return []
      }
    }
  }
  return []
}
