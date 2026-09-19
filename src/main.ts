import './style.css'
import { getReviewKpis, listReviews, type Review } from './review-db'
import { onReviewProgress, onReviewThinking } from './review-events'
import { onLanguageChange, t, tStatus } from './i18n'
import { AppScreen, ReviewFilter } from './enums'
import { isReviewProcessing, statusClass } from './screens/shared'

let reviews: Review[] = []
let reviewKpis = { activeReviews: 0, pendingSlmComments: 0, publishedComments: 0 }
let selectedReviewId: number | undefined
let currentScreen: AppScreen = AppScreen.REVIEWS
let currentFilter: ReviewFilter = ReviewFilter.ACTIVE
let currentWorkspaceFileIndex = 0

async function refreshReviews() {
  reviews = await listReviews()
  reviewKpis = await getReviewKpis()
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = hash.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const params = new URLSearchParams(queryPart)

  if (segments[0] === AppScreen.SETTINGS) return { screen: AppScreen.SETTINGS }
  if (segments[0] === AppScreen.HISTORY) return { screen: AppScreen.HISTORY }
  if (segments[0] === AppScreen.REVIEWS && segments[1]) {
    const reviewId = Number(segments[1])
    if (!Number.isNaN(reviewId)) return { screen: AppScreen.REVIEWS, reviewId }
  }
  return {
    screen: AppScreen.REVIEWS,
    filter: params.get('filter') === ReviewFilter.CLOSED ? ReviewFilter.CLOSED : ReviewFilter.ACTIVE,
  }
}

function navigate(hash: string) {
  if (window.location.hash === hash) {
    void applyRoute()
    return
  }
  window.location.hash = hash
}

const app = document.querySelector<HTMLDivElement>('#app')!
const savedTheme = localStorage.getItem('codereview-theme')
if (savedTheme === 'dark') document.documentElement.classList.add('dark')

async function applyRoute() {
  const route = parseRoute()
  currentScreen = route.screen
  selectedReviewId = route.screen === AppScreen.REVIEWS ? route.reviewId : undefined
  currentFilter = route.screen === AppScreen.REVIEWS ? route.filter ?? currentFilter : currentFilter

  if (currentScreen === AppScreen.SETTINGS) {
    const { renderSettings } = await import('./screens/settings')
    renderSettings(app, { navigate })
    return
  }

  if (currentScreen === AppScreen.HISTORY) {
    const { renderHistory } = await import('./screens/history')
    renderHistory(app, { reviews, navigate })
    return
  }

  const selectedReview = reviews.find((review) => review.id === selectedReviewId)
  if (selectedReview) {
    const { renderReviewWorkspace } = await import('./screens/workspace')
    void renderReviewWorkspace(app, {
      review: selectedReview,
      activeFileIndex: currentWorkspaceFileIndex,
      navigate,
      refreshReviews,
      onFileSelect: (index) => {
        currentWorkspaceFileIndex = index
      },
    })
    return
  }

  currentWorkspaceFileIndex = 0
  const { renderDashboard } = await import('./screens/dashboard')
  renderDashboard(app, {
    reviews,
    reviewKpis,
    filter: currentFilter,
    navigate,
    refreshReviews,
  })
}

