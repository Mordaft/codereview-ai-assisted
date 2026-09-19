import './style.css'
import { hasRepositoryAccessToken, setRepositoryAccessToken } from './browser-session'
import { trace } from './diagnostics'
import { getRemoteChange, listRemoteComments, listRemoteFiles, publishRemoteComment } from './platform-api'
import { detectPlatform, parseReviewUrl } from './platform-url'
import { addManualReviewComment, createReview, deleteReviewComment, getReviewKpis, listReviewComments, listReviews, markReviewCommentPublished, updateReviewComment, updateReviewStatus, type Review, type ReviewStatus } from './review-db'
import { getReviewThinking, onReviewProgress, onReviewThinking } from './review-events'
import { getSlmConfig, saveSlmConfig, testSlmConnection, type SlmConfig } from './slm-config'
import { getReviewPromptConfig, reviewOutputContract, saveReviewPromptConfig } from './review-prompts'
import {
  formatRelativeTime,
  getLanguage,
  onLanguageChange,
  t,
  tAuthor,
  tCategory,
  tDecision,
  tSeverity,
  tStatus,
  toggleLanguage,
} from './i18n'
import {
  AppScreen,
  CommentCategory,
  CommentLifecycle,
  CommentSeverity,
  CommentSource,
  ProposalDecision,
  ReviewAction,
  ReviewFilter,
  ReviewStatus as ReviewStatusConst,
} from './enums'

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

const isClosedReview = (review: Review) =>
  review.status === ReviewStatusConst.CLOSED ||
  review.status === ReviewStatusConst.APPROVED ||
  (review.status as unknown) === 'Cerrada' ||
  (review.status as unknown) === 'Aprobada'

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
  return { screen: AppScreen.REVIEWS, filter: params.get('filter') === ReviewFilter.CLOSED ? ReviewFilter.CLOSED : ReviewFilter.ACTIVE }
}

function navigate(hash: string) {
  if (window.location.hash === hash) { applyRoute(); return }
  window.location.hash = hash
}

function applyRoute() {
  const route = parseRoute()
  currentScreen = route.screen
  selectedReviewId = route.screen === 'reviews' ? route.reviewId : undefined
  currentFilter = route.screen === 'reviews' ? route.filter ?? currentFilter : currentFilter
  currentWorkspaceFileIndex = 0
  render(currentFilter)
}

const app = document.querySelector<HTMLDivElement>('#app')!
const savedTheme = localStorage.getItem('codereview-theme')
if (savedTheme === 'dark') document.documentElement.classList.add('dark')

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', !isDark)
  localStorage.setItem('codereview-theme', isDark ? 'light' : 'dark')
}

function renderLangToggle(id: string) {
  const currentLang = getLanguage()
  const targetLang = currentLang === 'es' ? 'en' : 'es'
  const toggleLabel = `${t('common.toggleLang')}: ${targetLang.toUpperCase()}`
  return `<button class="lang-toggle bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark font-bold text-xs" id="${id}" type="button" aria-label="${toggleLabel}" title="${toggleLabel}">${currentLang.toUpperCase()}</button>`
}

