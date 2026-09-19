import { getSlmConfig } from '../slm-config'
import { getLanguage, t, tStatus, toggleLanguage } from '../i18n'
import type { Review } from '../review-db'
import {
  formatDateTime,
  formatProcessingTime,
  isClosedReview,
  renderLangToggle,
  renderSidebar,
  statusClass,
  toggleTheme,
} from './shared'

export interface HistoryOptions {
  reviews: Review[]
  navigate: (hash: string) => void
}

export function renderHistory(app: HTMLElement, options: HistoryOptions) {
  const { reviews, navigate } = options
  const slmConfig = getSlmConfig()
  const sortedReviews = [...reviews].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )
  const activeReviewsCount = reviews.filter((review) => !isClosedReview(review)).length

  // 1. Distribution calculation
  const githubReviews = reviews.filter((r) => r.provider?.toLowerCase() === 'github')
  const gitlabReviews = reviews.filter((r) => r.provider?.toLowerCase() === 'gitlab')
  const totalReviews = reviews.length
  const githubCount = githubReviews.length
  const gitlabCount = gitlabReviews.length
  const githubPct = totalReviews > 0 ? Math.round((githubCount / totalReviews) * 100) : 0
  const gitlabPct = totalReviews > 0 ? 100 - githubPct : 0

  const radius = 38
  const circumference = 2 * Math.PI * radius
  const githubStrokeDash = (githubPct / 100) * circumference
  const gitlabStrokeDash = (gitlabPct / 100) * circumference

  // 2. Activity Heatmap calculation
  const today = new Date()
  const weeksCount = 20
  const dayMs = 24 * 60 * 60 * 1000

  const countByDate = new Map<string, number>()
  for (const r of reviews) {
    if (r.createdAt) {
      const d = new Date(r.createdAt)
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const key = `${y}-${m}-${day}`
        countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
      }
    }
  }

  const todayDayOfWeek = today.getDay()
  const daysUntilEndOfWeek = 6 - todayDayOfWeek
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilEndOfWeek)
  const totalDays = weeksCount * 7
  const startDate = new Date(endDate.getTime() - (totalDays - 1) * dayMs)

  const cellSize = 11
  const cellGap = 3
  const step = cellSize + cellGap
  const leftPadding = 30
  const topPadding = 20
  const svgWidth = leftPadding + weeksCount * step
  const svgHeight = topPadding + 7 * step + 5

  const monthNamesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthNames = getLanguage() === 'es' ? monthNamesEs : monthNamesEn

  const dayLabelsEs = ['', 'Lun', '', 'Mié', '', 'Vie', '']
  const dayLabelsEn = ['', 'Mon', '', 'Wed', '', 'Fri', '']
  const dayLabels = getLanguage() === 'es' ? dayLabelsEs : dayLabelsEn

  let cur = new Date(startDate.getTime())
  let cellsSvg = ''
  let monthsSvg = ''
  let lastMonth = -1

  for (let w = 0; w < weeksCount; w++) {
    const x = leftPadding + w * step
    for (let d = 0; d < 7; d++) {
      const y = topPadding + d * step
      const curYear = cur.getFullYear()
      const curMonth = cur.getMonth()
      const curDateNum = cur.getDate()
      const dateKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(curDateNum).padStart(2, '0')}`

      if (d === 0 && curMonth !== lastMonth) {
        monthsSvg += `<text x="${x}" y="${topPadding - 6}" class="heatmap-text">${monthNames[curMonth]}</text>`
        lastMonth = curMonth
      }

      const isFuture = cur.getTime() > today.getTime()
      const count = isFuture ? 0 : (countByDate.get(dateKey) ?? 0)
      let level = 0
      if (!isFuture && count > 0) {
        if (count === 1) level = 1
        else if (count === 2) level = 2
        else if (count <= 4) level = 3
        else level = 4
      }

      const tooltip = count > 0
        ? t('history.reviewsOnDate', { count, date: dateKey })
        : t('history.noReviewsOnDate', { date: dateKey })

      cellsSvg += `<rect class="heatmap-cell heatmap-cell--level-${level} ${isFuture ? 'heatmap-cell--future' : ''}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2"><title>${tooltip}</title></rect>`

      cur = new Date(cur.getTime() + dayMs)
    }
  }

  let daysSvg = ''
  for (let d = 0; d < 7; d++) {
    if (dayLabels[d]) {
      const y = topPadding + d * step + cellSize - 2
      daysSvg += `<text x="${leftPadding - 6}" y="${y}" class="heatmap-text text-right" text-anchor="end">${dayLabels[d]}</text>`
    }
  }

  // 3. Table Rows
  const rowsHtml = sortedReviews.length ? sortedReviews.map((review) => {
    const model = review.model || slmConfig.model || 'llama3.2'
    const processedFiles = review.processedFilesCount ?? review.remoteFiles?.length ?? 0
    const suggestions = review.comments ?? 0
    const duration = formatProcessingTime(review.processingTimeMs)
    const createdAtStr = formatDateTime(review.createdAt)
    const statusText = tStatus(review.status)
    const stClass = statusClass(review.status)

    return `
      <tr class="history-row" data-history-review-id="${review.id}" title="${t('history.openReview')}">
        <td class="history-cell history-cell--title">
          <div class="history-title-wrapper">
            <strong class="history-review-title text-brand-primary-light dark:!text-brand-primary-dark">${review.title}</strong>
            <span class="history-repo text-brand-muted-light dark:!text-brand-muted-dark">${review.repository}${review.remoteChange?.number ? ` #${review.remoteChange.number}` : ''}</span>
          </div>
        </td>
        <td class="history-cell">
          <span class="provider provider--${review.provider.toLowerCase()} font-semibold">${review.provider}</span>
        </td>
        <td class="history-cell">
          <span class="status status--${stClass}"><span></span>${statusText}</span>
        </td>
        <td class="history-cell text-brand-muted-light dark:!text-brand-muted-dark font-mono text-xs">
          <time datetime="${review.createdAt}">${createdAtStr}</time>
        </td>
        <td class="history-cell">
          <span class="metric-pill">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="opacity-70"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073Z"/></svg>
            ${processedFiles}
          </span>
        </td>
        <td class="history-cell">
          <span class="comment-badge font-semibold">
            <svg class="comment-badge__icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.75.75 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
            ${suggestions}
          </span>
        </td>
        <td class="history-cell">
          <span class="duration-pill ${duration !== '—' ? 'duration-pill--active' : ''}">${duration}</span>
        </td>
        <td class="history-cell">
          <span class="model-badge">${model}</span>
        </td>
      </tr>
    `
  }).join('') : `
    <tr>
      <td colspan="8" class="empty-history-cell text-brand-muted-light dark:!text-brand-muted-dark">
        ${t('history.emptyReviews')}
      </td>
    </tr>
  `

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar('history', activeReviewsCount)}
      <main class="content bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
        <header class="topbar">
          <div>
            <span class="eyebrow">${t('history.eyebrow')}</span>
            <h1>${t('history.title')}</h1>
          </div>
          <div class="flex items-center gap-2">
            ${renderLangToggle('lang-toggle')}
            <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button>
          </div>
        </header>

        <div class="history-metrics-grid">
          <section class="history-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div class="history-card__header">
              <h2 class="history-card__title">${t('history.platformDistributionTitle')}</h2>
              <p class="history-card__subtitle">${t('history.platformDistributionSubtitle')}</p>
            </div>
            <div class="platform-distribution">
              <div class="donut-container">
                <svg class="donut-chart" width="110" height="110" viewBox="0 0 100 100">
                  <circle class="donut-ring" cx="50" cy="50" r="38" fill="none" stroke-width="11" />
                  ${totalReviews > 0 ? `
                    <circle class="donut-segment donut-segment--github" cx="50" cy="50" r="38" fill="none" stroke-width="11"
                      stroke-dasharray="${githubStrokeDash} ${circumference}"
                      stroke-dashoffset="0" />
                    <circle class="donut-segment donut-segment--gitlab" cx="50" cy="50" r="38" fill="none" stroke-width="11"
                      stroke-dasharray="${gitlabStrokeDash} ${circumference}"
                      stroke-dashoffset="-${githubStrokeDash}" />
                  ` : ''}
                </svg>
                <div class="donut-center">
                  <span class="donut-total">${totalReviews}</span>
                  <span class="donut-label">${t('history.reviewsCount')}</span>
                </div>
              </div>
              <div class="distribution-bars">
                <div class="distribution-item">
                  <div class="distribution-item__meta">
                    <span class="provider provider--github flex items-center gap-1.5 font-semibold">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                      ${t('history.github')}
                    </span>
                    <span class="distribution-item__count text-brand-muted-light dark:!text-brand-muted-dark"><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${githubCount}</strong> (${githubPct}%)</span>
                  </div>
                  <div class="distribution-track"><div class="distribution-fill distribution-fill--github" style="width: ${githubPct}%"></div></div>
                </div>
                <div class="distribution-item">
                  <div class="distribution-item__meta">
                    <span class="provider provider--gitlab flex items-center gap-1.5 font-semibold">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="m15.97 9.058-.888-2.735L13.565 1.74a.486.486 0 0 0-.928 0l-1.517 4.583H4.88L3.363 1.74a.486.486 0 0 0-.928 0L.918 6.323.03 9.058a.972.972 0 0 0 .354 1.09l7.616 5.534 7.616-5.534a.972.972 0 0 0 .354-1.09z"/></svg>
                      ${t('history.gitlab')}
                    </span>
                    <span class="distribution-item__count text-brand-muted-light dark:!text-brand-muted-dark"><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${gitlabCount}</strong> (${gitlabPct}%)</span>
                  </div>
                  <div class="distribution-track"><div class="distribution-fill distribution-fill--gitlab" style="width: ${gitlabPct}%"></div></div>
                </div>
              </div>
            </div>
          </section>

          <section class="history-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div class="history-card__header">
              <h2 class="history-card__title">${t('history.activityHeatmapTitle')}</h2>
              <p class="history-card__subtitle">${t('history.activityHeatmapSubtitle')}</p>
            </div>
            <div class="activity-heatmap">
              <div class="heatmap-container">
                <svg class="heatmap-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
                  ${monthsSvg}
                  ${daysSvg}
                  ${cellsSvg}
                </svg>
              </div>
              <div class="heatmap-legend">
                <span class="heatmap-legend-label">${t('history.legendLess')}</span>
                <span class="heatmap-legend-cell heatmap-cell--level-0"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-1"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-2"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-3"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-4"></span>
                <span class="heatmap-legend-label">${t('history.legendMore')}</span>
              </div>
            </div>
          </section>
        </div>

        <section class="history-table-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="history-table-header">
            <div>
              <h2 class="history-card__title">${t('history.tableTitle')}</h2>
              <p class="history-card__subtitle">${t('history.tableSubtitle')}</p>
            </div>
            <span class="nav-count text-xs">${reviews.length} ${t('history.reviewsCount')}</span>
          </div>
          <div class="history-table-wrapper">
            <table class="history-table">
              <thead>
                <tr>
                  <th>${t('history.colName')}</th>
                  <th>${t('history.colRepoType')}</th>
                  <th>${t('history.colStatus')}</th>
                  <th>${t('history.colCreatedAt')}</th>
                  <th>${t('history.colProcessedFiles')}</th>
                  <th>${t('history.colSuggestions')}</th>
                  <th>${t('history.colDuration')}</th>
                  <th>${t('history.colModel')}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </section>

        <footer class="content-footer text-brand-muted-light dark:!text-brand-muted-dark">
          <span><span class="live-dot"></span> ${t('reviews.footer.slmReady')}</span>
          <span>${t('reviews.footer.localDataNotice')}</span>
        </footer>
      </main>
    </div>
  `

  document.querySelector('#reviews-nav')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#history-nav')?.addEventListener('click', () => navigate('#/history'))
  document.querySelector('#settings-nav')?.addEventListener('click', () => navigate('#/settings'))
  document.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#lang-toggle')?.addEventListener('click', () => toggleLanguage())
  document.querySelectorAll<HTMLTableRowElement>('.history-row[data-history-review-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const reviewId = Number(row.dataset.historyReviewId)
      if (reviewId) navigate(`#/reviews/${reviewId}`)
    })
  })
}
