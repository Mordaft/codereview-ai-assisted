import { trace } from '../diagnostics'
import { platformRequest } from './request'
import type {
  PlatformAdapter,
  PlatformChangeInfo,
  PlatformEndpoints,
  RemoteChange,
  RemoteComment,
  RemoteFile,
  ReviewLocation,
} from './types'

export class GitLabAdapter implements PlatformAdapter {
  readonly platform = 'GitLab' as const

  canHandle(value: string | URL): boolean {
    let url: URL
    try {
      url = typeof value === 'string' ? new URL(value.trim()) : value
    } catch {
      return false
    }

    if (!['http:', 'https:'].includes(url.protocol)) return false

    if (url.hostname === 'gitlab.com' || url.hostname.includes('gitlab')) return true

    const segments = url.pathname.split('/').filter(Boolean)
    return segments.some((segment) => segment === 'merge_requests')
  }

  parseUrl(value: string | URL): PlatformChangeInfo {
    let url: URL
    try {
      url = typeof value === 'string' ? new URL(value.trim()) : value
    } catch {
      throw new Error('La URL de la Merge Request de GitLab no es valida.')
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('La URL debe utilizar HTTP o HTTPS.')
    }

    const segments = url.pathname.split('/').filter(Boolean)
    const mrIndex = segments.findIndex((segment) => segment === 'merge_requests')

    if (mrIndex < 0) {
      throw new Error('La URL no contiene un indicador de Merge Request (/merge_requests/).')
    }

    const changeNumber = Number(segments[mrIndex + 1])
    if (!Number.isInteger(changeNumber) || changeNumber <= 0) {
      throw new Error('No se pudo encontrar un numero de Merge Request valido en la URL.')
    }

    // Comprobar si es URL de API v4: /api/v4/projects/:project/merge_requests/:iid
    const isApi = segments.slice(0, mrIndex).includes('api') && segments.slice(0, mrIndex).includes('v4')
    let repositoryPath = ''
    let owner = ''
    let repository = ''

    if (isApi) {
      const projectsIndex = segments.findIndex((segment) => segment === 'projects')
      if (projectsIndex >= 0 && projectsIndex + 1 < mrIndex) {
        const rawProject = segments[projectsIndex + 1]
        repositoryPath = decodeURIComponent(rawProject)
        const parts = repositoryPath.split('/')
        repository = parts.at(-1) || repositoryPath
        owner = parts.slice(0, -1).join('/') || repository
      } else {
        throw new Error('No se pudo identificar el proyecto de GitLab en la URL del API.')
      }
    } else {
      // Manejar tanto con '-' antes de merge_requests como sin guión
      const repoEndIndex = mrIndex > 0 && segments[mrIndex - 1] === '-' ? mrIndex - 1 : mrIndex
      const repositorySegments = segments.slice(0, repoEndIndex)
      if (repositorySegments.length < 1) {
        throw new Error('No se pudo identificar el repositorio en la URL de GitLab.')
      }

      repositoryPath = repositorySegments.join('/')
      owner = repositorySegments.length > 1 ? repositorySegments.slice(0, -1).join('/') : repositorySegments[0]
      repository = repositorySegments.at(-1)!
    }

    const baseUrl = url.origin
    const apiBaseUrl = `${baseUrl}/api/v4`
    const projectEncoded = encodeURIComponent(repositoryPath)
    const webUrl = `${baseUrl}/${repositoryPath}/-/merge_requests/${changeNumber}`

    const endpoints: PlatformEndpoints = {
      changeUrl: `${apiBaseUrl}/projects/${projectEncoded}/merge_requests/${changeNumber}`,
      filesUrl: `${apiBaseUrl}/projects/${projectEncoded}/merge_requests/${changeNumber}/diffs`,
      commentsUrl: `${apiBaseUrl}/projects/${projectEncoded}/merge_requests/${changeNumber}/notes`,
      publishCommentUrl: `${apiBaseUrl}/projects/${projectEncoded}/merge_requests/${changeNumber}/notes`,
    }

    return {
      provider: 'GitLab',
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
    const apiBase = `${location.baseUrl}/api/v4`
    const projectEncoded = encodeURIComponent(location.repositoryPath)
    return {
      changeUrl: `${apiBase}/projects/${projectEncoded}/merge_requests/${location.changeNumber}`,
      filesUrl: `${apiBase}/projects/${projectEncoded}/merge_requests/${location.changeNumber}/diffs`,
      commentsUrl: `${apiBase}/projects/${projectEncoded}/merge_requests/${location.changeNumber}/notes`,
      publishCommentUrl: `${apiBase}/projects/${projectEncoded}/merge_requests/${location.changeNumber}/notes`,
    }
  }

  async getRemoteChange(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteChange> {
    const endpoints = this.getEndpoints(location)
    trace('platform.change.load', {
      provider: 'GitLab',
      baseUrl: location.baseUrl,
      repositoryPath: location.repositoryPath,
      changeNumber: location.changeNumber,
      apiUrl: endpoints.changeUrl,
    })

    const data = await platformRequest<{
      iid: number
      title: string
      description?: string
      source_branch: string
      target_branch: string
      author?: { username?: string; name?: string }
      web_url: string
    }>(endpoints.changeUrl)

    return {
      provider: 'GitLab',
      number: data.iid,
      title: data.title,
      description: data.description ?? '',
      sourceBranch: data.source_branch,
      targetBranch: data.target_branch,
      author: data.author?.username ?? data.author?.name ?? 'Desconocido',
      repositoryPath: location.repositoryPath,
      webUrl: data.web_url,
    }
  }

  async listRemoteFiles(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteFile[]> {
    const endpoints = this.getEndpoints(location)
    const data = await platformRequest<Array<{
      new_path: string
      old_path: string
      new_file: boolean
      deleted_file: boolean
      renamed_file: boolean
      diff?: string
    }>>(endpoints.filesUrl)

    const files = data.map((file) => ({
      path: file.new_path || file.old_path,
      status: file.deleted_file
        ? ('removed' as const)
        : file.new_file
        ? ('added' as const)
        : file.renamed_file
        ? ('renamed' as const)
        : ('modified' as const),
      additions: 0,
      deletions: 0,
      patch: file.diff,
    }))

    trace('platform.files.loaded', { provider: 'GitLab', count: files.length })
    return files
  }

  async listRemoteComments(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteComment[]> {
    const endpoints = this.getEndpoints(location)
    const data = await platformRequest<Array<{
      id: string | number
      body: string
      author?: { username?: string; name?: string }
      created_at: string
      web_url?: string
    }>>(endpoints.commentsUrl)

    const comments = data.map((comment) => ({
      id: String(comment.id),
      author: comment.author?.username ?? comment.author?.name ?? 'Desconocido',
      body: comment.body,
      createdAt: comment.created_at,
      url: comment.web_url,
    }))

    trace('platform.comments.loaded', { provider: 'GitLab', count: comments.length })
    return comments
  }

  async publishRemoteComment(location: PlatformChangeInfo | ReviewLocation, comment: { body: string }): Promise<void> {
    const endpoints = this.getEndpoints(location)
    trace('platform.comment.publish', {
      provider: 'GitLab',
      repositoryPath: location.repositoryPath,
      changeNumber: location.changeNumber,
      publishUrl: endpoints.publishCommentUrl,
    })

    await platformRequest(endpoints.publishCommentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: comment.body }),
    })
  }
}
