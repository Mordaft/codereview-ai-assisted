import './style.css'
import { hasRepositoryAccessToken, setRepositoryAccessToken } from './browser-session'
import { trace } from './diagnostics'
import { getRemoteChange, listRemoteComments, listRemoteFiles, publishRemoteComment } from './platform-api'
import { detectPlatform, parseReviewUrl } from './platform-url'
import { addManualReviewComment, createReview, deleteReviewComment, getReviewKpis, listReviewComments, listReviews, markReviewCommentPublished, updateReviewComment, updateReviewStatus, type Review, type ReviewStatus } from './review-db'
import { onReviewProgress } from './review-events'
import { getSlmConfig, saveSlmConfig, testSlmConnection, type SlmConfig } from './slm-config'
import { getReviewPromptConfig, reviewOutputContract, saveReviewPromptConfig } from './review-prompts'

let reviews: Review[] = []
let reviewKpis = { activeReviews: 0, pendingSlmComments: 0, publishedComments: 0 }
let selectedReviewId: number | undefined
let currentScreen: 'reviews' | 'settings' = 'reviews'
let currentFilter: 'active' | 'closed' = 'active'

async function refreshReviews() {
  reviews = await listReviews()
  reviewKpis = await getReviewKpis()
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = hash.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const params = new URLSearchParams(queryPart)
  if (segments[0] === 'settings') return { screen: 'settings' as const }
  if (segments[0] === 'reviews' && segments[1]) {
    const reviewId = Number(segments[1])
    if (!Number.isNaN(reviewId)) return { screen: 'reviews' as const, reviewId }
  }
  return { screen: 'reviews' as const, filter: params.get('filter') === 'closed' ? 'closed' as const : 'active' as const }
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

function statusClass(status: ReviewStatus) {
  return status.toLowerCase().replaceAll(' ', '-')
}

function severityLabel(severity: string) {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

async function publishPendingComments(review: Review) {
  if (!review.id || !review.remoteChange?.webUrl) return
  const comments = await listReviewComments(review.id)
  const pendingComments = comments.filter((comment) => comment.decision !== 'published')
  if (!pendingComments.length) return
  const location = parseReviewUrl(review.remoteChange.webUrl)
  for (const comment of pendingComments) {
    const context = comment.path ? `${comment.path}${comment.line ? ':' + comment.line : ''}` : 'Comentario general'
    const body = `**[${severityLabel(comment.severity ?? 'media')}]** ${context}\n\n${comment.body}`
    await publishRemoteComment(location, { body })
    if (comment.id) await markReviewCommentPublished(comment.id)
  }
}

function reviewCard(review: Review) {
  return `
    <button class="review-card bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark" data-review-id="${review.id}" type="button">
      <div class="review-card__topline"><span class="provider provider--${review.provider.toLowerCase()}">${review.provider}</span><span class="status status--${statusClass(review.status)}"><span></span>${review.status}</span></div>
      <h3>${review.title}</h3><p class="repository">${review.repository}</p>
      <div class="progress" aria-label="Progreso ${review.progress}%"><span style="width: ${review.progress}%"></span></div>
      <div class="review-card__meta"><span>${review.comments} comentarios</span><span>${review.updated}</span></div>
    </button>
  `
}

async function renderReviewWorkspace(review: Review, activeFileIndex = 0) {
  const isReviewLocked = review.status === 'Aprobada' || review.status === 'Cerrada'
  const storedComments = review.id ? await listReviewComments(review.id) : []
  const workspaceFiles = review.remoteFiles?.length ? review.remoteFiles.map((file) => ({ path: file.path, type: file.path.split('.').at(-1)?.toUpperCase() ?? 'TXT', lines: (file.content ?? file.patch ?? 'Sin contenido textual descargado.').split('\n') })) : [{ path: 'Sin ficheros descargados', type: 'TXT', lines: ['No se ha descargado contenido de ficheros para esta revisión.'] }]
  const workspaceComments = storedComments.length ? storedComments.map((comment) => ({ id: comment.id, file: comment.path, line: comment.line, severity: comment.severity ?? 'media', message: comment.body, source: comment.source === 'slm' ? 'SLM local · Pendiente de decisión' : comment.source === 'human' ? 'Revisor local · Pendiente de decisión' : comment.author })) : review.remoteComments?.length ? review.remoteComments.map((comment) => ({ id: undefined as number | undefined, file: comment.path, line: comment.line, severity: 'media', message: comment.body, source: comment.author })) : []
  const activeFile = workspaceFiles[activeFileIndex] ?? workspaceFiles[0]
  const activeFileComments = workspaceComments.filter((comment) => !comment.file || comment.file === activeFile.path)
  app.innerHTML = `<div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark"><header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">← Revisiones</button><div class="workspace-title"><span class="provider provider--${review.provider.toLowerCase()}">${review.provider}</span><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${review.title}</strong><span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${review.repository}</span></div><div class="workspace-actions"><span class="status status--${statusClass(review.status)}"><span></span>${review.status}</span>${isReviewLocked ? '<button class="primary-action" data-decision="reopen" type="button">Reabrir</button>' : '<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="close" type="button">Cerrar</button><button class="primary-action" data-decision="approve" type="button">Aprobar localmente</button>'}<button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="Cambiar tema">◐</button></div></header><div class="workspace-grid"><aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">FICHEROS MODIFICADOS <span class="panel-counter">${workspaceFiles.length}</span></div><div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${review.repository}</div>${workspaceFiles.map((file, index) => {
    const fileComments = workspaceComments.filter((comment) => comment.file === file.path)
    const commentCount = fileComments.length
    const hasHighSeverity = fileComments.some((comment) => comment.severity === 'alta')
    const badgeClass = hasHighSeverity ? 'comment-badge comment-badge--alta' : 'comment-badge'
    const badgeLabel = `${commentCount} ${commentCount === 1 ? 'propuesta' : 'propuestas'} de revisión`
    return `<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${index === activeFileIndex ? 'file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark' : 'hover:dark:!bg-[#263730]'}" data-file-index="${index}" type="button"><span class="file-type">${file.type}</span><span class="file-name" title="${file.path}">${file.path}</span>${commentCount > 0 ? `<span class="${badgeClass}" title="${badgeLabel}" aria-label="${badgeLabel}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${commentCount}</span></span>` : ''}</button>`
  }).join('')}<div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${workspaceComments.length} comentarios</div></aside><main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark"><div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div><strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFile.path}</strong><span class="text-brand-muted-light dark:!text-brand-muted-dark">Vista de cambios · ${activeFile.lines.length} líneas</span></div><div class="code-toolbar__actions"><button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">+ Propuesta</button></div></div><div class="code-frame">${activeFile.lines.map((line, index) => { const lineNumber = index + 1; const comments = activeFileComments.filter((comment) => comment.line === lineNumber); return `<div class="code-line ${comments.length ? 'code-line--commented dark:!bg-[#352f19]' : ''}" data-line="${lineNumber}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${lineNumber}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</code>${comments.length ? `<span class="line-marker" title="${comments.length} comentario(s)">●</span>` : ''}</div>` }).join('')}</div></main><aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">COMENTARIOS DE REVISION</span><h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${activeFileComments.length} propuestas</h2><small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${activeFile.path}</small></div></div>${activeFileComments.length ? activeFileComments.map((comment) => `<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${comment.id ?? ''}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${comment.severity}">${severityLabel(comment.severity)}</span><span>${comment.file ? `${comment.file}${comment.line ? ':' + comment.line : ''}` : 'Propuesta global'}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${comment.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${comment.source} · Pendiente de decisión</small>${comment.id && !isReviewLocked ? '<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">Editar</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">Eliminar</button></div>' : ''}</article>`).join('') : '<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">Este fichero no tiene comentarios de revisión.</div>'}</aside></div></div>
    <dialog id="new-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="new-proposal-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="Cerrar">×</button><span class="eyebrow">PROPUESTA</span><h2 id="new-proposal-title">Añadir propuesta</h2><p id="new-proposal-hint" class="text-brand-muted-light dark:!text-brand-muted-dark"></p><label for="proposal-message">Descripción</label><textarea id="proposal-message" name="proposal-message" rows="4" required placeholder="Describe la propuesta de revisión" class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"></textarea><span class="field-label">Severidad</span><div class="severity-picker" id="proposal-severity-picker"><label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="baja"><span>Baja</span></label><label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="media" checked><span>Media</span></label><label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="alta"><span>Alta</span></label></div><label class="proposal-global-toggle" id="proposal-global-toggle"><input type="checkbox" id="proposal-global" name="proposal-global"> No asociar a ningún fichero (propuesta global)</label><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">Cancelar</button><button class="primary-action" id="save-proposal" value="default">Guardar propuesta</button></div></form></dialog>
    <dialog id="delete-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="delete-proposal-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="Cerrar">×</button><span class="eyebrow">ELIMINAR PROPUESTA</span><h2>¿Eliminar esta propuesta?</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Esta acción no se puede deshacer.</p><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">Cancelar</button><button class="primary-action primary-action--danger" value="default">Eliminar</button></div></form></dialog>
  `

  document.querySelector('#back-to-reviews')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#workspace-theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelectorAll<HTMLButtonElement>('[data-file-index]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.fileIndex)
    const file = workspaceFiles[index]
    if (file) void renderReviewWorkspace(review, index)
  }))
  document.querySelectorAll<HTMLButtonElement>('[data-decision]').forEach((button) => button.addEventListener('click', async () => {
    if (!review.id) return
    const decision = button.dataset.decision as 'close' | 'approve' | 'reopen'
    try {
      if (decision === 'close' || decision === 'approve') await publishPendingComments(review)
      await updateReviewStatus(review.id, decision === 'approve' ? 'Aprobada' : decision === 'reopen' ? 'En curso' : 'Cerrada')
      await refreshReviews()
      navigate(decision === 'reopen' ? `#/reviews/${review.id}` : '#/reviews')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar la revision.')
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
      openProposalDialog({ path: target.file, line: target.line, allowGlobalToggle: false, editId: commentId, initialMessage: target.message, initialSeverity: target.severity as 'baja' | 'media' | 'alta' })
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
  const proposalSeverityInputs = document.querySelectorAll<HTMLInputElement>('input[name="proposal-severity"]')
  const proposalGlobalToggle = document.querySelector<HTMLElement>('#proposal-global-toggle')!
  const proposalGlobalCheckbox = document.querySelector<HTMLInputElement>('#proposal-global')!
  const saveProposalButton = document.querySelector<HTMLButtonElement>('#save-proposal')!
  const deleteDialog = document.querySelector<HTMLDialogElement>('#delete-proposal-dialog')!
  const deleteForm = document.querySelector<HTMLFormElement>('#delete-proposal-form')!
  let proposalContext: { path?: string; line?: number } = {}
  let proposalEditId: number | undefined
  let pendingDeleteId: number | undefined

  const openProposalDialog = (context: { path?: string; line?: number; allowGlobalToggle: boolean; editId?: number; initialMessage?: string; initialSeverity?: 'baja' | 'media' | 'alta' }) => {
    proposalContext = { path: context.path, line: context.line }
    proposalEditId = context.editId
    proposalMessage.value = context.initialMessage ?? ''
    proposalSeverityInputs.forEach((input) => { input.checked = input.value === (context.initialSeverity ?? 'media') })
    proposalGlobalCheckbox.checked = false
    proposalGlobalToggle.style.display = context.allowGlobalToggle ? 'flex' : 'none'
    if (context.editId) {
      proposalTitle.textContent = 'Editar propuesta'
      proposalHint.textContent = context.path ? `${context.path}${context.line ? ':' + context.line : ''}` : 'Propuesta global'
      saveProposalButton.textContent = 'Guardar cambios'
    } else if (context.line) {
      proposalTitle.textContent = `Nueva propuesta en la línea ${context.line}`
      proposalHint.textContent = `${context.path}:${context.line}`
      saveProposalButton.textContent = 'Guardar propuesta'
    } else {
      proposalTitle.textContent = 'Nueva propuesta general'
      proposalHint.textContent = context.path ?? ''
      saveProposalButton.textContent = 'Guardar propuesta'
    }
    proposalDialog.showModal()
  }

  document.querySelector('#new-file-proposal')?.addEventListener('click', () => openProposalDialog({ path: activeFile.path, allowGlobalToggle: true }))
  document.querySelectorAll<HTMLElement>('.code-line').forEach((lineElement) => lineElement.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const lineNumber = Number(lineElement.dataset.line)
    openProposalDialog({ path: activeFile.path, line: lineNumber, allowGlobalToggle: false })
  }))
  proposalForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value === 'cancel') { proposalDialog.close(); return }
    if (!review.id) return
    const message = proposalMessage.value.trim()
    if (!message) return
    const severity = (Array.from(proposalSeverityInputs).find((input) => input.checked)?.value ?? 'media') as 'baja' | 'media' | 'alta'
    if (proposalEditId) {
      await updateReviewComment(proposalEditId, { body: message, severity })
    } else {
      const isGlobal = proposalGlobalCheckbox.checked
      await addManualReviewComment(review.id, { path: isGlobal ? undefined : proposalContext.path, line: proposalContext.line, body: message, severity })
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
  app.innerHTML = `<div class="settings-shell bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark"><header class="settings-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">← Revisiones</button><div><span class="eyebrow">CONFIGURACION</span><h1>Runtime SLM local</h1></div><div class="settings-header-actions flex items-center gap-3 ml-auto"><span class="settings-badge"><span class="live-dot"></span> Solo entorno local</span><button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="settings-theme-toggle" type="button" aria-label="Cambiar tema">◐</button></div></header><main class="settings-content"><section class="settings-intro"><div class="settings-icon">✦</div><div><h2>Configura tu modelo de revisión</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Indica dónde está disponible el runtime SLM que analizará el código. La aplicación no enviará el contenido a servicios IA públicos.</p></div></section><form id="slm-config-form" class="settings-form bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" novalidate><div class="settings-section border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">CONEXION</span><h2>Runtime compatible</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">La URL debe apuntar a un servicio ejecutándose en este equipo.</p></div><div class="form-grid"><label>URL local del runtime<input id="slm-base-url" name="baseUrl" type="url" value="${config.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">Ejemplos: Ollama, llama.cpp o vLLM con API compatible.</small></label><label>Modelo SLM<div class="model-selector"><select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><option value="${config.model}" selected>${config.model}</option></select><button class="refresh-models bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="refresh-models" type="button" aria-label="Actualizar modelos" title="Actualizar modelos">↻</button></div><small id="slm-model-hint">Cargando modelos disponibles...</small></label></div></div><div class="settings-section border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">INFERENCIA</span><h2>Parámetros del análisis</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Se aplicarán a cada análisis inicial de la MR/PR.</p></div><div class="form-grid form-grid--compact"><label>Temperatura<input name="temperature" type="number" value="${config.temperature}" min="0" max="2" step="0.1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">Valores bajos producen respuestas más deterministas.</small></label><label>Máximo de tokens<input name="maxTokens" type="number" value="${config.maxTokens}" min="256" max="32768" step="256" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="text-brand-muted-light dark:!text-brand-muted-dark">Límite de salida de cada análisis.</small></label></div></div><div class="settings-footer border-brand-line-light dark:!border-brand-line-dark"><span id="slm-config-status" class="settings-status">La configuración se guarda en este dispositivo.</span><div><button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="test-slm" type="button">Probar conexión</button><button class="primary-action" id="save-slm" type="submit">Guardar configuración</button></div></div></form></main></div>`

  const settingsForm = document.querySelector<HTMLFormElement>('#slm-config-form')!
  const settingsFooter = settingsForm.querySelector('.settings-footer')!
  settingsFooter.insertAdjacentHTML('beforebegin', `<div class="settings-section settings-section--prompts border-brand-line-light dark:!border-brand-line-dark"><div><span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">PROMPTS</span><h2>Contrato de revisión</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Personaliza las instrucciones sin alterar el formato que necesita la aplicación.</p></div><div class="prompt-fields"><label>Instrucciones de revisión<textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${promptConfig.reviewInstructions}</textarea><small class="text-brand-muted-light dark:!text-brand-muted-dark">Estas instrucciones se enviarán al agente SLM junto con el código.</small></label><label>Contrato de salida bloqueado<textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${reviewOutputContract}</textarea><small class="text-brand-muted-light dark:!text-brand-muted-dark">El contrato es de solo lectura para garantizar que los comentarios puedan asociarse a fichero y línea.</small></label></div></div>`)
  document.querySelector('#back-to-reviews')?.addEventListener('click', () => navigate('#/reviews'))
  document.querySelector('#settings-theme-toggle')?.addEventListener('click', toggleTheme)
  const loadModels = async (baseUrl: string) => {
    const modelSelect = document.querySelector<HTMLSelectElement>('#slm-model')!
    const modelHint = document.querySelector('#slm-model-hint')!
    const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-models')!
    const currentModel = modelSelect.value
    refreshButton.disabled = true
    refreshButton.classList.add('refresh-models--loading')
    modelHint.textContent = 'Consultando modelos disponibles...'
    try {
      const result = await testSlmConnection({ ...config, baseUrl })
      const modelIds = result.data?.map((model) => model.id).filter(Boolean) ?? []
      const availableModels = modelIds.includes(currentModel) || modelIds.length === 0 ? [currentModel, ...modelIds.filter((id) => id !== currentModel)] : modelIds
      modelSelect.innerHTML = availableModels.map((model) => `<option value="${model}" ${model === currentModel ? 'selected' : ''}>${model}</option>`).join('')
      modelHint.textContent = `${modelIds.length} modelos disponibles en el runtime.`
      modelHint.className = 'settings-hint settings-hint--success'
    } catch {
      modelHint.textContent = 'No se pudieron cargar los modelos. Puedes revisar la URL o iniciar el runtime.'
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
      status.textContent = 'Revisa los campos obligatorios antes de guardar.'
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
      status.textContent = 'Configuración guardada correctamente.'
      status.className = 'settings-status settings-status--success'
      saveButton.textContent = 'Guardado ✓'
      window.setTimeout(() => { saveButton.textContent = 'Guardar configuración' }, 1800)
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No se pudo guardar la configuración.'
      status.className = 'settings-status settings-status--error'
    }
  })
  document.querySelector('#test-slm')?.addEventListener('click', async () => {
    const form = document.querySelector<HTMLFormElement>('#slm-config-form')!
    const values = new FormData(form)
    const status = document.querySelector('#slm-config-status')!
    try {
      const result = await testSlmConnection({ baseUrl: String(values.get('baseUrl')), model: String(values.get('model')), temperature: Number(values.get('temperature')), maxTokens: Number(values.get('maxTokens')) })
      status.textContent = `${result.data?.length ?? 0} modelos disponibles en el runtime.`
      status.className = 'settings-status settings-status--success'
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No se pudo conectar con el runtime SLM.'
      status.className = 'settings-status settings-status--error'
    }
  })
}

