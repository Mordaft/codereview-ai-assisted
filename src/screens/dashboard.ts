import { hasRepositoryAccessToken, setRepositoryAccessToken } from '../browser-session'
import { trace } from '../diagnostics'
import { getRemoteChange, listRemoteComments, listRemoteFiles } from '../platform-api'
import { detectPlatform, parseReviewUrl } from '../platform-url'
import { createReview, type Review } from '../review-db'
import { emitReviewProgress, emitReviewThinking, getReviewThinking } from '../review-events'
import { formatRelativeTime, t, tStatus, toggleLanguage } from '../i18n'
import { ReviewFilter } from '../enums'
import {
  isClosedReview,
  isReviewProcessing,
  renderBrandLogoSvg,
  renderLangToggle,
  renderSidebar,
  statusClass,
  toggleTheme,
} from './shared'

export interface DashboardOptions {
  reviews: Review[]
  reviewKpis: {
    activeReviews: number
    pendingSlmComments: number
    publishedComments: number
  }
  filter: ReviewFilter
  navigate: (hash: string) => void
  refreshReviews: () => Promise<{
    reviews: Review[]
    reviewKpis: {
      activeReviews: number
      pendingSlmComments: number
      publishedComments: number
    }
  } | void>
}

export function reviewCard(review: Review): string {
  const timeLabel = formatRelativeTime(review.createdAt || review.updated)
  const thinking = review.id ? getReviewThinking(review.id) : undefined
  const isThinking = Boolean(thinking && thinking.phase !== 'completed')
  const statusDisplay = isThinking
    ? `<span class="status status--thinking"><span class="thinking-pulse"></span>${thinking?.phase === 'suggesting' ? t('reviews.card.generatingProposals') : t('reviews.card.slmThinking')}</span>`
    : `<span class="status status--${statusClass(review.status)}"><span></span>${tStatus(review.status)}</span>`

  const fileInfo = thinking?.filePath
    ? `${thinking.filePath}${thinking.fileIndex && thinking.totalFiles ? ` (${thinking.fileIndex}/${thinking.totalFiles})` : ''}`
    : ''
  const thoughtText = thinking?.thought ? thinking.thought : t('reviews.card.analyzingCode')

  const thinkingBlock = isThinking
    ? `
      <div class="review-card__thinking" data-thinking-for="${review.id}">
        <div class="thinking-badge">
          <span class="thinking-pulse" aria-hidden="true"></span>
          <span class="thinking-label">${thinking?.phase === 'suggesting' ? t('reviews.card.generatingProposals') : t('reviews.card.slmThinking')}</span>
          <span class="thinking-file" title="${fileInfo}">${fileInfo}</span>
        </div>
        <div class="thinking-snippet" title="${thoughtText.replaceAll('"', '&quot;')}">${thoughtText.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</div>
      </div>
    `
    : ''

  return `
    <button class="review-card bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark" data-review-id="${review.id}" type="button">
      <div class="review-card__topline"><span class="provider provider--${review.provider.toLowerCase()}">${review.provider}</span>${statusDisplay}</div>
      <h3 title="${review.title}">${review.title}</h3><p class="repository" title="${review.repository}">${review.repository}</p>
      ${thinkingBlock}
      <div class="progress" aria-label="${t('reviews.card.progressAria', { progress: review.progress })}"><span style="width: ${review.progress}%"></span></div>
      <div class="review-card__meta"><span>${t('reviews.card.commentsCount', { count: review.comments })}</span><span>${timeLabel}</span></div>
    </button>
  `
}

