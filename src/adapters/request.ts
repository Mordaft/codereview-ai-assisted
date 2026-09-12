import { repositoryAuthHeaders } from '../browser-session'
import { trace } from '../diagnostics'

export async function platformRequest<T>(url: string, init?: RequestInit): Promise<T> {
  trace('platform.request.start', { method: init?.method ?? 'GET', url })
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...repositoryAuthHeaders(),
        ...init?.headers,
      },
    })
  } catch {
    trace('platform.request.network-error', { url })
    throw new Error(`No se pudo conectar con la plataforma en ${url}. Comprueba la URL, CORS y la conectividad.`)
  }
  trace('platform.request.response', { url, status: response.status, ok: response.ok })
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as { message?: string; error?: string; error_description?: string }
      detail = body.message ?? body.error_description ?? body.error ?? ''
    } catch {
      detail = ''
    }
    trace('platform.request.http-error', { url, status: response.status, statusText: response.statusText, detail })
    throw new Error(`La plataforma respondio ${response.status}: ${response.statusText}${detail ? ` - ${detail}` : ''}`)
  }
  return response.json() as Promise<T>
}

export function decodeBase64Content(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
