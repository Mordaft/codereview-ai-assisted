import{G as e,K as t,W as n,b as r,d as i,m as a,s as o}from"./index-DvYkLLok.js";import{n as s,r as c,t as l}from"./review-prompts-BEeKHNk5.js";function u(u,d){let{navigate:f}=d,p=n(),m=l();u.innerHTML=`
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
                <input id="slm-base-url" name="baseUrl" type="url" value="${p.baseUrl}" placeholder="http://localhost:11434/v1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.runtimeUrlHint`)}</small>
              </label>
              <label>
                ${a(`settings.slmModelLabel`)}
                <div class="model-selector">
                  <select id="slm-model" name="model" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                    <option value="${p.model}" selected>${p.model}</option>
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
              <label>
                ${a(`settings.tempLabel`)}
                <input name="temperature" type="number" value="${p.temperature}" min="0" max="2" step="0.1" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.tempHint`)}</small>
              </label>
              <label>
                ${a(`settings.maxTokensLabel`)}
                <input name="maxTokens" type="number" value="${p.maxTokens}" min="256" max="32768" step="256" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
                <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.maxTokensHint`)}</small>
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
          <textarea id="review-instructions" name="reviewInstructions" rows="7" required class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">${m.reviewInstructions}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.instructionsHint`)}</small>
        </label>
        <label>
          ${a(`settings.contractLabel`)}
          <textarea class="prompt-contract bg-[#f1f4f1] border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark" rows="10" readonly aria-readonly="true">${s}</textarea>
          <small class="text-brand-muted-light dark:!text-brand-muted-dark">${a(`settings.contractHint`)}</small>
        </label>
      </div>
    </div>`),document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>f(`#/reviews`)),document.querySelector(`#settings-theme-toggle`)?.addEventListener(`click`,i),document.querySelector(`#settings-lang-toggle`)?.addEventListener(`click`,()=>r());let h=async e=>{let n=document.querySelector(`#slm-model`),r=document.querySelector(`#slm-model-hint`),i=document.querySelector(`#refresh-models`),o=n.value;i.disabled=!0,i.classList.add(`refresh-models--loading`),r.textContent=a(`settings.loadingModels`);try{let i=(await t({...p,baseUrl:e})).data?.map(e=>e.id).filter(Boolean)??[];n.innerHTML=(i.includes(o)||i.length===0?[o,...i.filter(e=>e!==o)]:i).map(e=>`<option value="${e}" ${e===o?`selected`:``}>${e}</option>`).join(``),r.textContent=a(`settings.modelsAvailable`,{count:i.length}),r.className=`settings-hint settings-hint--success`}catch{r.textContent=a(`settings.modelsError`),r.className=`settings-hint settings-hint--error`}finally{i.disabled=!1,i.classList.remove(`refresh-models--loading`)}};document.querySelector(`#slm-base-url`)?.addEventListener(`change`,e=>void h(e.target.value)),document.querySelector(`#refresh-models`)?.addEventListener(`click`,()=>void h(document.querySelector(`#slm-base-url`).value)),h(p.baseUrl),document.querySelector(`#slm-config-form`)?.addEventListener(`submit`,t=>{t.preventDefault();let n=t.currentTarget,r=document.querySelector(`#slm-config-status`);if(!n.checkValidity()){r.textContent=a(`settings.errorRequired`),r.className=`settings-status settings-status--error`,n.reportValidity();return}let i=new FormData(n),o={baseUrl:String(i.get(`baseUrl`)),model:String(i.get(`model`)),temperature:Number(i.get(`temperature`)),maxTokens:Number(i.get(`maxTokens`))},s={reviewInstructions:String(i.get(`reviewInstructions`))},l=document.querySelector(`#save-slm`);try{e(o),c(s),r.textContent=a(`settings.savedSuccess`),r.className=`settings-status settings-status--success`,l.textContent=a(`settings.saveBtnSuccess`),window.setTimeout(()=>{l.textContent=a(`settings.saveBtn`)},1800)}catch(e){r.textContent=e instanceof Error?e.message:a(`settings.errorSave`),r.className=`settings-status settings-status--error`}}),document.querySelector(`#test-slm`)?.addEventListener(`click`,async()=>{let e=document.querySelector(`#slm-config-form`),n=new FormData(e),r=document.querySelector(`#slm-config-status`);try{let e=await t({baseUrl:String(n.get(`baseUrl`)),model:String(n.get(`model`)),temperature:Number(n.get(`temperature`)),maxTokens:Number(n.get(`maxTokens`))});r.textContent=a(`settings.modelsAvailable`,{count:e.data?.length??0}),r.className=`settings-status settings-status--success`}catch(e){r.textContent=e instanceof Error?e.message:a(`settings.errorTest`),r.className=`settings-status settings-status--error`}})}export{u as renderSettings};