export function renderDashboard(app: HTMLElement, options: DashboardOptions) {
  const { reviews, reviewKpis, filter, navigate, refreshReviews } = options
  const visibleReviews = reviews.filter((review) =>
    filter === ReviewFilter.CLOSED ? isClosedReview(review) : !isClosedReview(review)
  )
  const isAnyReviewProcessing = reviews.some(isReviewProcessing)
  const activeReviewsCount = reviews.filter((review) => !isClosedReview(review)).length

  const accessTokenField = hasRepositoryAccessToken()
    ? ''
    : `<label for="repository-token">${t('dialogs.connect.tokenLabel')}</label><input id="repository-token" name="repository-token" type="password" autocomplete="off" placeholder="${t('dialogs.connect.tokenPlaceholder')}" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.tokenHint')}</small>`

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar('reviews', activeReviewsCount)}
      <main class="content bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
        <header class="topbar"><div><span class="eyebrow">${t('reviews.eyebrow')}</span><h1>${t('reviews.title')}</h1></div><div class="flex items-center gap-2">${renderLangToggle('lang-toggle')}<button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button></div></header>
        <section class="intro bg-brand-secondary-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="intro__lead"><span class="intro__emblem" aria-hidden="true">${renderBrandLogoSvg(46, 'hero')}</span><div><h2>${t('reviews.heroTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.heroSubtitle')}</p></div></div><button class="primary-action" id="new-review" type="button" ${isAnyReviewProcessing ? `disabled title="${t('reviews.reviewInProgressTooltip')}"` : ''}><span>+</span> ${t('reviews.newReview')}</button></section>
        <section class="stats" aria-label="${t('reviews.title')}"><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.inProgress')}</span><strong>${reviewKpis.activeReviews}</strong><span class="stat__detail stat__detail--positive">${t('reviews.stats.activeReviews')}</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.pendingSlm')}</span><strong>${reviewKpis.pendingSlmComments}</strong><span class="stat__detail text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.proposalsToReview')}</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.publishedComments')}</span><strong>${reviewKpis.publishedComments}</strong><span class="stat__detail stat__detail--positive">${t('reviews.stats.total')}</span></div></section>
        <div class="section-heading"><div><h2>${filter === ReviewFilter.CLOSED ? t('reviews.heading.closedTitle') : t('reviews.heading.activeTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.heading.registeredCount', { count: visibleReviews.length })}</p></div><div class="tabs" role="tablist"><button class="tab ${filter === ReviewFilter.ACTIVE ? 'tab--active' : ''}" data-filter="${ReviewFilter.ACTIVE}" type="button">${t('reviews.tabs.active')}</button><button class="tab ${filter === ReviewFilter.CLOSED ? 'tab--active' : ''}" data-filter="${ReviewFilter.CLOSED}" type="button">${t('reviews.tabs.closed')}</button></div></div>
        <section class="review-list">${visibleReviews.length ? visibleReviews.map(reviewCard).join('') : `<div class="empty-state border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><strong>${filter === ReviewFilter.CLOSED ? t('reviews.empty.closedTitle') : t('reviews.empty.activeTitle')}</strong><span>${filter === ReviewFilter.CLOSED ? t('reviews.empty.closedText') : t('reviews.empty.activeText')}</span></div>`}</section>
        <footer class="content-footer text-brand-muted-light dark:!text-brand-muted-dark"><span><span class="live-dot"></span> ${t('reviews.footer.slmReady')}</span><span>${t('reviews.footer.localDataNotice')}</span></footer>
      </main>
    </div>
    <dialog id="new-review-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="new-review-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel" aria-label="${t('common.close')}">×</button><span class="eyebrow">${t('dialogs.connect.eyebrow')}</span><h2>${t('dialogs.connect.title')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.description')}</p><label for="review-url">${t('dialogs.connect.urlLabel')}</label><input id="review-url" name="review-url" type="url" placeholder="${t('dialogs.connect.urlPlaceholder')}" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><div id="url-adapter-preview" class="url-adapter-preview hidden text-xs mt-1.5 p-2 rounded border bg-[#f3f6f4] dark:!bg-[#182521] border-brand-line-light dark:!border-brand-line-dark"></div>${accessTokenField}<small id="remote-request-status" class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.statusDefault')}</small><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel">${t('common.cancel')}</button><button class="primary-action" id="connect-review" type="submit" value="default">${t('dialogs.connect.continueBtn')}</button></div></form></dialog>
  `

  const reviewUrlInput = document.querySelector<HTMLInputElement>('#review-url')
  const urlAdapterPreview = document.querySelector<HTMLDivElement>('#url-adapter-preview')

  const updateUrlPreview = () => {
    if (!reviewUrlInput || !urlAdapterPreview) return
    const value = reviewUrlInput.value.trim()
    if (!value) {
      urlAdapterPreview.classList.add('hidden')
      urlAdapterPreview.innerHTML = ''
      return
    }
    const detected = detectPlatform(value)
    if (detected) {
      const { info } = detected
      urlAdapterPreview.classList.remove('hidden')
      urlAdapterPreview.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 font-medium">
            <span class="provider provider--${info.provider.toLowerCase()}">${info.provider}</span>
            <span class="text-brand-primary-light dark:!text-brand-primary-dark font-semibold">${info.repositoryPath} #${info.changeNumber}</span>
          </span>
          <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">${t('dialogs.connect.adapterAdapted')}</span>
        </div>
        <div class="mt-1 text-[11px] text-brand-muted-light dark:!text-brand-muted-dark truncate" title="${info.endpoints.changeUrl}">
          <span class="opacity-75">${t('dialogs.connect.adapterEndpoint')}</span> <code class="font-mono text-[10px] text-[#30433a] dark:!text-[#9cb3a8]">${info.endpoints.changeUrl}</code>
        </div>
      `
    } else if (value.startsWith('http://') || value.startsWith('https://')) {
      urlAdapterPreview.classList.remove('hidden')
      urlAdapterPreview.innerHTML = `
        <div class="text-[11px] text-amber-600 dark:text-amber-400">
          ${t('dialogs.connect.adapterInvalidUrl')}
        </div>
      `
    } else {
      urlAdapterPreview.classList.add('hidden')
      urlAdapterPreview.innerHTML = ''
    }
  }

  reviewUrlInput?.addEventListener('input', updateUrlPreview)
  reviewUrlInput?.addEventListener('change', updateUrlPreview)

  document.querySelector('#new-review')?.addEventListener('click', () => {
    if (reviews.some(isReviewProcessing)) return
    updateUrlPreview()
    const connectButton = document.querySelector<HTMLButtonElement>('#connect-review')
    if (connectButton) {
      connectButton.disabled = false
      connectButton.textContent = t('dialogs.connect.continueBtn')
    }
    const requestStatus = document.querySelector<HTMLElement>('#remote-request-status')
    if (requestStatus) {
      requestStatus.textContent = t('dialogs.connect.statusDefault')
      requestStatus.className = 'token-hint text-brand-muted-light dark:!text-brand-muted-dark'
    }
    document.querySelector<HTMLDialogElement>('#new-review-dialog')?.showModal()
  })

  document.querySelector('#reviews-nav')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#history-nav')?.addEventListener('click', () => navigate('#/history'))
  document.querySelector('#settings-nav')?.addEventListener('click', () => navigate('#/settings'))
  document.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#lang-toggle')?.addEventListener('click', () => toggleLanguage())

  const reviewDialog = document.querySelector<HTMLDialogElement>('#new-review-dialog')
  reviewDialog?.querySelectorAll<HTMLButtonElement>('.dialog-close, .secondary-action').forEach((button) => {
    button.addEventListener('click', () => {
      reviewDialog.close()
    })
  })

  document.querySelector<HTMLFormElement>('#new-review-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === 'cancel') {
      reviewDialog?.close()
      return
    }
    if (reviews.some(isReviewProcessing)) {
      window.alert(t('reviews.reviewInProgressTooltip'))
      return
    }
    const form = event.currentTarget as HTMLFormElement
    const url = new FormData(form).get('review-url')
    if (typeof url !== 'string' || !url) return
    const accessToken = new FormData(form).get('repository-token')
    if (!hasRepositoryAccessToken()) {
      if (typeof accessToken !== 'string' || !accessToken.trim()) return
    }
    const requestStatus = document.querySelector('#remote-request-status')!
    const connectButton = document.querySelector<HTMLButtonElement>('#connect-review')!
    const originalButtonText = connectButton.innerHTML
    try {
      const location = parseReviewUrl(url)
      trace('review.create.platform-ready', {
        provider: location.provider,
        baseUrl: location.baseUrl,
        repositoryPath: location.repositoryPath,
        changeNumber: location.changeNumber,
      })
      if (!hasRepositoryAccessToken() && typeof accessToken === 'string') setRepositoryAccessToken(accessToken)
      requestStatus.textContent = t('dialogs.connect.statusConnecting', { provider: location.provider })
      connectButton.disabled = true
      connectButton.innerHTML = `<span class="thinking-pulse"></span> ${t('common.loading')}`
      const [change, files, comments] = await Promise.all([
        getRemoteChange(location),
        listRemoteFiles(location),
        listRemoteComments(location),
      ])
      const reviewId = await createReview(url, { change, files, comments })
      emitReviewProgress(reviewId)
      emitReviewThinking({
        reviewId,
        phase: 'thinking',
        thought: t('reviews.card.analyzingCode'),
      })
      const refreshed = await refreshReviews()
      connectButton.disabled = false
      connectButton.innerHTML = originalButtonText
      document.querySelector<HTMLDialogElement>('#new-review-dialog')?.close()
      renderDashboard(app, {
        ...options,
        reviews: refreshed?.reviews ?? options.reviews,
        reviewKpis: refreshed?.reviewKpis ?? options.reviewKpis,
      })
      void import('../review-runtime')
        .then(({ startReviewWorkflow }) => startReviewWorkflow(reviewId))
        .catch((error: unknown) => console.error('No se pudo iniciar el flujo LangGraph.', error))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dialogs.connect.errorConnecting')
      trace('review.create.error', { message })
      requestStatus.textContent = message
      requestStatus.className = 'token-hint settings-status--error'
      connectButton.disabled = false
      connectButton.innerHTML = originalButtonText
      window.alert(message)
      return
    }
  })

  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) =>
    button.addEventListener('click', () => navigate(`#/reviews?filter=${button.dataset.filter}`))
  )

  document.querySelectorAll<HTMLButtonElement>('[data-review-id]').forEach((button) =>
    button.addEventListener('click', () => {
      const review = reviews.find((item) => item.id === Number(button.dataset.reviewId))
      if (!review) return
      navigate(`#/reviews/${review.id}`)
    })
  )

  document.querySelectorAll<HTMLElement>('.review-card__thinking').forEach((thinkingContainer) => {
    thinkingContainer.addEventListener('click', (event) => event.stopPropagation())
    thinkingContainer.addEventListener('pointerdown', (event) => event.stopPropagation())
    const snippet = thinkingContainer.querySelector<HTMLElement>('.thinking-snippet')
    if (snippet) snippet.scrollTop = snippet.scrollHeight
  })
}
