import { publishRemoteComment } from '../platform-api'
import { parseReviewUrl } from '../platform-url'
import {
  addManualReviewComment,
  deleteReviewComment,
  listReviewComments,
  markReviewCommentPublished,
  updateReviewComment,
  updateReviewStatus,
  type Review,
} from '../review-db'
import { getReviewThinking } from '../review-events'
import {
  t,
  tAuthor,
  tCategory,
  tDecision,
  tSeverity,
  tStatus,
  toggleLanguage,
} from '../i18n'
import {
  CommentCategory,
  CommentLifecycle,
  CommentSeverity,
  CommentSource,
  ProposalDecision,
  ReviewAction,
  ReviewStatus as ReviewStatusConst,
} from '../enums'
import {
  isReviewProcessing,
  renderLangToggle,
  severityClass,
  statusClass,
  toggleTheme,
} from './shared'

export interface WorkspaceOptions {
  review: Review
  activeFileIndex?: number
  navigate: (hash: string) => void
  refreshReviews: () => Promise<void>
  onFileSelect?: (index: number) => void
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

export async function renderReviewWorkspace(app: HTMLElement, options: WorkspaceOptions) {
  const { review, activeFileIndex = 0, navigate, refreshReviews, onFileSelect } = options
  const isReviewLocked =
    review.status === ReviewStatusConst.APPROVED ||
    review.status === ReviewStatusConst.CLOSED ||
    (review.status as unknown) === 'Aprobada' ||
    (review.status as unknown) === 'Cerrada'

  const isProcessing = isReviewProcessing(review)
  const storedComments = review.id ? await listReviewComments(review.id) : []
  const workspaceFiles = review.remoteFiles?.length
    ? review.remoteFiles.map((file) => ({
        path: file.path,
        type: file.path.split('.').at(-1)?.toUpperCase() ?? 'TXT',
        lines: (file.content ?? file.patch ?? t('workspace.noFilesDownloadedText')).split('\n'),
      }))
    : [{ path: t('workspace.noFilesDownloaded'), type: 'TXT', lines: [t('workspace.noFilesDownloadedText')] }]

  const workspaceComments = storedComments.length
    ? storedComments.map((comment) => ({
        id: comment.id,
        file: comment.path,
        line: comment.line,
        severity: comment.severity ?? CommentSeverity.MEDIUM,
        message: comment.body,
        author: tAuthor(comment.author, comment.source),
        category: comment.category ?? CommentCategory.SOLID,
        decision: normalizeDecision(comment.decision),
        source: comment.source,
      }))
    : review.remoteComments?.length
    ? review.remoteComments.map((comment) => ({
        id: undefined as number | undefined,
        file: comment.path,
        line: comment.line,
        severity: CommentSeverity.MEDIUM,
        message: comment.body,
        author: tAuthor(comment.author, CommentSource.REMOTE),
        category: CommentCategory.SOLID,
        decision: ProposalDecision.PENDING,
        source: CommentSource.REMOTE,
      }))
    : []

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

  app.innerHTML = `
    <div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${t('common.backToReviews')}</button>
        <div class="workspace-title">
          <span class="provider provider--${review.provider.toLowerCase()}">${review.provider}</span>
          <strong class="text-brand-primary-light dark:!text-brand-primary-dark">${review.title}</strong>
          <span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${review.repository}</span>
        </div>
        <div class="workspace-actions">
          ${statusDisplay}
          ${isReviewLocked
            ? `<button class="primary-action" data-decision="${ReviewAction.REOPEN}" type="button">${t('common.reopen')}</button>`
            : isProcessing
            ? `<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${ReviewAction.CLOSE}" type="button">${t('common.close')}</button>`
            : `<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${ReviewAction.CLOSE}" type="button">${t('common.close')}</button><button class="primary-action" data-decision="${ReviewAction.APPROVE}" type="button">${t('workspace.approveLocally')}</button>`
          }
          ${renderLangToggle('workspace-lang-toggle')}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button>
        </div>
      </header>
      <div class="workspace-grid">
        <aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.modifiedFiles')} <span class="panel-counter">${workspaceFiles.length}</span></div>
          <div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${review.repository}</div>
          ${workspaceFiles.map((file, index) => {
            const fileComments = fileCommentsMap.get(file.path) ?? []
            const commentCount = fileComments.length
            const hasHighSeverity = fileComments.some((comment) => comment.severity === CommentSeverity.HIGH || (comment.severity as unknown) === 'alta')
            const badgeClass = hasHighSeverity ? 'comment-badge comment-badge--alta' : 'comment-badge'
            const badgeLabel = t('workspace.reviewProposalBadge', {
              count: commentCount,
              label: commentCount === 1 ? t('workspace.proposalWordSingular') : t('workspace.proposalWordPlural'),
            })
            return `<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${index === activeFileIndex ? 'file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark' : 'hover:dark:!bg-[#263730]'}" data-file-index="${index}" type="button"><span class="file-type">${file.type}</span><span class="file-name" title="${file.path}">${file.path}</span>${commentCount > 0 ? `<span class="${badgeClass}" title="${badgeLabel}" aria-label="${badgeLabel}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${commentCount}</span></span>` : ''}</button>`
          }).join('')}
          <div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${t('workspace.commentsCount', { count: workspaceComments.length })}</div>
        </aside>
        <main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark">
          <div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFile.path}</strong>
              <span class="text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.diffView', { lines: activeFile.lines.length })}</span>
            </div>
            <div class="code-toolbar__actions">
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">${t('workspace.newProposal')}</button>
            </div>
          </div>
          <div class="code-frame">
            ${activeFile.lines.map((line, index) => {
              const lineNumber = index + 1
              const comments = activeFileComments.filter((comment) => comment.line === lineNumber)
              return `<div class="code-line ${comments.length ? 'code-line--commented dark:!bg-[#352f19]' : ''}" data-line="${lineNumber}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${lineNumber}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</code>${comments.length ? `<span class="line-marker" title="${t('workspace.lineCommentsMarker', { count: comments.length })}">●</span>` : ''}</div>`
            }).join('')}
          </div>
        </main>
        <aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('workspace.commentsPanelTitle')}</span>
              <h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFileComments.length === 1 ? t('workspace.singleProposalCount') : t('workspace.proposalsCount', { count: activeFileComments.length })}</h2>
              <small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${activeFile.path}</small>
            </div>
          </div>
          ${activeFileComments.length
            ? activeFileComments.map((comment) => `<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${comment.id ?? ''}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${severityClass(comment.severity)}">${tSeverity(comment.severity)}</span><span>${comment.file ? `${comment.file}${comment.line ? ':' + comment.line : ''}` : t('workspace.globalProposal')}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${comment.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${comment.author} · ${tCategory(comment.category)} · ${tDecision(comment.decision)}</small>${comment.id && !isReviewLocked ? `<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${t('common.edit')}</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${t('common.delete')}</button></div>` : ''}</article>`).join('')
            : `<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">${t('workspace.emptyComments')}</div>`
          }
        </aside>
      </div>
    </div>
    <dialog id="new-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="new-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${t('common.close')}">×</button>
        <span class="eyebrow">${t('dialogs.proposal.eyebrow')}</span>
        <h2 id="new-proposal-title">${t('dialogs.proposal.addTitle')}</h2>
        <p id="new-proposal-hint" class="text-brand-muted-light dark:!text-brand-muted-dark"></p>
        <label for="proposal-message">${t('dialogs.proposal.descLabel')}</label>
        <textarea id="proposal-message" name="proposal-message" rows="3" required placeholder="${t('dialogs.proposal.descPlaceholder')}" class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"></textarea>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-author">${t('dialogs.proposal.authorLabel')}</label>
            <input id="proposal-author" name="proposal-author" type="text" readonly class="proposal-input proposal-input--readonly bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark">
          </div>
          <div class="proposal-field">
            <label for="proposal-category">${t('dialogs.proposal.categoryLabel')}</label>
            <select id="proposal-category" name="proposal-category" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${CommentCategory.SOLID}">${tCategory(CommentCategory.SOLID)}</option>
              <option value="${CommentCategory.SECURITY}">${tCategory(CommentCategory.SECURITY)}</option>
              <option value="${CommentCategory.QUALITY}">${tCategory(CommentCategory.QUALITY)}</option>
            </select>
          </div>
        </div>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-decision">${t('dialogs.proposal.decisionLabel')}</label>
            <select id="proposal-decision" name="proposal-decision" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${ProposalDecision.PENDING}">${tDecision(ProposalDecision.PENDING)}</option>
              <option value="${ProposalDecision.DESIRABLE}">${tDecision(ProposalDecision.DESIRABLE)}</option>
              <option value="${ProposalDecision.IMPORTANT}">${tDecision(ProposalDecision.IMPORTANT)}</option>
              <option value="${ProposalDecision.BLOCKING}">${tDecision(ProposalDecision.BLOCKING)}</option>
            </select>
          </div>
          <div class="proposal-field">
            <span class="field-label">${t('dialogs.proposal.severityLabel')}</span>
            <div class="severity-picker" id="proposal-severity-picker">
              <label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="${CommentSeverity.LOW}"><span>${tSeverity(CommentSeverity.LOW)}</span></label>
              <label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="${CommentSeverity.MEDIUM}" checked><span>${tSeverity(CommentSeverity.MEDIUM)}</span></label>
              <label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="${CommentSeverity.HIGH}"><span>${tSeverity(CommentSeverity.HIGH)}</span></label>
            </div>
          </div>
        </div>
        <label class="proposal-global-toggle" id="proposal-global-toggle"><input type="checkbox" id="proposal-global" name="proposal-global"> ${t('dialogs.proposal.globalCheckbox')}</label>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${t('common.cancel')}</button>
          <button class="primary-action" id="save-proposal" value="default">${t('dialogs.proposal.saveProposal')}</button>
        </div>
      </form>
    </dialog>
    <dialog id="delete-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="delete-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${t('common.close')}">×</button>
        <span class="eyebrow">${t('dialogs.delete.eyebrow')}</span>
        <h2>${t('dialogs.delete.title')}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('dialogs.delete.warning')}</p>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${t('common.cancel')}</button>
          <button class="primary-action primary-action--danger" value="default">${t('dialogs.delete.confirmBtn')}</button>
        </div>
      </form>
    </dialog>
  `

  document.querySelector('#back-to-reviews')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#workspace-theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector('#workspace-lang-toggle')?.addEventListener('click', () => toggleLanguage())

  document.querySelectorAll<HTMLButtonElement>('[data-file-index]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.fileIndex)
      const file = workspaceFiles[index]
      if (file) {
        onFileSelect?.(index)
        void renderReviewWorkspace(app, { ...options, activeFileIndex: index })
      }
    })
  )

  document.querySelectorAll<HTMLButtonElement>('[data-decision]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (!review.id) return
      const decision = Number(button.dataset.decision) as ReviewAction
      try {
        if (decision === ReviewAction.CLOSE) {
          const { cancelReviewWorkflow } = await import('../review-runtime')
          cancelReviewWorkflow(review.id)
        }
        if (decision === ReviewAction.APPROVE || (decision === ReviewAction.CLOSE && !isReviewProcessing(review))) {
          await publishPendingComments(review)
        }
        const nextStatus =
          decision === ReviewAction.APPROVE
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
    })
  )

  const reloadWorkspace = async () => {
    await refreshReviews()
    await renderReviewWorkspace(app, { ...options, activeFileIndex })
  }

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
    proposalSeverityInputs.forEach((input) => {
      input.checked = Number(input.value) === (context.initialSeverity ?? CommentSeverity.MEDIUM)
    })
    proposalGlobalCheckbox.checked = false
    proposalGlobalToggle.style.display = context.allowGlobalToggle ? 'flex' : 'none'
    if (context.editId) {
      proposalTitle.textContent = t('dialogs.proposal.editTitle')
      proposalHint.textContent = context.path
        ? `${context.path}${context.line ? ':' + context.line : ''}`
        : t('workspace.globalProposal')
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

  document.querySelector('#new-file-proposal')?.addEventListener('click', () =>
    openProposalDialog({
      path: activeFile.path,
      allowGlobalToggle: true,
      initialAuthor: t('domain.authors.localReviewer'),
      initialCategory: CommentCategory.SOLID,
      initialDecision: ProposalDecision.PENDING,
    })
  )

  document.querySelectorAll<HTMLElement>('.code-line').forEach((lineElement) =>
    lineElement.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      const lineNumber = Number(lineElement.dataset.line)
      openProposalDialog({
        path: activeFile.path,
        line: lineNumber,
        allowGlobalToggle: false,
        initialAuthor: t('domain.authors.localReviewer'),
        initialCategory: CommentCategory.SOLID,
        initialDecision: ProposalDecision.PENDING,
      })
    })
  )

  proposalForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === 'cancel') {
      proposalDialog.close()
      return
    }
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
