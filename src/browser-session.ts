let repositoryAccessToken: string | undefined

export function hasRepositoryAccessToken() {
  return Boolean(repositoryAccessToken)
}

export function setRepositoryAccessToken(token: string) {
  const normalizedToken = token.trim()
  if (!normalizedToken) throw new Error('El access token no puede estar vacio.')
  repositoryAccessToken = normalizedToken
}

export function getRepositoryAccessToken() {
  if (!repositoryAccessToken) throw new Error('No hay un access token cargado para esta sesion.')
  return repositoryAccessToken
}

export function repositoryAuthHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getRepositoryAccessToken()}`,
  }
}