function render(filter: 'active' | 'closed' = 'active') {
  if (currentScreen === 'settings') {
    renderSettings()
    return
  }
  const selectedReview = reviews.find((review) => review.id === selectedReviewId)
  if (selectedReview) {
    void renderReviewWorkspace(selectedReview)
    return
  }
  const visibleReviews = reviews.filter((review) => filter === 'closed' ? review.status === 'Cerrada' || review.status === 'Aprobada' : review.status !== 'Cerrada' && review.status !== 'Aprobada')
  const accessTokenField = hasRepositoryAccessToken()
    ? ''
    : '<label for="repository-token">Access token</label><input id="repository-token" name="repository-token" type="password" autocomplete="off" placeholder="Token de GitHub o GitLab" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><small class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">Se usara solo durante esta sesion y no se guardara en IndexedDB.</small>'
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">CR</span><span>CodeReview <b>AI</b></span></div>
        <div class="sidebar__section-label">Espacio de trabajo</div>
        <nav class="main-nav" aria-label="Navegacion principal"><button class="nav-item nav-item--active" type="button"><span class="nav-icon">▦</span> Revisiones <span class="nav-count">${reviews.filter((review) => review.status !== 'Cerrada' && review.status !== 'Aprobada').length}</span></button><button class="nav-item" type="button"><span class="nav-icon">◷</span> Historial</button></nav>
        <div class="sidebar__footer"><button class="nav-item" id="settings-nav" type="button"><span class="nav-icon">⚙</span> Configuracion</button><div class="session"><span class="avatar">AC</span><span><strong>Sesion local</strong><small>SLM conectado</small></span><span class="session-dot"></span></div></div>
      </aside>
      <main class="content bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
        <header class="topbar"><div><span class="eyebrow">CENTRO DE REVISION</span><h1>Revisiones</h1></div><button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="theme-toggle" type="button" aria-label="Cambiar tema">◐</button></header>
        <section class="intro bg-brand-secondary-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark"><div><h2>Revisa con criterio, decide con claridad.</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Orquesta el analisis local y la revision humana en un unico espacio.</p></div><button class="primary-action" id="new-review" type="button"><span>+</span> Nueva revision</button></section>
        <section class="stats" aria-label="Resumen de revisiones"><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">En curso</span><strong>${reviewKpis.activeReviews}</strong><span class="stat__detail stat__detail--positive">Revisiones activas</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">Pendientes de IA</span><strong>${reviewKpis.pendingSlmComments}</strong><span class="stat__detail text-brand-muted-light dark:!text-brand-muted-dark">Propuestas por revisar</span></div><div class="stat bg-brand-surface-light dark:!bg-brand-surface-dark"><span class="stat__label text-brand-muted-light dark:!text-brand-muted-dark">Comentarios publicados</span><strong>${reviewKpis.publishedComments}</strong><span class="stat__detail stat__detail--positive">Total</span></div></section>
        <div class="section-heading"><div><h2>${filter === 'closed' ? 'Revisiones cerradas' : 'Revisiones activas'}</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">${visibleReviews.length} procesos registrados</p></div><div class="tabs" role="tablist"><button class="tab ${filter === 'active' ? 'tab--active' : ''}" data-filter="active" type="button">Activas</button><button class="tab ${filter === 'closed' ? 'tab--active' : ''}" data-filter="closed" type="button">Cerradas</button></div></div>
        <section class="review-list">${visibleReviews.length ? visibleReviews.map(reviewCard).join('') : '<div class="empty-state border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><strong>No hay revisiones cerradas</strong><span>Las revisiones finalizadas apareceran aqui.</span></div>'}</section>
        <footer class="content-footer text-brand-muted-light dark:!text-brand-muted-dark"><span><span class="live-dot"></span> SLM local listo</span><span>Los datos permanecen en este dispositivo</span></footer>
      </main>
    </div>
    <dialog id="new-review-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark"><form method="dialog" id="new-review-form"><button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="Cerrar">×</button><span class="eyebrow">NUEVO PROCESO</span><h2>Conectar una revision</h2><p class="text-brand-muted-light dark:!text-brand-muted-dark">Introduce la URL de un Pull Request o Merge Request para comenzar.</p><label for="review-url">URL de la MR / PR</label><input id="review-url" name="review-url" type="url" placeholder="https://github.com/empresa/repo/pull/42" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"><div id="url-adapter-preview" class="url-adapter-preview hidden text-xs mt-1.5 p-2 rounded border bg-[#f3f6f4] dark:!bg-[#182521] border-brand-line-light dark:!border-brand-line-dark"></div>${accessTokenField}<small id="remote-request-status" class="token-hint text-brand-muted-light dark:!text-brand-muted-dark">Se adaptará automáticamente al endpoint de la API correspondiente antes de conectar.</small><div class="dialog-actions"><button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">Cancelar</button><button class="primary-action" id="connect-review" value="default">Continuar</button></div></form></dialog>
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
          <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">✓ Adaptado</span>
        </div>
        <div class="mt-1 text-[11px] text-brand-muted-light dark:!text-brand-muted-dark truncate" title="${info.endpoints.changeUrl}">
          <span class="opacity-75">Endpoint API:</span> <code class="font-mono text-[10px] text-[#30433a] dark:!text-[#9cb3a8]">${info.endpoints.changeUrl}</code>
        </div>
      `
    } else if (value.startsWith('http://') || value.startsWith('https://')) {
      urlAdapterPreview.classList.remove('hidden')
      urlAdapterPreview.innerHTML = `
        <div class="text-[11px] text-amber-600 dark:text-amber-400">
          Introduce una URL de GitHub (/pull/...) o GitLab (/-/merge_requests/...).
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
    updateUrlPreview()
    document.querySelector<HTMLDialogElement>('#new-review-dialog')?.showModal()
  })
  document.querySelector('#settings-nav')?.addEventListener('click', () => navigate('#/settings'))
  document.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme)
  document.querySelector<HTMLFormElement>('#new-review-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
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
      requestStatus.textContent = `Conectando con ${location.provider}...`
      connectButton.disabled = true
      const [change, files, comments] = await Promise.all([getRemoteChange(location), listRemoteFiles(location), listRemoteComments(location)])
      const reviewId = await createReview(url, { change, files, comments })
      void import('./review-runtime')
        .then(({ startReviewWorkflow }) => startReviewWorkflow(reviewId))
        .catch((error: unknown) => console.error('No se pudo iniciar el flujo LangGraph.', error))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar con la plataforma.'
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
}

async function start() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    await navigator.serviceWorker.register('./sw.js')
  }
  await refreshReviews()
  window.addEventListener('hashchange', applyRoute)
  onReviewProgress(async () => {
    await refreshReviews()
    if (currentScreen === 'reviews' && !selectedReviewId) render(currentFilter)
  })
  applyRoute()
}

void start()