async function start() {
  void import('./pwa-update').then(({ initPwaUpdate }) => initPwaUpdate())

  await refreshReviews()
  window.addEventListener('hashchange', () => void applyRoute())

  onReviewProgress(async () => {
    await refreshReviews()
    if (currentScreen === AppScreen.REVIEWS && !selectedReviewId) {
      const { renderDashboard } = await import('./screens/dashboard')
      renderDashboard(app, {
        reviews,
        reviewKpis,
        filter: currentFilter,
        navigate,
        refreshReviews,
      })
    } else if (currentScreen === AppScreen.HISTORY) {
      const { renderHistory } = await import('./screens/history')
      renderHistory(app, { reviews, navigate })
    }
  })

  onReviewThinking((thinking) => {
    const newReviewButton = document.querySelector<HTMLButtonElement>('#new-review')
    if (newReviewButton) {
      const isProcessing = thinking.phase !== 'completed' || reviews.some(isReviewProcessing)
      newReviewButton.disabled = isProcessing
      if (isProcessing) {
        newReviewButton.title = t('reviews.reviewInProgressTooltip')
      } else {
        newReviewButton.removeAttribute('title')
      }
    }

    const card = document.querySelector<HTMLElement>(`.review-card[data-review-id="${thinking.reviewId}"]`)
    if (card) {
      if (thinking.phase === 'completed') {
        card.querySelector('.review-card__thinking')?.remove()
        const review = reviews.find((r) => r.id === thinking.reviewId)
        if (review) {
          const statusElem = card.querySelector('.status')
          if (statusElem) {
            statusElem.className = `status status--${statusClass(review.status)}`
            statusElem.innerHTML = `<span></span>${tStatus(review.status)}`
          }
        }
      } else {
        const fileInfo = thinking.filePath
          ? `${thinking.filePath}${thinking.fileIndex && thinking.totalFiles ? ` (${thinking.fileIndex}/${thinking.totalFiles})` : ''}`
          : ''
        const thoughtText = thinking.thought ? thinking.thought : t('reviews.card.analyzingCode')
        const labelText =
          thinking.phase === 'suggesting'
            ? t('reviews.card.generatingProposals')
            : t('reviews.card.slmThinking')

        let thinkingContainer = card.querySelector<HTMLElement>('.review-card__thinking')
        if (!thinkingContainer) {
          const progressElem = card.querySelector('.progress')
          if (progressElem) {
            progressElem.insertAdjacentHTML(
              'beforebegin',
              `
              <div class="review-card__thinking" data-thinking-for="${thinking.reviewId}">
                <div class="thinking-badge">
                  <span class="thinking-pulse" aria-hidden="true"></span>
                  <span class="thinking-label">${labelText}</span>
                  <span class="thinking-file" title="${fileInfo}">${fileInfo}</span>
                </div>
                <div class="thinking-snippet" title="${thoughtText.replaceAll('"', '&quot;')}">${thoughtText.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</div>
              </div>
            `
            )
            thinkingContainer = card.querySelector<HTMLElement>('.review-card__thinking')
            thinkingContainer?.addEventListener('click', (event) => event.stopPropagation())
            thinkingContainer?.addEventListener('pointerdown', (event) => event.stopPropagation())
            const snippetElem = thinkingContainer?.querySelector<HTMLElement>('.thinking-snippet')
            if (snippetElem) snippetElem.scrollTop = snippetElem.scrollHeight
          }
        } else {
          const labelElem = thinkingContainer.querySelector('.thinking-label')
          const fileElem = thinkingContainer.querySelector('.thinking-file')
          const snippetElem = thinkingContainer.querySelector<HTMLElement>('.thinking-snippet')
          if (labelElem) labelElem.textContent = labelText
          if (fileElem) {
            fileElem.textContent = fileInfo
            fileElem.setAttribute('title', fileInfo)
          }
          if (snippetElem) {
            snippetElem.textContent = thoughtText
            snippetElem.setAttribute('title', thoughtText)
            snippetElem.scrollTop = snippetElem.scrollHeight
          }
        }

        const statusElem = card.querySelector('.status')
        if (statusElem) {
          statusElem.className = 'status status--thinking'
          statusElem.innerHTML = `<span class="thinking-pulse"></span>${labelText}`
        }
      }
    }

    if (selectedReviewId === thinking.reviewId) {
      const workspaceStatusElem = document.querySelector('.workspace-actions .status')
      if (workspaceStatusElem) {
        if (thinking.phase === 'completed') {
          const review = reviews.find((r) => r.id === thinking.reviewId)
          if (review) {
            workspaceStatusElem.className = `status status--${statusClass(review.status)}`
            workspaceStatusElem.innerHTML = `<span></span>${tStatus(review.status)}`
            void import('./screens/workspace').then(({ renderReviewWorkspace }) => {
              void renderReviewWorkspace(app, {
                review,
                activeFileIndex: currentWorkspaceFileIndex,
                navigate,
                refreshReviews,
                onFileSelect: (index) => {
                  currentWorkspaceFileIndex = index
                },
              })
            })
          }
        } else {
          const labelText =
            thinking.phase === 'suggesting'
              ? t('reviews.card.generatingProposals')
              : t('reviews.card.slmThinking')
          workspaceStatusElem.className = 'status status--thinking'
          workspaceStatusElem.innerHTML = `<span class="thinking-pulse"></span>${labelText}`
        }
      }
    }
  })

  onLanguageChange(() => {
    void applyRoute()
  })

  void applyRoute()
}

void start()
