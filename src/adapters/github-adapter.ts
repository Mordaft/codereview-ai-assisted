import { trace } from '../diagnostics'
import { decodeBase64Content, platformRequest } from './request'
import type {
  PlatformAdapter,
  PlatformChangeInfo,
  PlatformEndpoints,
  RemoteChange,
  RemoteComment,
  RemoteFile,
  ReviewLocation,
} from './types'

const GITHUB_API_VERSION = '2026-03-10'

export class GitHubAdapter implements PlatformAdapter {
  readonly platform = 'GitHub' as const

  canHandle(value: string | URL): boolean {
    let url: URL
    try {
      url = typeof value === 'string' ? new URL(value.trim()) : value
    } catch {
      return false
    }

    if (!['http:', 'https:'].includes(url.protocol)) return false

    if (url.hostname === 'github.com' || url.hostname === 'api.github.com') return true

    const segments = url.pathname.split('/').filter(Boolean)
    return segments.some((segment) => segment === 'pull' || segment === 'pulls')
  }

  parseUrl(value: string | URL): PlatformChangeInfo {
    let url: URL
    try {
      url = typeof value === 'string' ? new URL(value.trim()) : value
    } catch {
      throw new Error('La URL de la Pull Request de GitHub no es valida.')
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('La URL debe utilizar HTTP o HTTPS.')
    }

    const segments = url.pathname.split('/').filter(Boolean)
    const pullIndex = segments.findIndex((segment) => segment === 'pull' || segment === 'pulls')

    if (pullIndex < 0) {
      throw new Error('La URL no contiene un indicador de Pull Request (/pull/ o /pulls/).')
    }

    const changeNumber = Number(segments[pullIndex + 1])
    if (!Number.isInteger(changeNumber) || changeNumber <= 0) {
      throw new Error('No se pudo encontrar un numero de Pull Request valido en la URL.')
    }

    let owner = ''
    let repository = ''

    // Maneja endpoints de API: /repos/:owner/:repo/pulls/:number
    if (pullIndex >= 3 && segments[pullIndex - 3] === 'repos') {
      owner = segments[pullIndex - 2]
      repository = segments[pullIndex - 1]
    } else if (pullIndex >= 2) {
      // Maneja URLs web estandar: /:owner/:repo/pull/:number o /:owner/:repo/pulls/:number
      owner = segments[pullIndex - 2]
      repository = segments[pullIndex - 1]
    } else {
      throw new Error('No se pudo identificar el propietario y repositorio en la URL de GitHub.')
    }

    const repositoryPath = `${owner}/${repository}`
    const isApiHost = url.hostname === 'api.github.com'
    const isStandardHost = url.hostname === 'github.com'

    const baseUrl = isApiHost ? 'https://github.com' : (isStandardHost ? 'https://github.com' : url.origin)
    const apiBaseUrl = isApiHost || isStandardHost ? 'https://api.github.com' : `${url.origin}/api/v3`
    const webUrl = `${baseUrl}/${repositoryPath}/pull/${changeNumber}`

    const endpoints: PlatformEndpoints = {
      changeUrl: `${apiBaseUrl}/repos/${repositoryPath}/pulls/${changeNumber}`,
      filesUrl: `${apiBaseUrl}/repos/${repositoryPath}/pulls/${changeNumber}/files`,
      commentsUrl: `${apiBaseUrl}/repos/${repositoryPath}/pulls/${changeNumber}/comments`,
      publishCommentUrl: `${apiBaseUrl}/repos/${repositoryPath}/issues/${changeNumber}/comments`,
    }

    return {
      provider: 'GitHub',
      baseUrl,
      apiBaseUrl,
      repositoryPath,
      owner,
      repository,
      changeNumber,
      webUrl,
      endpoints,
    }
  }

  getEndpoints(location: ReviewLocation | PlatformChangeInfo): PlatformEndpoints {
    if ('endpoints' in location && location.endpoints) {
      return location.endpoints
    }
    const apiBase = location.baseUrl === 'https://github.com' ? 'https://api.github.com' : `${location.baseUrl}/api/v3`
    return {
      changeUrl: `${apiBase}/repos/${location.repositoryPath}/pulls/${location.changeNumber}`,
      filesUrl: `${apiBase}/repos/${location.repositoryPath}/pulls/${location.changeNumber}/files`,
      commentsUrl: `${apiBase}/repos/${location.repositoryPath}/pulls/${location.changeNumber}/comments`,
      publishCommentUrl: `${apiBase}/repos/${location.repositoryPath}/issues/${location.changeNumber}/comments`,
    }
  }

