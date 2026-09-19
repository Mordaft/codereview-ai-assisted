import { t } from './i18n'

let registration: ServiceWorkerRegistration | undefined
let updateAvailable = false
let refreshing = false

export function getRegistration(): ServiceWorkerRegistration | undefined {
  return registration
}

export function isUpdateAvailable(): boolean {
  return updateAvailable
}

function showUpdateToast(reg: ServiceWorkerRegistration) {
  updateAvailable = true
  let toast = document.querySelector<HTMLDivElement>('#pwa-update-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'pwa-update-toast'
    toast.className = 'pwa-update-toast'
    toast.setAttribute('role', 'alert')
    document.body.appendChild(toast)
  }

  toast.innerHTML = `
    <div class="pwa-update-toast__content">
      <span class="pwa-update-toast__icon" aria-hidden="true">✦</span>
      <span class="pwa-update-toast__text font-medium text-sm">${t('pwa.updateAvailable')}</span>
    </div>
    <div class="pwa-update-toast__actions">
      <button id="pwa-update-action" class="pwa-update-toast__btn primary-action text-xs" type="button">
        ${t('pwa.updateBtn')}
      </button>
      <button id="pwa-update-dismiss" class="pwa-update-toast__close" type="button" aria-label="${t('common.close')}">×</button>
    </div>
  `

  toast.classList.add('pwa-update-toast--visible')

  document.querySelector('#pwa-update-dismiss')?.addEventListener('click', () => {
    toast?.classList.remove('pwa-update-toast--visible')
  })

  document.querySelector('#pwa-update-action')?.addEventListener('click', () => {
    const actionBtn = document.querySelector<HTMLButtonElement>('#pwa-update-action')
    if (actionBtn) {
      actionBtn.disabled = true
      actionBtn.textContent = t('pwa.updating')
    }

    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }

    // Fallback de recarga en caso de que no se emita controllerchange
    setTimeout(() => {
      window.location.reload()
    }, 1200)
  })
}

export async function checkForUpdates(): Promise<{ hasUpdate: boolean; message: string }> {
  if (!('serviceWorker' in navigator)) {
    return { hasUpdate: false, message: t('pwa.upToDate') }
  }

  if (!registration) {
    try {
      registration = await navigator.serviceWorker.getRegistration()
    } catch {
      return { hasUpdate: false, message: t('pwa.upToDate') }
    }
  }

  if (!registration) {
    return { hasUpdate: false, message: t('pwa.upToDate') }
  }

  try {
    await registration.update()
    if (registration.waiting) {
      showUpdateToast(registration)
      return { hasUpdate: true, message: t('pwa.updateAvailable') }
    }
    return { hasUpdate: false, message: t('pwa.upToDate') }
  } catch {
    return { hasUpdate: false, message: t('pwa.upToDate') }
  }
}

export async function initPwaUpdate() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  // En modo desarrollo (Vite dev server), desactivar el Service Worker para evitar conflictos con HMR y WebSockets
  if (import.meta.env.DEV) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        await reg.unregister()
      }
    } catch {
      // Ignorar errores al desregistrar en dev
    }
    return
  }

  // Escuchar cuando el nuevo Service Worker toma el control y recargar la página limpia
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  try {
    // updateViaCache: 'none' evita que GitHub Pages cachee sw.js con sus cabeceras HTTP de 10 min
    registration = await navigator.serviceWorker.register('./sw.js', {
      updateViaCache: 'none',
    })

    // 1. Si ya hay un worker esperando activación al cargar la app
    if (registration.waiting) {
      showUpdateToast(registration)
    }

    // 2. Escuchar si se descubre un nuevo worker durante el ciclo de vida
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (registration) showUpdateToast(registration)
        }
      })
    })

    // 3. Comprobar actualizaciones cuando el usuario regresa a la ventana
    window.addEventListener('focus', () => {
      void registration?.update()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void registration?.update()
      }
    })

    // 4. Comprobación periódica cada 15 minutos
    setInterval(() => {
      void registration?.update()
    }, 15 * 60 * 1000)
  } catch (error) {
    console.warn('[PWA] Error registrando Service Worker con actualización:', error)
  }
}