function statusClass(status: ReviewStatus | number | string) {
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

function severityClass(severity?: CommentSeverity | number | string) {
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

function renderBrandLogoSvg(size = 32, idPrefix = 'brand') {
  return `<svg class="brand-logo" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${idPrefix}NeuralGrad" x1="8" y1="36" x2="40" y2="10" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#87b743"/><stop offset="60%" stop-color="#c4f36b"/><stop offset="100%" stop-color="#e3ff99"/></linearGradient><filter id="${idPrefix}NeonGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter></defs><rect width="48" height="48" rx="12" fill="#17211f"/><path d="M8 26H16" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="26" r="2.6" fill="#17211f" stroke="#c4f36b" stroke-width="2"/><path d="M16 26C18 18 21 17 25 17H28" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.3" stroke-linecap="round"/><circle cx="28" cy="17" r="2.3" fill="#17211f" stroke="#c4f36b" stroke-width="1.8"/><path d="M16 26C18 34 21 35 25 35H28" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="2.3" stroke-linecap="round"/><circle cx="28" cy="35" r="2.3" fill="#17211f" stroke="#c4f36b" stroke-width="1.8"/><path d="M22 26L26.5 31C27.4 32 28.8 31.4 29.5 30.3L37.5 15" stroke="url(#${idPrefix}NeuralGrad)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${idPrefix}NeonGlow)"/><path d="M38.5 7.5C38.5 9.8 37 11.2 34.8 11.2C37 11.2 38.5 12.6 38.5 14.9C38.5 12.6 40 11.2 42.2 11.2C40 11.2 38.5 9.8 38.5 7.5Z" fill="#c4f36b" filter="url(#${idPrefix}NeonGlow)"/></svg>`
}

function normalizeDecision(decision?: unknown): ProposalDecision {
  if (decision === undefined || decision === null) return ProposalDecision.PENDING
  if (typeof decision === 'number') {
    if (
      decision === ProposalDecision.DESIRABLE ||
      decision === ProposalDecision.IMPORTANT ||
      decision === ProposalDecision.BLOCKING ||
      decision === ProposalDecision.PENDING
    ) {
      return decision
    }
  }
  if (typeof decision === 'string') {
    switch (decision.toLowerCase().trim()) {
      case '1':
      case 'deseable':
      case 'desirable':
        return ProposalDecision.DESIRABLE
      case '2':
      case 'importante':
      case 'important':
        return ProposalDecision.IMPORTANT
      case '3':
      case 'bloqueante':
      case 'blocking':
        return ProposalDecision.BLOCKING
      case '0':
      case 'pendiente':
      case 'pending':
      case 'edited':
      default:
        return ProposalDecision.PENDING
    }
  }
  return ProposalDecision.PENDING
}

async function publishPendingComments(review: Review) {
  if (!review.id || !review.remoteChange?.webUrl) return
  const comments = await listReviewComments(review.id)
  const pendingComments = comments.filter((comment) => comment.decision !== CommentLifecycle.PUBLISHED)
  if (!pendingComments.length) return
  const location = parseReviewUrl(review.remoteChange.webUrl)
  for (const comment of pendingComments) {
    const context = comment.path ? `${comment.path}${comment.line ? ':' + comment.line : ''}` : t('workspace.generalComment')
    const body = `**[${tSeverity(comment.severity ?? CommentSeverity.MEDIUM)}]** ${context}\n\n${comment.body}`
    await publishRemoteComment(location, { body })
    if (comment.id) await markReviewCommentPublished(comment.id)
  }
}

function reviewCard(review: Review) {
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
      <h3>${review.title}</h3><p class="repository">${review.repository}</p>
      ${thinkingBlock}
      <div class="progress" aria-label="${t('reviews.card.progressAria', { progress: review.progress })}"><span style="width: ${review.progress}%"></span></div>
      <div class="review-card__meta"><span>${t('reviews.card.commentsCount', { count: review.comments })}</span><span>${timeLabel}</span></div>
    </button>
  `
}

async function renderReviewWorkspace(review: Review, activeFileIndex = 0) {
  currentWorkspaceFileIndex = activeFileIndex
  const isReviewLocked = review.status === ReviewStatusConst.APPROVED || review.status === ReviewStatusConst.CLOSED || (review.status as unknown) === 'Aprobada' || (review.status as unknown) === 'Cerrada'
  const storedComments = review.id ? await listReviewComments(review.id) : []
  const workspaceFiles = review.remoteFiles?.length ? review.remoteFiles.map((file) => ({ path: file.path, type: file.path.split('.').at(-1)?.toUpperCase() ?? 'TXT', lines: (file.content ?? file.patch ?? t('workspace.noFilesDownloadedText')).split('\n') })) : [{ path: t('workspace.noFilesDownloaded'), type: 'TXT', lines: [t('workspace.noFilesDownloadedText')] }]
  const workspaceComments = storedComments.length ? storedComments.map((comment) => ({
    id: comment.id,
    file: comment.path,
    line: comment.line,
    severity: comment.severity ?? CommentSeverity.MEDIUM,
    message: comment.body,
    author: tAuthor(comment.author, comment.source),
    category: comment.category ?? CommentCategory.SOLID,
    decision: normalizeDecision(comment.decision),
    source: comment.source,
  })) : review.remoteComments?.length ? review.remoteComments.map((comment) => ({
    id: undefined as number | undefined,
    file: comment.path,
    line: comment.line,
    severity: CommentSeverity.MEDIUM,
    message: comment.body,
    author: tAuthor(comment.author, CommentSource.REMOTE),
    category: CommentCategory.SOLID,
    decision: ProposalDecision.PENDING,
    source: CommentSource.REMOTE,
  })) : []
  const activeFile = workspaceFiles[activeFileIndex] ?? workspaceFiles[0]
  const activeFileComments = workspaceComments.filter((comment) => !comment.file || comment.file === activeFile.path)
  const fileCommentsMap = new Map<string, typeof workspaceComments>()
  for (const comment of workspaceComments) {
    if (!comment.file) continue
    const list = fileCommentsMap.get(comment.file) ?? []
    list.push(comment)
    fileCommentsMap.set(comment.file, list)
  }
  const thinking = review.id ? getReviewThinking(review.id) : undefined
  const isThinking = Boolean(thinking && thinking.phase !== 'completed')
  const statusDisplay = isThinking
    ? `<span class="status status--thinking"><span class="thinking-pulse"></span>${thinking?.phase === 'suggesting' ? t('reviews.card.generatingProposals') : t('reviews.card.slmThinking')}</span>`
    : `<span class="status status--${statusClass(review.status)}"><span></span>${tStatus(review.status)}</span>`

  app.innerHTML = `<div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark"><header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${t('common.backToReviews')}</button><div class="workspace-title"><span class="provider provider--${review.provider.toLowerCase()}">${review.provider}</span><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${review.title}</strong><span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${review.repository}</span></div><div class="workspace-actions">${statusDisplay}${isReviewLocked ? `<button class="primary-action" data-decision="${ReviewAction.REOPEN}" type="button">${t('common.reopen')}</button>` : `<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${ReviewAction.CLOSE}" type="button">${t('common.close')}</button><button class="primary-action" data-decision="${ReviewAction.APPROVE}" type="button">${t('workspace.approveLocally')}</button>`}${renderLangToggle('workspace-lang-toggle')}<button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button></div></header><div class="workspace-grid"><aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.modifiedFiles')} <span class="panel-counter">${workspaceFiles.length}</span></div><div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${review.repository}</div>${workspaceFiles.map((file, index) => {
    const fileComments = fileCommentsMap.get(file.path) ?? []
    const commentCount = fileComments.length
    const hasHighSeverity = fileComments.some((comment) => comment.severity === CommentSeverity.HIGH || (comment.severity as unknown) === 'alta')
    const badgeClass = hasHighSeverity ? 'comment-badge comment-badge--alta' : 'comment-badge'
    const badgeLabel = t('workspace.reviewProposalBadge', {
      count: commentCount,
      label: commentCount === 1 ? t('workspace.proposalWordSingular') : t('workspace.proposalWordPlural'),
    })
    return `<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${index === activeFileIndex ? 'file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark' : 'hover:dark:!bg-[#263730]'}" data-file-index="${index}" type="button"><span class="file-type">${file.type}</span><span class="file-name" title="${file.path}">${file.path}</span>${commentCount > 0 ? `<span class="${badgeClass}" title="${badgeLabel}" aria-label="${badgeLabel}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${commentCount}</span></span>` : ''}</button>`
  }).join('')}<div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${t('workspace.commentsCount', { count: workspaceComments.length })}</div></aside><main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark"><div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div><strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFile.path}</strong><span class="text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.diffView', { lines: activeFile.lines.length })}</span></div><div class="code-toolbar__actions"><button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">${t('workspace.newProposal')}</button></div></div><div class="code-frame">${activeFile.lines.map((line, index) => { const lineNumber = index + 1; const comments = activeFileComments.filter((comment) => comment.line === lineNumber); return `<div class="code-line ${comments.length ? 'code-line--commented dark:!bg-[#352f19]' : ''}" data-line="${lineNumber}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${lineNumber}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</code>${comments.length ? `<span class="line-marker" title="${t('workspace.lineCommentsMarker', { count: comments.length })}">●</span>` : ''}</div>` }).join('')}</div></main><aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.commentsPanelTitle')}</span><h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFileComments.length === 1 ? t('workspace.singleProposalCount') : t('workspace.proposalsCount', { count: activeFileComments.length })}</h2><small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${activeFile.path}</small></div></div>${activeFileComments.length ? activeFileComments.map((comment) => `<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${comment.id ?? ''}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${severityClass(comment.severity)}">${tSeverity(comment.severity)}</span><span>${comment.file ? `${comment.file}${comment.line ? ':' + comment.line : ''}` : t('workspace.globalProposal')}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${comment.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${comment.author} · ${tCategory(comment.category)} · ${tDecision(comment.decision)}</small>${comment.id && !isReviewLocked ? `<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${t('common.edit')}</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${t('common.delete')}</button></div>` : ''}</article>`).join('') : `<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">${t('workspace.emptyComments')}</div>`}</aside></div></div>
    <dialog id="new-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="new-proposal-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${t('common.close')}">×</button><span class="eyebrow">${t('dialogs.proposal.eyebrow')}</span><h2 id="new-proposal-title">${t('dialogs.proposal.addTitle')}</h2><p id="new-proposal-hint" class="text-brand-muted-light dark:!text-brand-muted-dark"></p><label for="proposal-message">${t('dialogs.proposal.descLabel')}</label><textarea id="proposal-message" name="proposal-message" rows="3" required placeholder="${t('dialogs.proposal.descPlaceholder')}" class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"></textarea><div class="proposal-form-grid"><div class="proposal-field"><label for="proposal-author">${t('dialogs.proposal.authorLabel')}</label><input id="proposal-author" name="proposal-author" type="text" readonly class="proposal-input proposal-input--readonly bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark"></div><div class="proposal-field"><label for="proposal-category">${t('dialogs.proposal.categoryLabel')}</label><select id="proposal-category" name="proposal-category" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><option value="${CommentCategory.SOLID}">${tCategory(CommentCategory.SOLID)}</option><option value="${CommentCategory.SECURITY}">${tCategory(CommentCategory.SECURITY)}</option><option value="${CommentCategory.QUALITY}">${tCategory(CommentCategory.QUALITY)}</option></select></div></div><div class="proposal-form-grid"><div class="proposal-field"><label for="proposal-decision">${t('dialogs.proposal.decisionLabel')}</label><select id="proposal-decision" name="proposal-decision" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><option value="${ProposalDecision.PENDING}">${tDecision(ProposalDecision.PENDING)}</option><option value="${ProposalDecision.DESIRABLE}">${tDecision(ProposalDecision.DESIRABLE)}</option><option value="${ProposalDecision.IMPORTANT}">${tDecision(ProposalDecision.IMPORTANT)}</option><option value="${ProposalDecision.BLOCKING}">${tDecision(ProposalDecision.BLOCKING)}</option></select></div><div class="proposal-field"><span class="field-label">${t('dialogs.proposal.severityLabel')}</span><div class="severity-picker" id="proposal-severity-picker"><label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="${CommentSeverity.LOW}"><span>${tSeverity(CommentSeverity.LOW)}</span></label><label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="${CommentSeverity.MEDIUM}" checked><span>${tSeverity(CommentSeverity.MEDIUM)}</span></label><label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="${CommentSeverity.HIGH}"><span>${tSeverity(CommentSeverity.HIGH)}</span></label></div></div></div><label class="proposal-global-toggle" id="proposal-global-toggle"><input type="checkbox" id="proposal-global" name="proposal-global"> ${t('dialogs.proposal.globalCheckbox')}</label><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${t('common.cancel')}</button><button class="primary-action" id="save-proposal" value="default">${t('dialogs.proposal.saveProposal')}</button></div></form></dialog>
    <dialog id="delete-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="delete-proposal-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${t('common.close')}">×</button><span class="eyebrow">${t('dialogs.delete.eyebrow')}</span><h2>${t('dialogs.delete.title')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.delete.warning')}</p><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${t('common.cancel')}</button><button class="primary-action primary-action--danger" value="default">${t('dialogs.delete.confirmBtn')}</button></div></form></dialog>
  `

  document.querySelector('#back-to-reviews')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#workspace-theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#workspace-lang-toggle')?.addEventListener('click', () => toggleLanguage())
  document.querySelectorAll<HTMLButtonElement>('[data-file-index]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.fileIndex)
    const file = workspaceFiles[index]
    if (file) void renderReviewWorkspace(review, index)
  }))
  document.querySelectorAll<HTMLButtonElement>('[data-decision]').forEach((button) => button.addEventListener('click', async () => {
    if (!review.id) return
    const decision = Number(button.dataset.decision) as ReviewAction
    try {
      if (decision === ReviewAction.CLOSE || decision === ReviewAction.APPROVE) await publishPendingComments(review)
      const nextStatus = decision === ReviewAction.APPROVE
        ? ReviewStatusConst.APPROVED
        : decision === ReviewAction.REOPEN
        ? ReviewStatusConst.IN_PROGRESS
        : ReviewStatusConst.CLOSED
      await updateReviewStatus(review.id, nextStatus)
      await refreshReviews()
      navigate(decision === ReviewAction.REOPEN ? `#/reviews/${review.id}` : '#/reviews')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('alerts.cannotUpdateReview'))
    }
  }))

  const reloadWorkspace = async () => {
    await refreshReviews()
    const refreshedReview = review.id ? reviews.find((item) => item.id === review.id) ?? review : review
    await renderReviewWorkspace(refreshedReview, activeFileIndex)
  }

  document.querySelectorAll<HTMLElement>('.review-comment[data-comment-id]').forEach((article) => {
    const commentId = Number(article.dataset.commentId)
    if (!commentId) return
    article.querySelector<HTMLButtonElement>('.comment-action--edit')?.addEventListener('click', () => {
      const target = workspaceComments.find((comment) => comment.id === commentId)
      if (!target) return
      openProposalDialog({
        path: target.file,
        line: target.line,
        allowGlobalToggle: false,
        editId: commentId,
        initialMessage: target.message,
        initialSeverity: target.severity as CommentSeverity,
        initialAuthor: target.author,
        initialCategory: target.category,
        initialDecision: target.decision,
      })
    })
    article.querySelector<HTMLButtonElement>('.comment-action--delete')?.addEventListener('click', () => {
      pendingDeleteId = commentId
      deleteDialog.showModal()
    })
  })

  const proposalDialog = document.querySelector<HTMLDialogElement>('#new-proposal-dialog')!
  const proposalForm = document.querySelector<HTMLFormElement>('#new-proposal-form')!
  const proposalTitle = document.querySelector('#new-proposal-title')!
  const proposalHint = document.querySelector('#new-proposal-hint')!
  const proposalMessage = document.querySelector<HTMLTextAreaElement>('#proposal-message')!
  const proposalAuthorInput = document.querySelector<HTMLInputElement>('#proposal-author')!
  const proposalCategorySelect = document.querySelector<HTMLSelectElement>('#proposal-category')!
  const proposalDecisionSelect = document.querySelector<HTMLSelectElement>('#proposal-decision')!
  const proposalSeverityInputs = document.querySelectorAll<HTMLInputElement>('input[name="proposal-severity"]')
  const proposalGlobalToggle = document.querySelector<HTMLElement>('#proposal-global-toggle')!
  const proposalGlobalCheckbox = document.querySelector<HTMLInputElement>('#proposal-global')!
  const saveProposalButton = document.querySelector<HTMLButtonElement>('#save-proposal')!
  const deleteDialog = document.querySelector<HTMLDialogElement>('#delete-proposal-dialog')!
  const deleteForm = document.querySelector<HTMLFormElement>('#delete-proposal-form')!
  let proposalContext: { path?: string; line?: number } = {}
  let proposalEditId: number | undefined
  let pendingDeleteId: number | undefined

  const openProposalDialog = (context: {
    path?: string
    line?: number
    allowGlobalToggle: boolean
    editId?: number
    initialMessage?: string
    initialSeverity?: CommentSeverity
    initialAuthor?: string
    initialCategory?: CommentCategory
    initialDecision?: ProposalDecision
  }) => {
    proposalContext = { path: context.path, line: context.line }
    proposalEditId = context.editId
    proposalMessage.value = context.initialMessage ?? ''
    proposalAuthorInput.value = context.initialAuthor ?? t('domain.authors.localReviewer')
    proposalCategorySelect.value = String(context.initialCategory ?? CommentCategory.SOLID)
    proposalDecisionSelect.value = String(context.initialDecision ?? ProposalDecision.PENDING)
    proposalSeverityInputs.forEach((input) => { input.checked = Number(input.value) === (context.initialSeverity ?? CommentSeverity.MEDIUM) })
    proposalGlobalCheckbox.checked = false
    proposalGlobalToggle.style.display = context.allowGlobalToggle ? 'flex' : 'none'
    if (context.editId) {
      proposalTitle.textContent = t('dialogs.proposal.editTitle')
      proposalHint.textContent = context.path ? `${context.path}${context.line ? ':' + context.line : ''}` : t('workspace.globalProposal')
      saveProposalButton.textContent = t('dialogs.proposal.saveChanges')
    } else if (context.line) {
      proposalTitle.textContent = t('dialogs.proposal.lineTitle', { line: context.line })
      proposalHint.textContent = `${context.path}:${context.line}`
      saveProposalButton.textContent = t('dialogs.proposal.saveProposal')
    } else {
      proposalTitle.textContent = t('dialogs.proposal.generalTitle')
      proposalHint.textContent = context.path ?? ''
      saveProposalButton.textContent = t('dialogs.proposal.saveProposal')
    }
    proposalDialog.showModal()
  }

  document.querySelector('#new-file-proposal')?.addEventListener('click', () => openProposalDialog({ path: activeFile.path, allowGlobalToggle: true, initialAuthor: t('domain.authors.localReviewer'), initialCategory: CommentCategory.SOLID, initialDecision: ProposalDecision.PENDING }))
  document.querySelectorAll<HTMLElement>('.code-line').forEach((lineElement) => lineElement.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const lineNumber = Number(lineElement.dataset.line)
    openProposalDialog({ path: activeFile.path, line: lineNumber, allowGlobalToggle: false, initialAuthor: t('domain.authors.localReviewer'), initialCategory: CommentCategory.SOLID, initialDecision: ProposalDecision.PENDING })
  }))
  proposalForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === 'cancel') { proposalDialog.close(); return }
    if (!review.id) return
    const message = proposalMessage.value.trim()
    if (!message) return
    const selectedSeverityInput = Array.from(proposalSeverityInputs).find((input) => input.checked)
    const severity = (selectedSeverityInput ? Number(selectedSeverityInput.value) : CommentSeverity.MEDIUM) as CommentSeverity
    const category = (proposalCategorySelect.value ? Number(proposalCategorySelect.value) : CommentCategory.SOLID) as CommentCategory
    const decision = normalizeDecision(proposalDecisionSelect.value)
    if (proposalEditId) {
      await updateReviewComment(proposalEditId, { body: message, severity, category, decision })
    } else {
      const isGlobal = proposalGlobalCheckbox.checked
      await addManualReviewComment(review.id, {
        path: isGlobal ? undefined : proposalContext.path,
        line: proposalContext.line,
        body: message,
        severity,
        category,
        decision,
      })
    }
    proposalDialog.close()
    await reloadWorkspace()
  })
  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    deleteDialog.close()
    if (submitter?.value === 'cancel' || !pendingDeleteId) return
    await deleteReviewComment(pendingDeleteId)
    pendingDeleteId = undefined
    await reloadWorkspace()
  })
}

