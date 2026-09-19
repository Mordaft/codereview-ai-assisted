import { getLanguage, t } from '../i18n'
import {
  CommentSeverity,
  ReviewStatus as ReviewStatusConst,
} from '../enums'
import type { Review, ReviewStatus } from '../review-db'
import { getReviewThinking } from '../review-events'

export const isClosedReview = (review: Review) =>
  review.status === ReviewStatusConst.CLOSED ||
  review.status === ReviewStatusConst.APPROVED ||
  (review.status as unknown) === 'Cerrada' ||
  (review.status as unknown) === 'Aprobada'

export function isReviewProcessing(review: Review): boolean {
  if (
    review.status === ReviewStatusConst.IN_PREPARATION ||
    (review.status as unknown) === 'En preparacion' ||
    (review.status as unknown) === 'inPreparation'
  ) {
    return true
  }
  if (review.id) {
    const thinking = getReviewThinking(review.id)
    if (thinking && thinking.phase !== 'completed') {
      return true
    }
  }
  return false
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', !isDark)
  localStorage.setItem('codereview-theme', isDark ? 'light' : 'dark')
}

export function renderLangToggle(id: string) {
  const currentLang = getLanguage()
  const targetLang = currentLang === 'es' ? 'en' : 'es'
  const toggleLabel = `${t('common.toggleLang')}: ${targetLang.toUpperCase()}`
  return `<button class="lang-toggle bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark font-bold text-xs" id="${id}" type="button" aria-label="${toggleLabel}" title="${toggleLabel}">${currentLang.toUpperCase()}</button>`
}

export function statusClass(status: ReviewStatus | number | string) {
  switch (status) {
    case ReviewStatusConst.IN_PREPARATION:
    case 'En preparacion':
    case 'inPreparation':
      return 'en-preparacion'
    case ReviewStatusConst.CLOSED:
    case 'Cerrada':
    case 'closed':
      return 'cerrada'
    case ReviewStatusConst.APPROVED:
    case 'Aprobada':
    case 'approved':
      return 'aprobada'
    case ReviewStatusConst.IN_PROGRESS:
    case 'En curso':
    case 'inProgress':
    default:
      return 'en-curso'
  }
}

export function severityClass(severity?: CommentSeverity | number | string) {
  switch (severity) {
    case CommentSeverity.HIGH:
    case 'alta':
    case 'high':
      return 'alta'
    case CommentSeverity.LOW:
    case 'baja':
    case 'low':
      return 'baja'
    case CommentSeverity.MEDIUM:
    case 'media':
    case 'medium':
    default:
      return 'media'
  }
}

export function renderBrandLogoSvg(size = 32, idPrefix = 'brand') {
  return `<svg class="brand-logo" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${idPrefix}NeuralGrad" x1="8" y1="36" x2="40" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#87b743"/><stop offset="60%" stop-color="#c4f36b"/><stop offset="100%" stop-color="#e3ff99"/></linearGradient><filter id="${idPrefix}NeonGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter></defs><rect width="48" height="48" rx="12" fill="#17211f"/><path d="M8 26H16" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="26" r="2.6" fill="#17211f" stroke="#c4f36b" stroke-width="2"/><path d="M16 26C18 18 21 17 25 17H28" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.3" stroke-linecap="round"/><circle cx="28" cy="17" r="2.3" fill="#17211f" stroke="#c4f36b" stroke-width="1.8"/><path d="M16 26C18 34 21 35 25 35H28" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.3" stroke-linecap="round"/><circle cx="28" cy="35" r="2.3" fill="#17211f" stroke="#c4f36b" stroke-width="1.8"/><path d="M22 26L26.5 31C27.4 32 28.8 31.4 29.5 30.3L37.5 15" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${idPrefix}NeonGlow)"/><path d="M38.5 7.5C38.5 9.8 37 11.2 34.8 11.2C37 11.2 38.5 12.6 38.5 14.9C38.5 12.6 40 11.2 42.2 11.2C40 11.2 38.5 9.8 38.5 7.5Z" fill="#c4f36b" filter="url(#${idPrefix}NeonGlow)"/></svg>`
}

export function renderSidebar(activeScreen: 'reviews' | 'history' | 'settings', activeCount: number) {
  return `
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">${renderBrandLogoSvg(31, 'sidebar')}</span><span>CodeReview <b>AI</b></span></div>
      <div class="sidebar__section-label">${t('sidebar.workspace')}</div>
      <nav class="main-nav" aria-label="${t('sidebar.workspace')}">
        <button class="nav-item ${activeScreen === 'reviews' ? 'nav-item--active' : ''}" id="reviews-nav" type="button"><span class="nav-icon">▦</span> ${t('sidebar.reviews')} <span class="nav-count">${activeCount}</span></button>
        <button class="nav-item ${activeScreen === 'history' ? 'nav-item--active' : ''}" id="history-nav" type="button"><span class="nav-icon">◷</span> ${t('sidebar.history')}</button>
      </nav>
      <div class="sidebar__footer">
        <button class="nav-item ${activeScreen === 'settings' ? 'nav-item--active' : ''}" id="settings-nav" type="button"><span class="nav-icon">⚙</span> ${t('sidebar.settings')}</button>
        <div class="session"><span class="avatar">AC</span><span><strong>${t('sidebar.localSession')}</strong><small>${t('sidebar.slmConnected')}</small></span><span class="session-dot"></span></div>
      </div>
    </aside>
  `
}

export function formatProcessingTime(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(getLanguage() === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