  async getRemoteChange(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteChange> {
    const endpoints = this.getEndpoints(location)
    trace('platform.change.load', {
      provider: 'GitHub',
      baseUrl: location.baseUrl,
      repositoryPath: location.repositoryPath,
      changeNumber: location.changeNumber,
      apiUrl: endpoints.changeUrl,
    })

    const data = await platformRequest<{
      number: number
      title: string
      body?: string
      head: { ref: string }
      base: { ref: string }
      user?: { login: string }
      html_url: string
    }>(endpoints.changeUrl, { headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION } })

    return {
      provider: 'GitHub',
      number: data.number,
      title: data.title,
      description: data.body ?? '',
      sourceBranch: data.head.ref,
      targetBranch: data.base.ref,
      author: data.user?.login ?? 'Desconocido',
      repositoryPath: location.repositoryPath,
      webUrl: data.html_url,
    }
  }

  private async requestContent(url: string): Promise<string | undefined> {
    trace('platform.content.start', { url, source: 'contents-api' })
    try {
      const response = await platformRequest<{ content?: string; encoding?: string }>(url, {
        headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION },
      })
      if (!response.content) {
        trace('platform.content.empty', { url })
        return undefined
      }
      const content = response.encoding === 'base64' || !response.encoding
        ? decodeBase64Content(response.content)
        : response.content
      trace('platform.content.loaded', { url, encoding: response.encoding ?? 'base64' })
      return content
    } catch {
      trace('platform.content.unavailable', { url })
      return undefined
    }
  }

  async listRemoteFiles(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteFile[]> {
    const endpoints = this.getEndpoints(location)
    const data = await platformRequest<Array<{
      sha: string
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      blob_url?: string
      raw_url?: string
      contents_url?: string
      patch?: string
    }>>(endpoints.filesUrl, { headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION } })

    const files: RemoteFile[] = data.map((file) => {
      const status: RemoteFile['status'] =
        file.status === 'added' || file.status === 'modified' || file.status === 'removed' || file.status === 'renamed'
          ? file.status
          : 'unknown'
      return {
        path: file.filename,
        sha: file.sha,
        status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blobUrl: file.blob_url,
        rawUrl: file.raw_url,
        contentsUrl: file.contents_url,
        patch: file.patch,
      }
    })

    const filesWithContent = await Promise.all(
      files.map(async (file) => ({
        ...file,
        content: file.contentsUrl ? await this.requestContent(file.contentsUrl) : undefined,
      }))
    )

    trace('platform.files.loaded', {
      provider: 'GitHub',
      count: filesWithContent.length,
      contentCount: filesWithContent.filter((file) => file.content !== undefined).length,
      patchCount: filesWithContent.filter((file) => file.patch !== undefined).length,
    })

    return filesWithContent
  }

  async listRemoteComments(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteComment[]> {
    const endpoints = this.getEndpoints(location)
    const data = await platformRequest<Array<{
      id: number
      body: string
      user?: { login: string }
      created_at: string
      path?: string
      line?: number
      html_url?: string
    }>>(endpoints.commentsUrl, { headers: { 'X-GitHub-Api-Version': GITHUB_API_VERSION } })

    const comments = data.map((comment) => ({
      id: String(comment.id),
      author: comment.user?.login ?? 'Desconocido',
      body: comment.body,
      createdAt: comment.created_at,
      path: comment.path,
      line: comment.line,
      url: comment.html_url,
    }))

    trace('platform.comments.loaded', { provider: 'GitHub', count: comments.length })
    return comments
  }

  async publishRemoteComment(location: PlatformChangeInfo | ReviewLocation, comment: { body: string }): Promise<void> {
    const endpoints = this.getEndpoints(location)
    trace('platform.comment.publish', {
      provider: 'GitHub',
      repositoryPath: location.repositoryPath,
      changeNumber: location.changeNumber,
      publishUrl: endpoints.publishCommentUrl,
    })

    await platformRequest(endpoints.publishCommentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-GitHub-Api-Version': GITHUB_API_VERSION },
      body: JSON.stringify({ body: comment.body }),
    })
  }
}
