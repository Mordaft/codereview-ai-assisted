import assert from 'node:assert/strict'
import sw from '../public/sw.js'

const { isStaticRequest, CACHE_NAME, APP_SHELL } = sw

console.log('--- Iniciando pruebas de Service Worker y Caché Estática ---')

// Caso 1: Los recursos del App Shell deben reconocerse como contenido estático
{
  const shellRequests = [
    'http://localhost:5173/',
    'http://localhost:5173/index.html',
    'http://localhost:5173/manifest.webmanifest',
    'http://localhost:5173/favicon.svg',
  ]

  for (const url of shellRequests) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, true, `El recurso del App Shell ${url} debe ser considerado contenido estático`)
  }
  console.log('✓ Caso 1 superado: Recursos del App Shell reconocidos como contenido estático')
}

// Caso 2: Ficheros de assets generados por Vite (.js, .css, .woff2, etc.) deben ser estáticos
{
  const assetRequests = [
    { url: 'http://localhost:5173/assets/index-DnX4XSxH.css', destination: 'style' },
    { url: 'http://localhost:5173/assets/index-Qcph9EnG.js', destination: 'script' },
    { url: 'http://localhost:5173/assets/review-runtime-COtJ3gy0.js', destination: 'script' },
    { url: 'http://localhost:5173/assets/font.woff2', destination: 'font' },
    { url: 'http://localhost:5173/assets/icon.png', destination: 'image' },
  ]

  for (const req of assetRequests) {
    const isStatic = isStaticRequest({
      method: 'GET',
      url: req.url,
      destination: req.destination,
      headers: new Headers(),
    })
    assert.equal(isStatic, true, `El asset de Vite ${req.url} debe ser considerado contenido estático`)
  }
  console.log('✓ Caso 2 superado: Assets y bundles de Vite (.js, .css, etc.) identificados como estáticos')
}

// Caso 3: Peticiones a CDNs de fuentes y estilos estáticos (Google Fonts)
{
  const cdnRequests = [
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
    'https://fonts.gstatic.com/s/dmsans/v15/rP2Fp2ywxg089UriCZa4ET-DNl0.woff2',
  ]

  for (const url of cdnRequests) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, true, `La fuente/estilo externo ${url} debe ser considerado estático`)
  }
  console.log('✓ Caso 3 superado: Fuentes y estilos externos de Google Fonts permitidos como estáticos')
}

// Caso 4: Peticiones a la API de GitHub NUNCA deben cachearse
{
  const githubApiUrls = [
    'https://api.github.com/repos/facebook/react/pulls/28000',
    'https://api.github.com/repos/facebook/react/pulls/28000/files',
    'https://api.github.com/repos/facebook/react/pulls/28000/comments',
    'https://api.github.com/repos/facebook/react/issues/28000/comments',
  ]

  for (const url of githubApiUrls) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, false, `La petición a GitHub API ${url} NO debe cachearse`)
  }
  console.log('✓ Caso 4 superado: Peticiones a GitHub API excluidas de la caché')
}

// Caso 5: Peticiones a la API de GitLab (pública y on-premise) NUNCA deben cachearse
{
  const gitlabApiUrls = [
    'https://gitlab.com/api/v4/projects/123/merge_requests/456',
    'https://gitlab.com/api/v4/projects/123/merge_requests/456/diffs',
    'https://gitlab.empresa.corp/api/v4/projects/789/merge_requests/10',
  ]

  for (const url of gitlabApiUrls) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, false, `La petición a GitLab API ${url} NO debe cachearse`)
  }
  console.log('✓ Caso 5 superado: Peticiones a GitLab API excluidas de la caché')
}

// Caso 6: Peticiones a SLMs locales (Ollama, LMStudio, etc.) NUNCA deben cachearse
{
  const slmUrls = [
    'http://localhost:11434/v1/models',
    'http://localhost:11434/v1/chat/completions',
    'http://127.0.0.1:8080/v1/models',
  ]

  for (const url of slmUrls) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, false, `La petición al SLM local ${url} NO debe cachearse`)
  }
  console.log('✓ Caso 6 superado: Peticiones de inferencia y modelos SLM excluidas de la caché')
}

// Caso 7: Métodos no-GET (POST, PUT, DELETE, PATCH) NUNCA deben cachearse
{
  const nonGetMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
  for (const method of nonGetMethods) {
    const isStatic = isStaticRequest({
      method,
      url: 'http://localhost:5173/assets/index.js',
      headers: new Headers(),
    })
    assert.equal(isStatic, false, `Método ${method} no debe cachearse aunque la URL parezca un asset`)
  }
  console.log('✓ Caso 7 superado: Métodos no-GET excluidos de la caché')
}

// Caso 8: Peticiones con cabecera de Autorización nunca deben cachearse
{
  const headers = new Headers()
  headers.set('authorization', 'Bearer secret-token')

  const isStatic = isStaticRequest({
    method: 'GET',
    url: 'http://localhost:5173/api/data',
    headers,
  })
  assert.equal(isStatic, false, 'Petición con Authorization header no debe cachearse')
  console.log('✓ Caso 8 superado: Peticiones con cabecera Authorization excluidas de la caché')
}

// Caso 9: Protocolos no soportados (chrome-extension, ws, ftp) NUNCA deben cachearse
{
  const invalidProtocols = [
    'chrome-extension://abcdefghijklmno/content.js',
    'ws://localhost:5173/vite-hmr',
  ]

  for (const url of invalidProtocols) {
    const isStatic = isStaticRequest({ method: 'GET', url, headers: new Headers() })
    assert.equal(isStatic, false, `Protocolo inválido ${url} no debe cachearse`)
  }
  console.log('✓ Caso 9 superado: Protocolos no-HTTP/HTTPS excluidos de la caché')
}

console.log('=============================================')
console.log('  ¡TODAS LAS PRUEBAS DEL SERVICE WORKER HAN PASADO!')
console.log('=============================================')
