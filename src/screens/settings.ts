import { getSlmConfig, saveSlmConfig, testSlmConnection, type SlmConfig } from '../slm-config'
import { getReviewPromptConfig, reviewOutputContract, saveReviewPromptConfig } from '../review-prompts'
import { t, toggleLanguage } from '../i18n'
import { renderLangToggle, toggleTheme } from './shared'

export interface SettingsOptions {
  navigate: (hash: string) => void
}

export function renderSettings(app: HTMLElement, options: SettingsOptions) {
  const { navigate } = options
  const config = getSlmConfig()
  const promptConfig = getReviewPromptConfig()

  app.innerHTML = `
    <div class="settings-shell bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="settings-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${t('common.backToReviews')}</button>
        <div>
          <span class="eyebrow">${t('settings.eyebrow')}</span>
          <h1>${t('settings.title')}</h1>
        </div>
        <div class="settings-header-actions flex items-center gap-2.5 ml-auto">
          <span class="settings-badge"><span class="live-dot"></span> ${t('settings.localOnly')}</span>
          ${renderLangToggle('settings-lang-toggle')}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="settings-theme-toggle" type="button" aria-label="${t('common.toggleTheme')}" title="${t('common.toggleTheme')}">◐</button>
        </div>
      </header>
      <main class="settings-content">
        <section class="settings-intro">
          <div class="settings-icon">✦</div>
          <div>
            <h2>${t('settings.introTitle')}</h2>
            <p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.introDesc')}</p>
          </div>
        </section>
        <form id="slm-config-form" class="settings-form bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" novalidate>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.connEyebrow')}</span>
              <h2>${t('settings.connTitle')}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.connDesc')}</p>
            </div>
            <div class="form-grid">
              <label>
                ${t('settings.runtimeUrlLabel')}
                <input id="slm-base-url" name="baseUrl" type="url" value="${config.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.runtimeUrlHint')}</small>
              </label>
              <label>
                ${t('settings.slmModelLabel')}
                <div class="model-selector">
                  <select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                    <option value="${config.model}" selected>${config.model}</option>
                  </select>
                  <button class="refresh-models bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="refresh-models" type="button" aria-label="${t('settings.refreshModelsTitle')}" title="${t('settings.refreshModelsTitle')}">↻</button>
                </div>
                <small id="slm-model-hint">${t('settings.loadingModels')}</small>
              </label>
            </div>
          </div>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.inferenceEyebrow')}</span>
              <h2>${t('settings.inferenceTitle')}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.inferenceDesc')}</p>
            </div>
            <div class="form-grid form-grid--compact">
              <label>
                ${t('settings.tempLabel')}
                <input name="temperature" type="number" value="${config.temperature}" min="0" max="2" step="0.1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.tempHint')}</small>
              </label>
              <label>
                ${t('settings.maxTokensLabel')}
                <input name="maxTokens" type="number" value="${config.maxTokens}" min="256" max="32768" step="256" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.maxTokensHint')}</small>
              </label>
            </div>
          </div>
          <div class="settings-footer border-brand-line-light dark:!border-brand-line-dark">
            <span id="slm-config-status" class="settings-status">${t('settings.statusNotice')}</span>
            <div>
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="test-slm" type="button">${t('settings.testBtn')}</button>
              <button class="primary-action" id="save-slm" type="submit">${t('settings.saveBtn')}</button>
            </div>
          </div>
        </form>
      </main>
    </div>
  `

  const settingsForm = document.querySelector<HTMLFormElement>('#slm-config-form')!
  const settingsFooter = settingsForm.querySelector('.settings-footer')!
  settingsFooter.insertAdjacentHTML(
    'beforebegin',
    `<div class="settings-section settings-section--prompts border-brand-line-light dark:!border-brand-line-dark">
      <div>
        <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.promptsEyebrow')}</span>
        <h2>${t('settings.promptsTitle')}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.promptsDesc')}</p>
      </div>
      <div class="prompt-fields">
        <label>
          ${t('settings.instructionsLabel')}
          <textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${promptConfig.reviewInstructions}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.instructionsHint')}</small>
        </label>
        <label>
          ${t('settings.contractLabel')}
          <textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${reviewOutputContract}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${t('settings.contractHint')}</small>
        </label>
      </div>
    </div>`
  )

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
      const availableModels =
        modelIds.includes(currentModel) || modelIds.length === 0
          ? [currentModel, ...modelIds.filter((id) => id !== currentModel)]
          : modelIds
      modelSelect.innerHTML = availableModels
        .map((model) => `<option value="${model}" ${model === currentModel ? 'selected' : ''}>${model}</option>`)
        .join('')
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

  document.querySelector('#slm-base-url')?.addEventListener('change', (event) =>
    void loadModels((event.target as HTMLInputElement).value)
  )
  document.querySelector('#refresh-models')?.addEventListener('click', () =>
    void loadModels((document.querySelector('#slm-base-url') as HTMLInputElement).value)
  )
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
    const nextConfig: SlmConfig = {
      baseUrl: String(form.get('baseUrl')),
      model: String(form.get('model')),
      temperature: Number(form.get('temperature')),
      maxTokens: Number(form.get('maxTokens')),
    }
    const nextPrompts = { reviewInstructions: String(form.get('reviewInstructions')) }
    const saveButton = document.querySelector<HTMLButtonElement>('#save-slm')!
    try {
      saveSlmConfig(nextConfig)
      saveReviewPromptConfig(nextPrompts)
      status.textContent = t('settings.savedSuccess')
      status.className = 'settings-status settings-status--success'
      saveButton.textContent = t('settings.saveBtnSuccess')
      window.setTimeout(() => {
        saveButton.textContent = t('settings.saveBtn')
      }, 1800)
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
      const result = await testSlmConnection({
        baseUrl: String(values.get('baseUrl')),
        model: String(values.get('model')),
        temperature: Number(values.get('temperature')),
        maxTokens: Number(values.get('maxTokens')),
      })
      status.textContent = t('settings.modelsAvailable', { count: result.data?.length ?? 0 })
      status.className = 'settings-status settings-status--success'
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : t('settings.errorTest')
      status.className = 'settings-status settings-status--error'
    }
  })
}
