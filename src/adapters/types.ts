export type Platform = 'GitHub' | 'GitLab'

export interface ReviewLocation {
  provider: Platform
  baseUrl: string
  repositoryPath: string
  owner: string
  repository: string
  changeNumber: number
}

export interface PlatformEndpoints {
  changeUrl: string
  filesUrl: string
  commentsUrl: string
  publishCommentUrl: string
}

export interface PlatformChangeInfo extends ReviewLocation {
  apiBaseUrl: string
  webUrl: string
  endpoints: PlatformEndpoints
}

export interface RemoteChange {
  provider: Platform
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

export interface PlatformAdapter {
  readonly platform: Platform
  canHandle(url: string | URL): boolean
  parseUrl(value: string | URL): PlatformChangeInfo
  getRemoteChange(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteChange>
  listRemoteFiles(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteFile[]>
  listRemoteComments(location: PlatformChangeInfo | ReviewLocation): Promise<RemoteComment[]>
  publishRemoteComment(location: PlatformChangeInfo | ReviewLocation, comment: { body: string }): Promise<void>
}
