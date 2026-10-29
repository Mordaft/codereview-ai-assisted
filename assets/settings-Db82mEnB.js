const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./pwa-update-Cu--4z07.js","./index-TAWtDCVW.js","./rolldown-runtime-XKyaHtl9.js","./dexie-CCJHRl8V.js","./langgraph-_A8W2zlL.js","./enums-5HL4wscD.js","./index-CbRxoG4b.css"])))=>i.map(i=>d[i]);
import{H as e,U as t,V as n,b as r,d as i,m as a,s as o,t as s}from"./index-TAWtDCVW.js";import{n as c,r as l,t as u}from"./review-prompts-uUYiUO0E.js";function d(d,f){let{navigate:p}=f,m=n(),h=u();d.innerHTML=`
    <div class="settings-shell bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="settings-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${a(`common.backToReviews`)}</button>
        <div>
          <span class="eyebrow">${a(`settings.eyebrow`)}</span>
          <h1>${a(`settings.title`)}</h1>
        </div>
        <div class="settings-header-actions flex items-center gap-2.5 ml-auto">
          <span class="settings-badge"><span class="live-dot"></span> ${a(`settings.localOnly`)}</span>
          ${o(`settings-lang-toggle`)}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="settings-theme-toggle" type="button" aria-label="${a(`common.toggleTheme`)}" title="${a(`common.toggleTheme`)}">◐</button>
        </div>
      </header>
      <main class="settings-content">
        <section class="settings-intro">
          <div class="settings-icon">✦</div>
          <div>
            <h2>${a(`settings.introTitle`)}</h2>
            <p class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.introDesc`)}</p>
          </div>
        </section>
        <form id="slm-config-form" class="settings-form bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" novalidate>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.connEyebrow`)}</span>
              <h2>${a(`settings.connTitle`)}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.connDesc`)}</p>
            </div>
            <div class="form-grid">
              <label>
                ${a(`settings.runtimeUrlLabel`)}
                <input id="slm-base-url" name="baseUrl" type="url" value="${m.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.runtimeUrlHint`)}</small>
              </label>
              <label>
                ${a(`settings.slmModelLabel`)}
                <div class="model-selector">
                  <select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                    <option value="${m.model}" selected>${m.model}</option>
                  </select>
                  <button class="refresh-models bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="refresh-models" type="button" aria-label="${a(`settings.refreshModelsTitle`)}" title="${a(`settings.refreshModelsTitle`)}">↻</button>
                </div>
                <small id="slm-model-hint">${a(`settings.loadingModels`)}</small>
              </label>
            </div>
          </div>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.inferenceEyebrow`)}</span>
              <h2>${a(`settings.inferenceTitle`)}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.inferenceDesc`)}</p>
            </div>
            <div class="form-grid form-grid--compact">
              <label for="slm-temperature">
                ${a(`settings.tempLabel`)}
                <input id="slm-temperature" name="temperature" type="number" value="${m.temperature}" min="0" max="2" step="0.1" aria-describedby="slm-temperature-hint" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small id="slm-temperature-hint" class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.tempHint`)}</small>
              </label>
              <label for="slm-max-tokens">
                ${a(`settings.maxTokensLabel`)}
                <input id="slm-max-tokens" name="maxTokens" type="number" value="${m.maxTokens}" min="256" max="32768" step="256" aria-describedby="slm-max-tokens-hint" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small id="slm-max-tokens-hint" class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.maxTokensHint`)}</small>
              </label>
              <label for="slm-max-depth">
                ${a(`settings.maxDepthLabel`)}
                <input id="slm-max-depth" name="maxDepth" type="number" value="${m.maxDepth}" min="1" max="5" step="1" aria-describedby="slm-max-depth-hint" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small id="slm-max-depth-hint" class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.maxDepthHint`)}</small>
              </label>
              <label for="slm-max-concurrency">
                ${a(`settings.maxConcurrencyLabel`)}
                <input id="slm-max-concurrency" name="maxConcurrency" type="number" value="${m.maxConcurrency}" min="1" max="6" step="1" aria-describedby="slm-max-concurrency-hint" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small id="slm-max-concurrency-hint" class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.maxConcurrencyHint`)}</small>
              </label>
            </div>
          </div>
          <div class="settings-footer border-brand-line-light dark:!border-brand-line-dark">
            <span id="slm-config-status" class="settings-status">${a(`settings.statusNotice`)}</span>
            <div>
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="test-slm" type="button">${a(`settings.testBtn`)}</button>
              <button class="primary-action" id="save-slm" type="submit">${a(`settings.saveBtn`)}</button>
            </div>
          </div>
        </form>
      </main>
    </div>
  `,document.querySelector(`#slm-config-form`).querySelector(`.settings-footer`).insertAdjacentHTML(`beforebegin`,`<div class="settings-section settings-section--prompts border-brand-line-light dark:!border-brand-line-dark">
      <div>
        <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.promptsEyebrow`)}</span>
        <h2>${a(`settings.promptsTitle`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.promptsDesc`)}</p>
      </div>
      <div class="prompt-fields">
        <label>
          ${a(`settings.instructionsLabel`)}
          <textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${h.reviewInstructions}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.instructionsHint`)}</small>
        </label>
        <label>
          ${a(`settings.contractLabel`)}
          <textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${c}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.contractHint`)}</small>
        </label>
      </div>
    </div>
    <div class="settings-section settings-section--storage border-brand-line-light dark:!border-brand-line-dark">
      <div>
        <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.storageEyebrow`)}</span>
        <h2>${a(`settings.storageTitle`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.storageDesc`)}</p>
      </div>
      <div class="storage-actions flex flex-wrap items-center gap-3 mt-4">
        <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="check-pwa-updates" type="button">
          ↻ ${a(`pwa.checkUpdatesBtn`)}
        </button>
        <button class="outline-action bg-brand-surface-light text-red-600 border-red-300 hover:bg-red-50 dark:!bg-brand-surface-dark dark:!text-red-400 dark:!border-red-900 dark:hover:!bg-red-950/30" id="reset-pwa-data" type="button">
          ⚠ ${a(`settings.resetDataBtn`)}
        </button>
        <span id="pwa-update-status" class="text-xs text-brand-muted-light dark:!text-brand-muted-dark"></span>
      </div>
    </div>`),document.querySelector(`#check-pwa-updates`)?.addEventListener(`click`,async()=>{let e=document.querySelector(`#pwa-update-status`);e&&(e.textContent=a(`pwa.checkingUpdates`));let{checkForUpdates:t}=await s(async()=>{let{checkForUpdates:e}=await import(`./pwa-update-Cu--4z07.js`);return{checkForUpdates:e}},__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url),n=await t();e&&(e.textContent=n.message)}),document.querySelector(`#reset-pwa-data`)?.addEventListener(`click`,async()=>{if(window.confirm(a(`settings.resetDataConfirm`))){let e=document.querySelector(`#pwa-update-status`);e&&(e.textContent=a(`settings.resetDataSuccess`));let{resetDatabaseAndCache:t}=await s(async()=>{let{resetDatabaseAndCache:e}=await import(`./index-TAWtDCVW.js`).then(e=>e.j);return{resetDatabaseAndCache:e}},__vite__mapDeps([1,2,3,4,5,6]),import.meta.url);await t()}}),document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>p(`#/reviews`)),document.querySelector(`#settings-theme-toggle`)?.addEventListener(`click`,i),document.querySelector(`#settings-lang-toggle`)?.addEventListener(`click`,()=>r());let g=async e=>{let n=document.querySelector(`#slm-model`),r=document.querySelector(`#slm-model-hint`),i=document.querySelector(`#refresh-models`),o=n.value;i.disabled=!0,i.classList.add(`refresh-models--loading`),r.textContent=a(`settings.loadingModels`);try{let i=(await t({...m,baseUrl:e})).data?.map(e=>e.id).filter(Boolean)??[];n.innerHTML=(i.includes(o)||i.length===0?[o,...i.filter(e=>e!==o)]:i).map(e=>`<option value="${e}" ${e===o?`selected`:``}>${e}</option>`).join(``),r.textContent=a(`settings.modelsAvailable`,{count:i.length}),r.className=`settings-hint settings-hint--success`}catch{r.textContent=a(`settings.modelsError`),r.className=`settings-hint settings-hint--error`}finally{i.disabled=!1,i.classList.remove(`refresh-models--loading`)}};document.querySelector(`#slm-base-url`)?.addEventListener(`change`,e=>void g(e.target.value)),document.querySelector(`#refresh-models`)?.addEventListener(`click`,()=>void g(document.querySelector(`#slm-base-url`).value)),g(m.baseUrl),document.querySelector(`#slm-config-form`)?.addEventListener(`submit`,t=>{t.preventDefault();let n=t.currentTarget,r=document.querySelector(`#slm-config-status`);if(!n.checkValidity()){r.textContent=a(`settings.errorRequired`),r.className=`settings-status settings-status--error`,n.reportValidity();return}let i=new FormData(n),o={baseUrl:String(i.get(`baseUrl`)),model:String(i.get(`model`)),temperature:Number(i.get(`temperature`)),maxTokens:Number(i.get(`maxTokens`)),maxDepth:Number(i.get(`maxDepth`)||m.maxDepth),maxConcurrency:Number(i.get(`maxConcurrency`)||m.maxConcurrency)},s={reviewInstructions:String(i.get(`reviewInstructions`))},c=document.querySelector(`#save-slm`);try{e(o),l(s),r.textContent=a(`settings.savedSuccess`),r.className=`settings-status settings-status--success`,c.textContent=a(`settings.saveBtnSuccess`),window.setTimeout(()=>{c.textContent=a(`settings.saveBtn`)},1800)}catch(e){r.textContent=e instanceof Error?e.message:a(`settings.errorSave`),r.className=`settings-status settings-status--error`}}),document.querySelector(`#test-slm`)?.addEventListener(`click`,async()=>{let e=document.querySelector(`#slm-config-form`),n=new FormData(e),r=document.querySelector(`#slm-config-status`);try{let e=await t({baseUrl:String(n.get(`baseUrl`)),model:String(n.get(`model`)),temperature:Number(n.get(`temperature`)),maxTokens:Number(n.get(`maxTokens`)),maxDepth:Number(n.get(`maxDepth`)||m.maxDepth),maxConcurrency:Number(n.get(`maxConcurrency`)||m.maxConcurrency)});r.textContent=a(`settings.modelsAvailable`,{count:e.data?.length??0}),r.className=`settings-status settings-status--success`}catch(e){r.textContent=e instanceof Error?e.message:a(`settings.errorTest`),r.className=`settings-status settings-status--error`}})}export{d as renderSettings};