function renderSettings() {
  const config = getSlmConfig()
  const promptConfig = getReviewPromptConfig()
  app.innerHTML = `<div class="settings-shell bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark"><header class="settings-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${t('common.backToReviews')}</button><div><span class="eyebrow">${t('settings.eyebrow')}</span><h1>${t('settings.title')}</h1></div><div class="settings-header-actions flex items-center gap-2.5 ml-auto"><span class="settings-badge"><span class="live-dot"></span> ${t('settings.localOnly')}</span>${renderLangToggle('settings-lang-toggle')}<button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="settings-theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button></div></header><main class="settings-content"><section class="settings-intro"><div class="settings-icon">✦</div><div><h2>${t('settings.introTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.introDesc')}</p></div></section><form id="slm-config-form" class="settings-form bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" novalidate><div class="settings-section border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.connEyebrow')}</span><h2>${t('settings.connTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.connDesc')}</p></div><div class="form-grid"><label>${t('settings.runtimeUrlLabel')}<input id="slm-base-url" name="baseUrl" type="url" value="${config.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.runtimeUrlHint')}</small></label><label>${t('settings.slmModelLabel')}<div class="model-selector"><select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><option value="${config.model}" selected>${config.model}</option></select><button class="refresh-models bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="refresh-models" type="button" aria-label="${t('settings.refreshModelsTitle')}" title="${t('settings.refreshModelsTitle')}">↻</button></div><small id="slm-model-hint">${t('settings.loadingModels')}</small></label></div></div><div class="settings-section border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.inferenceEyebrow')}</span><h2>${t('settings.inferenceTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.inferenceDesc')}</p></div><div class="form-grid form-grid--compact"><label>${t('settings.tempLabel')}<input name="temperature" type="number" value="${config.temperature}" min="0" max="2" step="0.1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.tempHint')}</small></label><label>${t('settings.maxTokensLabel')}<input name="maxTokens" type="number" value="${config.maxTokens}" min="256" max="32768" step="256" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.maxTokensHint')}</small></label></div></div><div class="settings-footer border-brand-line-light dark:!border-brand-line-dark"><span id="slm-config-status" class="settings-status">${t('settings.statusNotice')}</span><div><button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="test-slm" type="button">${t('settings.testBtn')}</button><button class="primary-action" id="save-slm" type="submit">${t('settings.saveBtn')}</button></div></div></form></main></div>`

  const settingsForm = document.querySelector<HTMLFormElement>('#slm-config-form')!
  const settingsFooter = settingsForm.querySelector('.settings-footer')!
  settingsFooter.insertAdjacentHTML('beforebegin', `<div class="settings-section settings-section--prompts border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.promptsEyebrow')}</span><h2>${t('settings.promptsTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.promptsDesc')}</p></div><div class="prompt-fields"><label>${t('settings.instructionsLabel')}<textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${promptConfig.reviewInstructions}</textarea><small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.instructionsHint')}</small></label><label>${t('settings.contractLabel')}<textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${reviewOutputContract}</textarea><small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.contractHint')}</small></label></div></div>`)
  document.querySelector('#back-to-reviews')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#settings-theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#settings-lang-toggle')?.addEventListener('click', () => toggleLanguage())
  const loadModels = async (baseUrl: string) => {
    const modelSelect = document.querySelector<HTMLSelectElement>('#slm-model')!
    const modelHint = document.querySelector('#slm-model-hint')!
    const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-models')!
    const currentModel = modelSelect.value
    refreshButton.disabled = true
    refreshButton.classList.add('refresh-models--loading')
    modelHint.textContent = t('settings.loadingModels')
    try {
      const result = await testSlmConnection({ ...config, baseUrl })
      const modelIds = result.data?.map((model) => model.id).filter(Boolean) ?? []
      const availableModels = modelIds.includes(currentModel) || modelIds.length === 0 ? [currentModel, ...modelIds.filter((id) => id !== currentModel)] : modelIds
      modelSelect.innerHTML = availableModels.map((model) => `<option value="${model}" ${model === currentModel ? 'selected' : ''}>${model}</option>`).join('')
      modelHint.textContent = t('settings.modelsAvailable', { count: modelIds.length })
      modelHint.className = 'settings-hint settings-hint--success'
    } catch {
      modelHint.textContent = t('settings.modelsError')
      modelHint.className = 'settings-hint settings-hint--error'
    } finally {
      refreshButton.disabled = false
      refreshButton.classList.remove('refresh-models--loading')
    }
  }
  document.querySelector('#slm-base-url')?.addEventListener('change', (event) => void loadModels((event.target as HTMLInputElement).value))
  document.querySelector('#refresh-models')?.addEventListener('click', () => void loadModels((document.querySelector('#slm-base-url') as HTMLInputElement).value))
  void loadModels(config.baseUrl)
  document.querySelector<HTMLFormElement>('#slm-config-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const htmlForm = event.currentTarget as HTMLFormElement
    const status = document.querySelector('#slm-config-status')!
    if (!htmlForm.checkValidity()) {
      status.textContent = t('settings.errorRequired')
      status.className = 'settings-status settings-status--error'
      htmlForm.reportValidity()
      return
    }
    const form = new FormData(htmlForm)
    const nextConfig: SlmConfig = { baseUrl: String(form.get('baseUrl')), model: String(form.get('model')), temperature: Number(form.get('temperature')), maxTokens: Number(form.get('maxTokens')) }
    const nextPrompts = { reviewInstructions: String(form.get('reviewInstructions')) }
    const saveButton = document.querySelector<HTMLButtonElement>('#save-slm')!
    try {
      saveSlmConfig(nextConfig)
      saveReviewPromptConfig(nextPrompts)
      status.textContent = t('settings.savedSuccess')
      status.className = 'settings-status settings-status--success'
      saveButton.textContent = t('settings.saveBtnSuccess')
      window.setTimeout(() => { saveButton.textContent = t('settings.saveBtn') }, 1800)
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : t('settings.errorSave')
      status.className = 'settings-status settings-status--error'
    }
  })
  document.querySelector('#test-slm')?.addEventListener('click', async () => {
    const form = document.querySelector<HTMLFormElement>('#slm-config-form')!
    const values = new FormData(form)
    const status = document.querySelector('#slm-config-status')!
    try {
      const result = await testSlmConnection({ baseUrl: String(values.get('baseUrl')), model: String(values.get('model')), temperature: Number(values.get('temperature')), maxTokens: Number(values.get('maxTokens')) })
      status.textContent = t('settings.modelsAvailable', { count: result.data?.length ?? 0 })
      status.className = 'settings-status settings-status--success'
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : t('settings.errorTest')
      status.className = 'settings-status settings-status--error'
    }
  })
}

