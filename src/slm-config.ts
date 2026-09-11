export interface SlmConfig {
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

const storageKey = 'codereview-slm-config'
const defaultConfig: SlmConfig = {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
  temperature: 0.2,
  maxTokens: 2048,
}

export function getSlmConfig(): SlmConfig {
  const savedConfig = localStorage.getItem(storageKey)
  if (!savedConfig) return defaultConfig
  try {
    return { ...defaultConfig, ...JSON.parse(savedConfig) as Partial<SlmConfig> }
  } catch {
    return defaultConfig
  }
}

export function saveSlmConfig(config: SlmConfig) {
  const url = new URL(config.baseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL del runtime SLM debe usar HTTP o HTTPS.')
  if (!url.hostname.includes('localhost') && url.hostname !== '127.0.0.1' && url.hostname !== '::1') throw new Error('El runtime SLM debe estar ubicado en localhost.')
  if (!config.model.trim()) throw new Error('Debes indicar el nombre del modelo SLM.')
  localStorage.setItem(storageKey, JSON.stringify({ ...config, baseUrl: url.toString().replace(/\/$/, '') }))
}

export async function testSlmConnection(config: SlmConfig) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models`)
  if (!response.ok) throw new Error(`El runtime SLM respondio ${response.status}.`)
  return response.json() as Promise<{ data?: Array<{ id: string }> }>
}
