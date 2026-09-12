import assert from 'node:assert/strict'
import {
  detectPlatform,
  getAdapter,
  parseReviewUrl,
  resolvePlatformAdapter,
} from '../src/adapters/index'

console.log('--- Iniciando pruebas de Adaptadores de Plataforma ---')

// Caso 1: URL web estándar de GitHub con /pull/
{
  const url = 'https://github.com/facebook/react/pull/28000'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitHub')
  assert.equal(info.owner, 'facebook')
  assert.equal(info.repository, 'react')
  assert.equal(info.repositoryPath, 'facebook/react')
  assert.equal(info.changeNumber, 28000)
  assert.equal(info.baseUrl, 'https://github.com')
  assert.equal(info.apiBaseUrl, 'https://api.github.com')
  assert.equal(info.endpoints.changeUrl, 'https://api.github.com/repos/facebook/react/pulls/28000')
  assert.equal(info.endpoints.filesUrl, 'https://api.github.com/repos/facebook/react/pulls/28000/files')
  assert.equal(info.endpoints.commentsUrl, 'https://api.github.com/repos/facebook/react/pulls/28000/comments')
  assert.equal(info.endpoints.publishCommentUrl, 'https://api.github.com/repos/facebook/react/issues/28000/comments')
  console.log('✓ Caso 1 superado: GitHub web estándar (/pull/28000 -> adaptado a /pulls/28000)')
}

// Caso 2: URL de GitHub con /pulls/ (el caso que el usuario antes modificaba manualmente)
{
  const url = 'https://github.com/facebook/react/pulls/28000'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitHub')
  assert.equal(info.changeNumber, 28000)
  assert.equal(info.endpoints.changeUrl, 'https://api.github.com/repos/facebook/react/pulls/28000')
  console.log('✓ Caso 2 superado: GitHub con plural /pulls/ adaptado correctamente')
}

// Caso 3: URL de GitHub con sub-ruta de navegación (/pull/42/files)
{
  const url = 'https://github.com/facebook/react/pull/28000/files'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitHub')
  assert.equal(info.changeNumber, 28000)
  assert.equal(info.endpoints.changeUrl, 'https://api.github.com/repos/facebook/react/pulls/28000')
  console.log('✓ Caso 3 superado: GitHub con pestaña /files adaptado correctamente')
}

// Caso 4: URL directa de API de GitHub
{
  const url = 'https://api.github.com/repos/facebook/react/pulls/28000'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitHub')
  assert.equal(info.owner, 'facebook')
  assert.equal(info.repository, 'react')
  assert.equal(info.changeNumber, 28000)
  assert.equal(info.endpoints.changeUrl, 'https://api.github.com/repos/facebook/react/pulls/28000')
  console.log('✓ Caso 4 superado: URL de API de GitHub adaptada correctamente')
}

// Caso 5: GitHub Enterprise autoalojado
{
  const url = 'https://github.mycorp.internal/my-org/my-app/pull/123'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitHub')
  assert.equal(info.owner, 'my-org')
  assert.equal(info.repository, 'my-app')
  assert.equal(info.baseUrl, 'https://github.mycorp.internal')
  assert.equal(info.apiBaseUrl, 'https://github.mycorp.internal/api/v3')
  assert.equal(info.endpoints.changeUrl, 'https://github.mycorp.internal/api/v3/repos/my-org/my-app/pulls/123')
  console.log('✓ Caso 5 superado: GitHub Enterprise autoalojado adaptado a API v3')
}

// Caso 6: GitLab web estándar con /-/merge_requests/
{
  const url = 'https://gitlab.com/gitlab-org/gitlab/-/merge_requests/14567'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitLab')
  assert.equal(info.owner, 'gitlab-org')
  assert.equal(info.repository, 'gitlab')
  assert.equal(info.repositoryPath, 'gitlab-org/gitlab')
  assert.equal(info.changeNumber, 14567)
  assert.equal(info.baseUrl, 'https://gitlab.com')
  assert.equal(info.apiBaseUrl, 'https://gitlab.com/api/v4')
  assert.equal(info.endpoints.changeUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567')
  assert.equal(info.endpoints.filesUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567/diffs')
  assert.equal(info.endpoints.commentsUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567/notes')
  assert.equal(info.endpoints.publishCommentUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567/notes')
  console.log('✓ Caso 6 superado: GitLab web estándar con /-/ adaptado a API v4')
}

// Caso 7: GitLab con grupos anidados y sin guion /-/
{
  const url = 'https://gitlab.com/company/team/subteam/backend/merge_requests/42'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitLab')
  assert.equal(info.owner, 'company/team/subteam')
  assert.equal(info.repository, 'backend')
  assert.equal(info.repositoryPath, 'company/team/subteam/backend')
  assert.equal(info.changeNumber, 42)
  assert.equal(info.endpoints.changeUrl, 'https://gitlab.com/api/v4/projects/company%2Fteam%2Fsubteam%2Fbackend/merge_requests/42')
  console.log('✓ Caso 7 superado: GitLab con grupos anidados sin guión adaptado correctamente')
}

// Caso 8: GitLab con sub-ruta (/diffs)
{
  const url = 'https://gitlab.com/gitlab-org/gitlab/-/merge_requests/14567/diffs'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitLab')
  assert.equal(info.changeNumber, 14567)
  assert.equal(info.endpoints.changeUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567')
  console.log('✓ Caso 8 superado: GitLab con subruta /diffs adaptado correctamente')
}

// Caso 9: GitLab URL de API v4
{
  const url = 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567'
  const info = parseReviewUrl(url)
  assert.equal(info.provider, 'GitLab')
  assert.equal(info.repositoryPath, 'gitlab-org/gitlab')
  assert.equal(info.changeNumber, 14567)
  assert.equal(info.endpoints.changeUrl, 'https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab/merge_requests/14567')
  console.log('✓ Caso 9 superado: URL de API v4 de GitLab adaptada correctamente')
}

// Caso 10: detectPlatform reactivo
{
  const githubResult = detectPlatform('https://github.com/owner/repo/pull/1')
  assert.ok(githubResult)
  assert.equal(githubResult.info.provider, 'GitHub')

  const gitlabResult = detectPlatform('https://gitlab.com/owner/repo/-/merge_requests/2')
  assert.ok(gitlabResult)
  assert.equal(gitlabResult.info.provider, 'GitLab')

  const invalidResult = detectPlatform('https://google.com')
  assert.equal(invalidResult, null)

  const emptyResult = detectPlatform('')
  assert.equal(emptyResult, null)

  console.log('✓ Caso 10 superado: detectPlatform reactivo para UI funciona como se espera')
}

// Caso 11: Error controlado en parseReviewUrl con URL no soportada
{
  assert.throws(
    () => parseReviewUrl('https://example.com/other/page'),
    /La URL no parece una Pull Request de GitHub ni una Merge Request de GitLab/
  )
  console.log('✓ Caso 11 superado: Mensajes de error controlados para URLs no soportadas')
}

console.log('\n=============================================')
console.log('  ¡TODAS LAS PRUEBAS DE ADAPTADORES HAN PASADO!  ')
console.log('=============================================')