function isReviewProcessing(review: Review): boolean {
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

function formatProcessingTime(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

function formatDateTime(dateStr?: string): string {
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

function renderHistory() {
  const slmConfig = getSlmConfig()
  const sortedReviews = [...reviews].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

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
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">${renderBrandLogoSvg(31, 'sidebar')}</span><span>CodeReview <b>AI</b></span></div>
        <div class="sidebar__section-label">${t('sidebar.workspace')}</div>
        <nav class="main-nav" aria-label="${t('sidebar.workspace')}">
          <button class="nav-item" id="reviews-nav" type="button"><span class="nav-icon">▦</span> ${t('sidebar.reviews')} <span class="nav-count">${reviews.filter((review) => !isClosedReview(review)).length}</span></button>
          <button class="nav-item nav-item--active" id="history-nav" type="button"><span class="nav-icon">◷</span> ${t('sidebar.history')}</button>
        </nav>
        <div class="sidebar__footer">
          <button class="nav-item" id="settings-nav" type="button"><span class="nav-icon">⚙</span> ${t('sidebar.settings')}</button>
          <div class="session"><span class="avatar">AC</span><span><strong>${t('sidebar.localSession')}</strong><small>${t('sidebar.slmConnected')}</small></span><span class="session-dot"></span></div>
        </div>
      </aside>
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

function render(filter: ReviewFilter = ReviewFilter.ACTIVE) {
  if (currentScreen === AppScreen.SETTINGS) {
    renderSettings()
    return
  }
  if (currentScreen === AppScreen.HISTORY) {
    renderHistory()
    return
  }
  const selectedReview = reviews.find((review) => review.id === selectedReviewId)
  if (selectedReview) {
    void renderReviewWorkspace(selectedReview, currentWorkspaceFileIndex)
    return
  }
  const visibleReviews = reviews.filter((review) => filter === ReviewFilter.CLOSED ? isClosedReview(review) : !isClosedReview(review))
  const isAnyReviewProcessing = reviews.some(isReviewProcessing)
  const accessTokenField = hasRepositoryAccessToken()
    ? ''
    : `<label for="repository-token">${t('dialogs.connect.tokenLabel')}</label><input id="repository-token" name="repository-token" type="password" autocomplete="off" placeholder="${t('dialogs.connect.tokenPlaceholder')}" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.tokenHint')}</small>`
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">${renderBrandLogoSvg(31, 'sidebar')}</span><span>CodeReview <b>AI</b></span></div>
        <div class="sidebar__section-label">${t('sidebar.workspace')}</div>
        <nav class="main-nav" aria-label="${t('sidebar.workspace')}"><button class="nav-item nav-item--active" id="reviews-nav" type="button"><span class="nav-icon">▦</span> ${t('sidebar.reviews')} <span class="nav-count">${reviews.filter((review) => !isClosedReview(review)).length}</span></button><button class="nav-item" id="history-nav" type="button"><span class="nav-icon">◷</span> ${t('sidebar.history')}</button></nav>
        <div class="sidebar__footer"><button class="nav-item" id="settings-nav" type="button"><span class="nav-icon">⚙</span> ${t('sidebar.settings')}</button><div class="session"><span class="avatar">AC</span><span><strong>${t('sidebar.localSession')}</strong><small>${t('sidebar.slmConnected')}</small></span><span class="session-dot"></span></div></div>
      </aside>
      <main class="content bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
        <header class="topbar"><div><span class="eyebrow">${t('reviews.eyebrow')}</span><h1>${t('reviews.title')}</h1></div><div class="flex items-center gap-2">${renderLangToggle('lang-toggle')}<button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button></div></header>
        <section class="intro bg-brand-secondary-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="intro__lead"><span class="intro__emblem" aria-hidden="true">${renderBrandLogoSvg(46, 'hero')}</span><div><h2>${t('reviews.heroTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.heroSubtitle')}</p></div></div><button class="primary-action" id="new-review" type="button" ${isAnyReviewProcessing ? `disabled title="${t('reviews.reviewInProgressTooltip')}"` : ''}><span>+</span> ${t('reviews.newReview')}</button></section>
        <section class="stats" aria-label="${t('reviews.title')}"><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.inProgress')}</span><strong>${reviewKpis.activeReviews}</strong><span class="stat__detail stat__detail--positive">${t('reviews.stats.activeReviews')}</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.pendingSlm')}</span><strong>${reviewKpis.pendingSlmComments}</strong><span class="stat__detail text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.proposalsToReview')}</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.stats.publishedComments')}</span><strong>${reviewKpis.publishedComments}</strong><span class="stat__detail stat__detail--positive">${t('reviews.stats.total')}</span></div></section>
        <div class="section-heading"><div><h2>${filter === ReviewFilter.CLOSED ? t('reviews.heading.closedTitle') : t('reviews.heading.activeTitle')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('reviews.heading.registeredCount', { count: visibleReviews.length })}</p></div><div class="tabs" role="tablist"><button class="tab ${filter === ReviewFilter.ACTIVE ? 'tab--active' : ''}" data-filter="${ReviewFilter.ACTIVE}" type="button">${t('reviews.tabs.active')}</button><button class="tab ${filter === ReviewFilter.CLOSED ? 'tab--active' : ''}" data-filter="${ReviewFilter.CLOSED}" type="button">${t('reviews.tabs.closed')}</button></div></div>
        <section class="review-list">${visibleReviews.length ? visibleReviews.map(reviewCard).join('') : `<div class="empty-state border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><strong>${filter === ReviewFilter.CLOSED ? t('reviews.empty.closedTitle') : t('reviews.empty.activeTitle')}</strong><span>${filter === ReviewFilter.CLOSED ? t('reviews.empty.closedText') : t('reviews.empty.activeText')}</span></div>`}</section>
        <footer class="content-footer text-brand-muted-light dark:!text-brand-muted-dark"><span><span class="live-dot"></span> ${t('reviews.footer.slmReady')}</span><span>${t('reviews.footer.localDataNotice')}</span></footer>
      </main>
    </div>
    <dialog id="new-review-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="new-review-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${t('common.close')}">×</button><span class="eyebrow">${t('dialogs.connect.eyebrow')}</span><h2>${t('dialogs.connect.title')}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.description')}</p><label for="review-url">${t('dialogs.connect.urlLabel')}</label><input id="review-url" name="review-url" type="url" placeholder="${t('dialogs.connect.urlPlaceholder')}" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><div id="url-adapter-preview" class="url-adapter-preview hidden text-xs mt-1.5 p-2 rounded border bg-[#f3f6f4] dark:!bg-[#182521] border-brand-line-light dark:!border-brand-line-dark"></div>${accessTokenField}<small id="remote-request-status" class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.connect.statusDefault')}</small><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${t('common.cancel')}</button><button class="primary-action" id="connect-review" value="default">${t('dialogs.connect.continueBtn')}</button></div></form></dialog>
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
    document.querySelector<HTMLDialogElement>('#new-review-dialog')?.showModal()
  })
  document.querySelector('#reviews-nav')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#history-nav')?.addEventListener('click', () => navigate('#/history'))
  document.querySelector('#settings-nav')?.addEventListener('click', () => navigate('#/settings'))
  document.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#lang-toggle')?.addEventListener('click', () => toggleLanguage())
  document.querySelector<HTMLFormElement>('#new-review-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
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
    try {
      const location = parseReviewUrl(url)
      trace('review.create.platform-ready', { provider: location.provider, baseUrl: location.baseUrl, repositoryPath: location.repositoryPath, changeNumber: location.changeNumber })
      if (!hasRepositoryAccessToken() && typeof accessToken === 'string') setRepositoryAccessToken(accessToken)
      requestStatus.textContent = t('dialogs.connect.statusConnecting', { provider: location.provider })
      connectButton.disabled = true
      const [change, files, comments] = await Promise.all([getRemoteChange(location), listRemoteFiles(location), listRemoteComments(location)])
      const reviewId = await createReview(url, { change, files, comments })
      void import('./review-runtime')
        .then(({ startReviewWorkflow }) => startReviewWorkflow(reviewId))
        .catch((error: unknown) => console.error('No se pudo iniciar el flujo LangGraph.', error))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dialogs.connect.errorConnecting')
      trace('review.create.error', { message })
      requestStatus.textContent = message
      requestStatus.className = 'token-hint settings-status--error'
      connectButton.disabled = false
      window.alert(message)
      return
    }
    await refreshReviews()
    document.querySelector<HTMLDialogElement>('#new-review-dialog')?.close()
    render(filter)
  })
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.addEventListener('click', () => navigate(`#/reviews?filter=${button.dataset.filter}`)))
  document.querySelectorAll<HTMLButtonElement>('[data-review-id]').forEach((button) => button.addEventListener('click', () => {
    const review = reviews.find((item) => item.id === Number(button.dataset.reviewId))
    if (!review) return
    navigate(`#/reviews/${review.id}`)
  }))
  document.querySelectorAll<HTMLElement>('.review-card__thinking').forEach((thinkingContainer) => {
    thinkingContainer.addEventListener('click', (event) => event.stopPropagation())
    thinkingContainer.addEventListener('pointerdown', (event) => event.stopPropagation())
    const snippet = thinkingContainer.querySelector<HTMLElement>('.thinking-snippet')
    if (snippet) snippet.scrollTop = snippet.scrollHeight
  })
}

