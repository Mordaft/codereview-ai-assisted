const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./pwa-update-DG8jqjxo.js","./index-CgGVkoJF.js","./rolldown-runtime-hePW80VL.js","./dexie-D3KjN6fK.js","./enums-5HL4wscD.js","./index-CaQeZNU9.css"])))=>i.map(i=>d[i]);
import{L as e,R as t,b as n,d as r,m as i,s as a,t as o,z as s}from"./index-CgGVkoJF.js";import{n as c,r as l,t as u}from"./review-prompts-BEeKHNk5.js";function d(d,f){let{navigate:p}=f,m=e(),h=u();d.innerHTML=`
    <div class="settings-shell bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="settings-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${i(`common.backToReviews`)}</button>
        <div>
          <span class="eyebrow">${i(`settings.eyebrow`)}</span>
          <h1>${i(`settings.title`)}</h1>
        </div>
        <div class="settings-header-actions flex items-center gap-2.5 ml-auto">
          <span class="settings-badge"><span class="live-dot"></span> ${i(`settings.localOnly`)}</span>
          ${a(`settings-lang-toggle`)}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="settings-theme-toggle" type="button" aria-label="${i(`common.toggleTheme`)}" title="${i(`common.toggleTheme`)}">◐</button>
        </div>
      </header>
      <main class="settings-content">
        <section class="settings-intro">
          <div class="settings-icon">✦</div>
          <div>
            <h2>${i(`settings.introTitle`)}</h2>
            <p class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.introDesc`)}</p>
          </div>
        </section>
        <form id="slm-config-form" class="settings-form bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" novalidate>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.connEyebrow`)}</span>
              <h2>${i(`settings.connTitle`)}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.connDesc`)}</p>
            </div>
            <div class="form-grid">
              <label>
                ${i(`settings.runtimeUrlLabel`)}
                <input id="slm-base-url" name="baseUrl" type="url" value="${m.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.runtimeUrlHint`)}</small>
              </label>
              <label>
                ${i(`settings.slmModelLabel`)}
                <div class="model-selector">
                  <select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                    <option value="${m.model}" selected>${m.model}</option>
                  </select>
                  <button class="refresh-models bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="refresh-models" type="button" aria-label="${i(`settings.refreshModelsTitle`)}" title="${i(`settings.refreshModelsTitle`)}">↻</button>
                </div>
                <small id="slm-model-hint">${i(`settings.loadingModels`)}</small>
              </label>
            </div>
          </div>
          <div class="settings-section border-brand-line-light dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.inferenceEyebrow`)}</span>
              <h2>${i(`settings.inferenceTitle`)}</h2>
              <p class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.inferenceDesc`)}</p>
            </div>
            <div class="form-grid form-grid--compact">
              <label>
                ${i(`settings.tempLabel`)}
                <input name="temperature" type="number" value="${m.temperature}" min="0" max="2" step="0.1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.tempHint`)}</small>
              </label>
              <label>
                ${i(`settings.maxTokensLabel`)}
                <input name="maxTokens" type="number" value="${m.maxTokens}" min="256" max="32768" step="256" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.maxTokensHint`)}</small>
              </label>
            </div>
          </div>
          <div class="settings-footer border-brand-line-light dark:!border-brand-line-dark">
            <span id="slm-config-status" class="settings-status">${i(`settings.statusNotice`)}</span>
            <div>
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="test-slm" type="button">${i(`settings.testBtn`)}</button>
              <button class="primary-action" id="save-slm" type="submit">${i(`settings.saveBtn`)}</button>
            </div>
          </div>
        </form>
      </main>
    </div>
  `,document.querySelector(`#slm-config-form`).querySelector(`.settings-footer`).insertAdjacentHTML(`beforebegin`,`<div class="settings-section settings-section--prompts border-brand-line-light dark:!border-brand-line-dark">
      <div>
        <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.promptsEyebrow`)}</span>
        <h2>${i(`settings.promptsTitle`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.promptsDesc`)}</p>
      </div>
      <div class="prompt-fields">
        <label>
          ${i(`settings.instructionsLabel`)}
          <textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${h.reviewInstructions}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.instructionsHint`)}</small>
        </label>
        <label>
          ${i(`settings.contractLabel`)}
          <textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${c}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.contractHint`)}</small>
        </label>
      </div>
    </div>
    <div class="settings-section settings-section--storage border-brand-line-light dark:!border-brand-line-dark">
      <div>
        <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.storageEyebrow`)}</span>
        <h2>${i(`settings.storageTitle`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${i(`settings.storageDesc`)}</p>
      </div>
      <div class="storage-actions flex flex-wrap items-center gap-3 mt-4">
        <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="check-pwa-updates" type="button">
          ↻ ${i(`pwa.checkUpdatesBtn`)}
        </button>
        <button class="outline-action bg-brand-surface-light text-red-600 border-red-300 hover:bg-red-50 dark:!bg-brand-surface-dark dark:!text-red-400 dark:!border-red-900 dark:hover:!bg-red-950/30" id="reset-pwa-data" type="button">
          ⚠ ${i(`settings.resetDataBtn`)}
        </button>
        <span id="pwa-update-status" class="text-xs text-brand-muted-light dark:!text-brand-muted-dark"></span>
      </div>
    </div>`),document.querySelector(`#check-pwa-updates`)?.addEventListener(`click`,async()=>{let e=document.querySelector(`#pwa-update-status`);e&&(e.textContent=i(`pwa.checkingUpdates`));let{checkForUpdates:t}=await o(async()=>{let{checkForUpdates:e}=await import(`./pwa-update-DG8jqjxo.js`);return{checkForUpdates:e}},__vite__mapDeps([0,1,2,3,4,5]),import.meta.url),n=await t();e&&(e.textContent=n.message)}),document.querySelector(`#reset-pwa-data`)?.addEventListener(`click`,async()=>{if(window.confirm(i(`settings.resetDataConfirm`))){let e=document.querySelector(`#pwa-update-status`);e&&(e.textContent=i(`settings.resetDataSuccess`));let{resetDatabaseAndCache:t}=await o(async()=>{let{resetDatabaseAndCache:e}=await import(`./index-CgGVkoJF.js`).then(e=>e.j);return{resetDatabaseAndCache:e}},__vite__mapDeps([1,2,3,4,5]),import.meta.url);await t()}}),document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>p(`#/reviews`)),document.querySelector(`#settings-theme-toggle`)?.addEventListener(`click`,r),document.querySelector(`#settings-lang-toggle`)?.addEventListener(`click`,()=>n());let g=async e=>{let t=document.querySelector(`#slm-model`),n=document.querySelector(`#slm-model-hint`),r=document.querySelector(`#refresh-models`),a=t.value;r.disabled=!0,r.classList.add(`refresh-models--loading`),n.textContent=i(`settings.loadingModels`);try{let r=(await s({...m,baseUrl:e})).data?.map(e=>e.id).filter(Boolean)??[];t.innerHTML=(r.includes(a)||r.length===0?[a,...r.filter(e=>e!==a)]:r).map(e=>`<option value="${e}" ${e===a?`selected`:``}>${e}</option>`).join(``),n.textContent=i(`settings.modelsAvailable`,{count:r.length}),n.className=`settings-hint settings-hint--success`}catch{n.textContent=i(`settings.modelsError`),n.className=`settings-hint settings-hint--error`}finally{r.disabled=!1,r.classList.remove(`refresh-models--loading`)}};document.querySelector(`#slm-base-url`)?.addEventListener(`change`,e=>void g(e.target.value)),document.querySelector(`#refresh-models`)?.addEventListener(`click`,()=>void g(document.querySelector(`#slm-base-url`).value)),g(m.baseUrl),document.querySelector(`#slm-config-form`)?.addEventListener(`submit`,e=>{e.preventDefault();let n=e.currentTarget,r=document.querySelector(`#slm-config-status`);if(!n.checkValidity()){r.textContent=i(`settings.errorRequired`),r.className=`settings-status settings-status--error`,n.reportValidity();return}let a=new FormData(n),o={baseUrl:String(a.get(`baseUrl`)),model:String(a.get(`model`)),temperature:Number(a.get(`temperature`)),maxTokens:Number(a.get(`maxTokens`))},s={reviewInstructions:String(a.get(`reviewInstructions`))},c=document.querySelector(`#save-slm`);try{t(o),l(s),r.textContent=i(`settings.savedSuccess`),r.className=`settings-status settings-status--success`,c.textContent=i(`settings.saveBtnSuccess`),window.setTimeout(()=>{c.textContent=i(`settings.saveBtn`)},1800)}catch(e){r.textContent=e instanceof Error?e.message:i(`settings.errorSave`),r.className=`settings-status settings-status--error`}}),document.querySelector(`#test-slm`)?.addEventListener(`click`,async()=>{let e=document.querySelector(`#slm-config-form`),t=new FormData(e),n=document.querySelector(`#slm-config-status`);try{let e=await s({baseUrl:String(t.get(`baseUrl`)),model:String(t.get(`model`)),temperature:Number(t.get(`temperature`)),maxTokens:Number(t.get(`maxTokens`))});n.textContent=i(`settings.modelsAvailable`,{count:e.data?.length??0}),n.className=`settings-status settings-status--success`}catch(e){n.textContent=e instanceof Error?e.message:i(`settings.errorTest`),n.className=`settings-status settings-status--error`}})}export{d as renderSettings};