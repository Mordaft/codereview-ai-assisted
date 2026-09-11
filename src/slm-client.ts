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

interface ChatCompletionResponse {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | Array<{ type?: string; text?: string }> } }>
}

function contentFromResponse(response: ChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  return content?.map((part) => part.text ?? '').join('') ?? ''
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

function parseSuggestions(content: string): SlmSuggestion[] {
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
  if (!suggestions.length) throw new Error('El SLM devolvio un JSON incompleto o sin sugerencias validas.')
  return suggestions
}

function reviewInput(file: StoredReviewFile) {
  const source = file.content ? `CONTENT:\n${file.content}` : `PATCH:\n${file.patch ?? ''}`
  return `FILE: ${file.path}\nSTATUS: ${file.status}\n${source}`
}

function systemPrompt(instructions: string) {
  return `${instructions}\n\n${reviewOutputContract}\n\nNo respondas con bloques markdown. No expliques el análisis fuera del JSON. Si no encuentras hallazgos, responde exactamente {"suggestions":[]}.`
}

async function requestFileAnalysis(file: StoredReviewFile) {
  const config = getSlmConfig()
  const prompts = getReviewPromptConfig()
  const userContent = `Revisa únicamente este fichero. Asocia cada hallazgo al fichero y línea exactos.\n\n${reviewInput(file)}`
  const startedAt = performance.now()
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
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
  trace('slm.request.response', { filePath: file.path, status: response.status, elapsedMs: Math.round(performance.now() - startedAt), inputCharacters: userContent.length, contractSent: true })
  if (!response.ok) throw new Error(`El runtime SLM respondio ${response.status}.`)
  const data = await response.json() as ChatCompletionResponse
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('La respuesta del SLM fue truncada por limite de tokens.')
  const content = contentFromResponse(data)
  if (!content) throw new Error('El SLM devolvio una respuesta vacia.')
  return filterSuggestions(parseSuggestions(content))
}

export async function analyzeFileWithSlm(file: StoredReviewFile) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const suggestions = await requestFileAnalysis(file)
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