async function start() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    await navigator.serviceWorker.register('./sw.js')
  }
  await refreshReviews()
  window.addEventListener('hashchange', applyRoute)
  onReviewProgress(async () => {
    await refreshReviews()
    if (currentScreen === AppScreen.REVIEWS && !selectedReviewId) render(currentFilter)
    if (currentScreen === AppScreen.HISTORY) renderHistory()
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
        const labelText = thinking.phase === 'suggesting' ? t('reviews.card.generatingProposals') : t('reviews.card.slmThinking')

        let thinkingContainer = card.querySelector<HTMLElement>('.review-card__thinking')
        if (!thinkingContainer) {
          const progressElem = card.querySelector('.progress')
          if (progressElem) {
            progressElem.insertAdjacentHTML('beforebegin', `
              <div class="review-card__thinking" data-thinking-for="${thinking.reviewId}">
                <div class="thinking-badge">
                  <span class="thinking-pulse" aria-hidden="true"></span>
                  <span class="thinking-label">${labelText}</span>
                  <span class="thinking-file" title="${fileInfo}">${fileInfo}</span>
                </div>
                <div class="thinking-snippet" title="${thoughtText.replaceAll('"', '&quot;')}">${thoughtText.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</div>
              </div>
            `)
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
          }
        } else {
          const labelText = thinking.phase === 'suggesting' ? t('reviews.card.generatingProposals') : t('reviews.card.slmThinking')
          workspaceStatusElem.className = 'status status--thinking'
          workspaceStatusElem.innerHTML = `<span class="thinking-pulse"></span>${labelText}`
        }
      }
    }
  })
  onLanguageChange(() => {
    if (currentScreen === AppScreen.SETTINGS) {
      renderSettings()
    } else if (currentScreen === AppScreen.HISTORY) {
      renderHistory()
    } else if (selectedReviewId) {
      const review = reviews.find((r) => r.id === selectedReviewId)
      if (review) void renderReviewWorkspace(review, currentWorkspaceFileIndex)
    } else {
      render(currentFilter)
    }
  })
  applyRoute()
}

void start()
