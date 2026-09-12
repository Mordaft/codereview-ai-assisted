import { getAdapter } from './adapters'
import type { RemoteChange, RemoteComment, RemoteFile, ReviewLocation } from './adapters'

export type { RemoteChange, RemoteComment, RemoteFile }

export async function getRemoteChange(location: ReviewLocation): Promise<RemoteChange> {
  const adapter = getAdapter(location.provider)
  return adapter.getRemoteChange(location)
}

export async function listRemoteFiles(location: ReviewLocation): Promise<RemoteFile[]> {
  const adapter = getAdapter(location.provider)
  return adapter.listRemoteFiles(location)
}

export async function listRemoteComments(location: ReviewLocation): Promise<RemoteComment[]> {
  const adapter = getAdapter(location.provider)
  return adapter.listRemoteComments(location)
}

export async function publishRemoteComment(location: ReviewLocation, comment: { body: string }): Promise<void> {
  const adapter = getAdapter(location.provider)
  return adapter.publishRemoteComment(location, comment)
}
