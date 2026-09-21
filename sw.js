const SW_VERSION = '1790014546672'
const CACHE_NAME = `codereview-shell-${SW_VERSION}`
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg']

const STATIC_EXTENSIONS = [
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.webmanifest',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.map',
]

const STATIC_DESTINATIONS = ['document', 'script', 'style', 'image', 'font', 'manifest']

/**
 * Determina si una petición corresponde a navegación o documento HTML principal.
 */
function isNavigationRequest(request) {
  if (!request) return false
  if (request.mode === 'navigate' || request.destination === 'document') {
    return true
  }
  try {
    const url = new URL(request.url)
    return url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')
  } catch {
    return false
  }
}

/**
 * Determina si una petición corresponde a contenido estático y por tanto es susceptible de cachearse.
 * Las peticiones a APIs (GitHub, GitLab, SLMs locales), llamadas dinámicas o métodos no-GET no deben cachearse.
 */
function isStaticRequest(request) {
  if (!request || request.method !== 'GET') {
    return false
  }

  // Las peticiones autenticadas nunca deben cachearse como contenido estático
  if (request.headers && typeof request.headers.has === 'function' && request.headers.has('authorization')) {
    return false
  }

  let url
  try {
    url = new URL(request.url)
  } catch {
    return false
  }

  // Solo protocolos http y https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }

  const pathname = url.pathname.toLowerCase()

  // Excluir explícitamente llamadas a APIs y servicios dinámicos o de IA
  if (
    url.hostname === 'api.github.com' ||
    url.hostname === 'api.openai.com' ||
    pathname.includes('/api/') ||
    pathname.includes('/v1/') ||
    pathname.includes('/v4/') ||
    pathname.includes('/graphql')
  ) {
    return false
  }

  // Excluir peticiones internas de desarrollo y HMR de Vite
  if (
    pathname.startsWith('/@') ||
    pathname.includes('/@vite/') ||
    url.searchParams.has('token')
  ) {
    return false
  }

  // Permitir explícitamente recursos estáticos de fuentes de Google (hojas de estilo y archivos de fuentes)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return true
  }

  const currentOrigin = typeof self !== 'undefined' && self.location ? self.location.origin : null
  const isSameOrigin = currentOrigin
    ? url.origin === currentOrigin
    : (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || !url.hostname.includes('.'))

  // Para otros orígenes cruzados (CDNs externas), solo admitir recursos explícitamente estáticos
  if (!isSameOrigin) {
    const isStaticCDN =
      url.hostname.includes('cdn') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('unpkg')

    const hasStaticExt = STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
    const hasStaticDest = Boolean(request.destination && STATIC_DESTINATIONS.includes(request.destination))

    return isStaticCDN && (hasStaticExt || hasStaticDest)
  }

  // Para peticiones del mismo origen:
  // 1. Tipo de destino estático de la petición del navegador
  if (request.destination && STATIC_DESTINATIONS.includes(request.destination)) {
    return true
  }

  // 2. Extensiones de fichero estáticas
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return true
  }

  // 3. Rutas del App Shell y directorio de assets estáticos generados por Vite
  if (
    pathname === '/' ||
    pathname.endsWith('/') ||
    pathname.includes('/assets/') ||
    APP_SHELL.some((shellPath) => {
      const normalized = shellPath.replace(/^\./, '')
      return pathname === normalized || pathname.endsWith(normalized)
    })
  ) {
    return true
  }

  return false
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch((err) => {
        console.warn('[SW] Error pre-cacheando app shell:', err)
      })
    )
    self.skipWaiting()
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
    )
    self.clients.claim()
  })

  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting()
    }
  })

  self.addEventListener('fetch', (event) => {
    // Ignorar y no cachear ninguna petición diferente a contenidos estáticos
    if (!isStaticRequest(event.request)) {
      return
    }

    // Para navegación y documento HTML (index.html), estrategia Network-First con fallback a caché
    if (isNavigationRequest(event.request)) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache)
              })
            }
            return networkResponse
          })
          .catch(() => {
            return caches.match(event.request).then((cached) => {
              if (cached) return cached
              return caches.match('./index.html')
            })
          })
      )
      return
    }

    // Para assets inmutables / estáticos (.js, .css, .svg, fuentes), estrategia Cache-First con actualización
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')
            ) {
              return networkResponse
            }

            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })

            return networkResponse
          })
          .catch((error) => {
            if (event.request.mode === 'navigate' || event.request.destination === 'document') {
              return caches.match('./index.html')
            }
            throw error
          })
      })
    )
  })
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isStaticRequest, isNavigationRequest, CACHE_NAME, APP_SHELL, STATIC_EXTENSIONS, STATIC_DESTINATIONS }
}
