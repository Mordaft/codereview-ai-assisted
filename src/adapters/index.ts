import { GitHubAdapter } from './github-adapter'
import { GitLabAdapter } from './gitlab-adapter'
import type { Platform, PlatformAdapter, PlatformChangeInfo } from './types'

export * from './types'
export { GitHubAdapter } from './github-adapter'
export { GitLabAdapter } from './gitlab-adapter'

const registeredAdapters: PlatformAdapter[] = [
  new GitHubAdapter(),
  new GitLabAdapter(),
]

export function getAdapter(provider: Platform): PlatformAdapter {
  const adapter = registeredAdapters.find((a) => a.platform === provider)
  if (!adapter) {
    throw new Error(`No se ha encontrado un adaptador para la plataforma: ${provider}`)
  }
  return adapter
}

export function resolvePlatformAdapter(value: string | URL): { adapter: PlatformAdapter; info: PlatformChangeInfo } {
  let url: URL
  try {
    url = typeof value === 'string' ? new URL(value.trim()) : value
  } catch {
    throw new Error('La URL de la MR o PR no es valida.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('La URL debe utilizar HTTP o HTTPS.')
  }

  for (const adapter of registeredAdapters) {
    if (adapter.canHandle(url)) {
      try {
        const info = adapter.parseUrl(url)
        return { adapter, info }
      } catch {
        // Continua al siguiente si este adaptador no pudo parsearla completamente
      }
    }
  }

  throw new Error('La URL no parece una Pull Request de GitHub ni una Merge Request de GitLab.')
}

export function parseReviewUrl(value: string): PlatformChangeInfo {
  return resolvePlatformAdapter(value).info
}

export function detectPlatform(value: string): { adapter: PlatformAdapter; info: PlatformChangeInfo } | null {
  if (!value || typeof value !== 'string') return null
  try {
    return resolvePlatformAdapter(value.trim())
  } catch {
    return null
  }
}
