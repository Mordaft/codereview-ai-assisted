import { repositoryAuthHeaders } from './browser-session'
import { trace } from './diagnostics'
import type { ReviewLocation } from './platform-url'

export interface RemoteChange {
  provider: ReviewLocation['provider']
  number: number
  title: string
  description: string
  sourceBranch: string
  targetBranch: string
  author: string
  repositoryPath: string
  webUrl: string
}

export interface RemoteFile {
  path: string
  sha?: string
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'unknown'
  additions: number
  deletions: number
  changes?: number
  blobUrl?: string
  rawUrl?: string
  contentsUrl?: string
  patch?: string
  content?: string
}

export interface RemoteComment {
  id: string
  author: string
  body: string
  path?: string
  line?: number
  createdAt: string
  url?: string
}

function apiBaseUrl(location: ReviewLocation) {
  if (location.provider === 'GitLab') return `${location.baseUrl}/api/v4`
  return location.baseUrl === 'https://github.com' ? 'https://api.github.com' : `${location.baseUrl}/api/v3`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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

function decodeBase64Content(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function requestContent(url: string) {
  trace('platform.content.start', { url, source: 'contents-api' })
  try {
    const response = await request<{ content?: string; encoding?: string }>(url, { headers: { 'X-GitHub-Api-Version': '2026-03-10' } })
    if (!response.content) {
      trace('platform.content.empty', { url })
      return undefined
    }
    const content = response.encoding === 'base64' || !response.encoding ? decodeBase64Content(response.content) : response.content
    trace('platform.content.loaded', { url, encoding: response.encoding ?? 'base64' })
    return content
  } catch {
    trace('platform.content.unavailable', { url })
    return undefined
  }
}

export async function getRemoteChange(location: ReviewLocation): Promise<RemoteChange> {
  trace('platform.change.load', { provider: location.provider, baseUrl: location.baseUrl, repositoryPath: location.repositoryPath, changeNumber: location.changeNumber })
  if (location.provider === 'GitLab') {
    const project = encodeURIComponent(location.repositoryPath)
    const data = await request<{ iid: number; title: string; description?: string; source_branch: string; target_branch: string; author?: { username?: string; name?: string }; web_url: string }>(`${apiBaseUrl(location)}/projects/${project}/merge_requests/${location.changeNumber}`)
    return { provider: 'GitLab', number: data.iid, title: data.title, description: data.description ?? '', sourceBranch: data.source_branch, targetBranch: data.target_branch, author: data.author?.username ?? data.author?.name ?? 'Desconocido', repositoryPath: location.repositoryPath, webUrl: data.web_url }
  }

  const data = await request<{ number: number; title: string; body?: string; head: { ref: string }; base: { ref: string }; user?: { login: string }; html_url: string }>(`${apiBaseUrl(location)}/repos/${location.repositoryPath}/pulls/${location.changeNumber}`, { headers: { 'X-GitHub-Api-Version': '2026-03-10' } })
  return { provider: 'GitHub', number: data.number, title: data.title, description: data.body ?? '', sourceBranch: data.head.ref, targetBranch: data.base.ref, author: data.user?.login ?? 'Desconocido', repositoryPath: location.repositoryPath, webUrl: data.html_url }
}

export async function listRemoteFiles(location: ReviewLocation): Promise<RemoteFile[]> {
  if (location.provider === 'GitLab') {
    const project = encodeURIComponent(location.repositoryPath)
    const data = await request<Array<{ new_path: string; old_path: string; new_file: boolean; deleted_file: boolean; renamed_file: boolean; diff?: string }>>(`${apiBaseUrl(location)}/projects/${project}/merge_requests/${location.changeNumber}/diffs`)
    const files = data.map((file) => ({ path: file.new_path || file.old_path, status: file.deleted_file ? 'removed' as const : file.new_file ? 'added' as const : file.renamed_file ? 'renamed' as const : 'modified' as const, additions: 0, deletions: 0, patch: file.diff }))
    trace('platform.files.loaded', { provider: location.provider, count: files.length })
    return files
  }

  const data = await request<Array<{ sha: string; filename: string; status: string; additions: number; deletions: number; changes: number; blob_url?: string; raw_url?: string; contents_url?: string; patch?: string }>>(`${apiBaseUrl(location)}/repos/${location.repositoryPath}/pulls/${location.changeNumber}/files`, { headers: { 'X-GitHub-Api-Version': '2026-03-10' } })
  const files: RemoteFile[] = data.map((file) => {
    const status: RemoteFile['status'] = file.status === 'added' || file.status === 'modified' || file.status === 'removed' || file.status === 'renamed' ? file.status : 'unknown'
    return { path: file.filename, sha: file.sha, status, additions: file.additions, deletions: file.deletions, changes: file.changes, blobUrl: file.blob_url, rawUrl: file.raw_url, contentsUrl: file.contents_url, patch: file.patch }
  })
  const filesWithContent = await Promise.all(files.map(async (file) => ({ ...file, content: file.contentsUrl ? await requestContent(file.contentsUrl) : undefined })))
  trace('platform.files.loaded', { provider: location.provider, count: filesWithContent.length, contentCount: filesWithContent.filter((file) => file.content !== undefined).length, patchCount: filesWithContent.filter((file) => file.patch !== undefined).length })
  return filesWithContent
}

export async function listRemoteComments(location: ReviewLocation): Promise<RemoteComment[]> {
  if (location.provider === 'GitLab') {
    const project = encodeURIComponent(location.repositoryPath)
    const data = await request<Array<{ id: string; body: string; author?: { username?: string; name?: string }; created_at: string; web_url?: string }>>(`${apiBaseUrl(location)}/projects/${project}/merge_requests/${location.changeNumber}/notes`)
    const comments = data.map((comment) => ({ id: comment.id, author: comment.author?.username ?? comment.author?.name ?? 'Desconocido', body: comment.body, createdAt: comment.created_at, url: comment.web_url }))
    trace('platform.comments.loaded', { provider: location.provider, count: comments.length })
    return comments
  }

  const data = await request<Array<{ id: number; body: string; user?: { login: string }; created_at: string; path?: string; line?: number; html_url?: string }>>(`${apiBaseUrl(location)}/repos/${location.repositoryPath}/pulls/${location.changeNumber}/comments`, { headers: { 'X-GitHub-Api-Version': '2026-03-10' } })
  const comments = data.map((comment) => ({ id: String(comment.id), author: comment.user?.login ?? 'Desconocido', body: comment.body, createdAt: comment.created_at, path: comment.path, line: comment.line, url: comment.html_url }))
  trace('platform.comments.loaded', { provider: location.provider, count: comments.length })
  return comments
}

export async function publishRemoteComment(location: ReviewLocation, comment: { body: string }): Promise<void> {
  trace('platform.comment.publish', { provider: location.provider, repositoryPath: location.repositoryPath, changeNumber: location.changeNumber })
  if (location.provider === 'GitLab') {
    const project = encodeURIComponent(location.repositoryPath)
    await request(`${apiBaseUrl(location)}/projects/${project}/merge_requests/${location.changeNumber}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment.body }),
    })
    return
  }

  await request(`${apiBaseUrl(location)}/repos/${location.repositoryPath}/issues/${location.changeNumber}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
    body: JSON.stringify({ body: comment.body }),
  })
}
