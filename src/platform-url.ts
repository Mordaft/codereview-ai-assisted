export type {
  Platform,
  PlatformAdapter,
  PlatformChangeInfo,
  PlatformEndpoints,
  RemoteChange,
  RemoteComment,
  RemoteFile,
  ReviewLocation,
} from './adapters'

export {
  detectPlatform,
  getAdapter,
  GitHubAdapter,
  GitLabAdapter,
  parseReviewUrl,
  resolvePlatformAdapter,
} from './adapters'
