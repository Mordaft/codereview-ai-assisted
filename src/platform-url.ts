export type Platform = 'GitHub' | 'GitLab'

export interface ReviewLocation {
  provider: Platform
  baseUrl: string
  repositoryPath: string
  owner: string
  repository: string
  changeNumber: number
}

export function parseReviewUrl(value: string): ReviewLocation {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('La URL de la MR o PR no es valida.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('La URL debe utilizar HTTP o HTTPS.')
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const mergeRequestIndex = segments.findIndex((segment) => segment === 'merge_requests')
  if (mergeRequestIndex > 0 && segments[mergeRequestIndex - 1] === '-') {
    const repositorySegments = segments.slice(0, mergeRequestIndex - 1)
    const changeNumber = Number(segments[mergeRequestIndex + 1])
    if (repositorySegments.length >= 2 && Number.isInteger(changeNumber) && changeNumber > 0) {
      const repositoryPath = repositorySegments.join('/')
      return {
        provider: 'GitLab',
        baseUrl: url.origin,
        repositoryPath,
        owner: repositorySegments.slice(0, -1).join('/'),
        repository: repositorySegments.at(-1)!,
        changeNumber,
      }
    }
  }

  const pullIndex = segments.findIndex((segment) => (segment === 'pull' || segment === 'pulls'))
  const changeNumber = Number(segments[pullIndex + 1])
  if (pullIndex === 2 && Number.isInteger(changeNumber) && changeNumber > 0) {
    return {
      provider: 'GitHub',
      baseUrl: url.origin,
      repositoryPath: segments.slice(0, 2).join('/'),
      owner: segments[0],
      repository: segments[1],
      changeNumber,
    }
  }

  throw new Error('La URL no parece una Pull Request de GitHub ni una Merge Request de GitLab.')
}
