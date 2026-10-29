export interface SlmConfig {
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  maxDepth: number
  maxConcurrency: number
}

const storageKey = 'codereview-slm-config'
const defaultConfig: SlmConfig = {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
  temperature: 0.2,
  maxTokens: 8192,
  maxDepth: 3,
  maxConcurrency: 2,
}

export function getSlmConfig(): SlmConfig {
  if (typeof localStorage === 'undefined') return { ...defaultConfig }
  const savedConfig = localStorage.getItem(storageKey)
  if (!savedConfig) return { ...defaultConfig }
  try {
    const parsed = { ...defaultConfig, ...(JSON.parse(savedConfig) as Partial<SlmConfig>) }
    if (!parsed.maxTokens || parsed.maxTokens < 8192) {
      parsed.maxTokens = 8192
    }
    if (!Number.isInteger(parsed.maxDepth) || parsed.maxDepth < 1 || parsed.maxDepth > 5) {
      parsed.maxDepth = defaultConfig.maxDepth
    }
    if (!Number.isInteger(parsed.maxConcurrency) || parsed.maxConcurrency < 1 || parsed.maxConcurrency > 6) {
      parsed.maxConcurrency = defaultConfig.maxConcurrency
    }
    return parsed
  } catch {
    return { ...defaultConfig }
  }
}

export function saveSlmConfig(config: SlmConfig) {
  const url = new URL(config.baseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL del runtime SLM debe usar HTTP o HTTPS.')
  if (!url.hostname.includes('localhost') && url.hostname !== '127.0.0.1' && url.hostname !== '::1') throw new Error('El runtime SLM debe estar ubicado en localhost.')
  if (!config.model.trim()) throw new Error('Debes indicar el nombre del modelo SLM.')
  const maxDepth = Number.isInteger(config.maxDepth) ? Math.min(5, Math.max(1, config.maxDepth)) : defaultConfig.maxDepth
  const maxConcurrency = Number.isInteger(config.maxConcurrency) ? Math.min(6, Math.max(1, config.maxConcurrency)) : defaultConfig.maxConcurrency
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...config,
      baseUrl: url.toString().replace(/\/$/, ''),
      maxDepth,
      maxConcurrency,
    }),
  )
}

export async function testSlmConnection(config: SlmConfig) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models`)
  if (!response.ok) throw new Error(`El runtime SLM respondio ${response.status}.`)
  return response.json() as Promise<{ data?: Array<{ id: string }> }>
}
