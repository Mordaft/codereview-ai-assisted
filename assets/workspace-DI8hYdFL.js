const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./review-runtime-DAsbGlOA.js","./langgraph-_A8W2zlL.js","./rolldown-runtime-XKyaHtl9.js","./enums-5HL4wscD.js","./index-DrT3h0Su.js","./dexie-CCJHRl8V.js","./index-BTv6DlD_.css","./review-prompts-uUYiUO0E.js"])))=>i.map(i=>d[i]);
import{a as e,i as t,l as n,n as r,o as i,r as a,s as o}from"./enums-5HL4wscD.js";import{A as s,C as c,D as ee,I as te,O as l,P as ne,_ as u,a as d,b as f,d as re,g as p,h as m,l as ie,m as h,q as g,s as ae,t as _,u as oe,v,w as y,y as b}from"./index-DrT3h0Su.js";import{i as x}from"./platform-api-fDSFuGnd.js";function S(e){if(e==null)return i.PENDING;if(typeof e==`number`&&(e===i.DESIRABLE||e===i.IMPORTANT||e===i.BLOCKING||e===i.PENDING))return e;if(typeof e==`string`)switch(e.toLowerCase().trim()){case`1`:case`deseable`:case`desirable`:return i.DESIRABLE;case`2`:case`importante`:case`important`:return i.IMPORTANT;case`3`:case`bloqueante`:case`blocking`:return i.BLOCKING;default:return i.PENDING}return i.PENDING}async function se(e){if(!e.id||!e.remoteChange?.webUrl)return;let n=(await l(e.id)).filter(e=>e.decision!==a.PUBLISHED);if(!n.length)return;let r=g(e.remoteChange.webUrl);for(let e of n){let n=e.path?`${e.path}${e.line?`:`+e.line:``}`:h(`workspace.generalComment`),i=`**[${v(e.severity??t.MEDIUM)}]** ${n}\n\n${e.body}`;await x(r,{body:i}),e.id&&await s(e.id)}}async function C(a,s){let{review:g,activeFileIndex:x=0,navigate:w,refreshReviews:T,onFileSelect:E}=s,D=g.status===n.APPROVED||g.status===n.CLOSED||g.status===`Aprobada`||g.status===`Cerrada`,O=d(g),k=g.id?await l(g.id):[],A=g.remoteFiles?.length?g.remoteFiles.map(e=>({path:e.path,type:e.path.split(`.`).at(-1)?.toUpperCase()??`TXT`,lines:(e.content??e.patch??h(`workspace.noFilesDownloadedText`)).split(`
`)})):[{path:h(`workspace.noFilesDownloaded`),type:`TXT`,lines:[h(`workspace.noFilesDownloadedText`)]}],j=k.length?k.map(e=>({id:e.id,file:e.path,line:e.line,severity:e.severity??t.MEDIUM,message:e.body,author:m(e.author,e.source),category:e.category??r.SOLID,decision:S(e.decision),source:e.source})):g.remoteComments?.length?g.remoteComments.map(n=>({id:void 0,file:n.path,line:n.line,severity:t.MEDIUM,message:n.body,author:m(n.author,e.REMOTE),category:r.SOLID,decision:i.PENDING,source:e.REMOTE})):[],M=A[x]??A[0],N=j.filter(e=>!e.file||e.file===M.path),P=new Map;for(let e of j){if(!e.file)continue;let t=P.get(e.file)??[];t.push(e),P.set(e.file,t)}let F=g.id?c(g.id):void 0,I=F&&F.phase!==`completed`?`<span class="status status--thinking"><span class="thinking-pulse"></span>${F?.phase===`suggesting`?h(`reviews.card.generatingProposals`):h(`reviews.card.slmThinking`)}</span>`:`<span class="status status--${oe(g.status)}"><span></span>${b(g.status)}</span>`;a.innerHTML=`
    <div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${h(`common.backToReviews`)}</button>
        <div class="workspace-title">
          <span class="provider provider--${g.provider.toLowerCase()}">${g.provider}</span>
          <strong class="text-brand-primary-light dark:!text-brand-primary-dark">${g.title}</strong>
          <span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${g.repository}</span>
        </div>
        <div class="workspace-actions">
          ${I}
          ${D?`<button class="primary-action" data-decision="${o.REOPEN}" type="button">${h(`common.reopen`)}</button>`:O?`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${o.CLOSE}" type="button">${h(`common.close`)}</button>`:`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${o.CLOSE}" type="button">${h(`common.close`)}</button><button class="primary-action" data-decision="${o.APPROVE}" type="button">${h(`workspace.approveLocally`)}</button>`}
          ${ae(`workspace-lang-toggle`)}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="${h(`common.toggleTheme`)}" title="${h(`common.toggleTheme`)}">◐</button>
        </div>
      </header>
      <div class="workspace-grid">
        <aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${h(`workspace.modifiedFiles`)} <span class="panel-counter">${A.length}</span></div>
          <div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${g.repository}</div>
          ${A.map((e,n)=>{let r=P.get(e.path)??[],i=r.length,a=r.some(e=>e.severity===t.HIGH||e.severity===`alta`)?`comment-badge comment-badge--alta`:`comment-badge`,o=h(`workspace.reviewProposalBadge`,{count:i,label:h(i===1?`workspace.proposalWordSingular`:`workspace.proposalWordPlural`)});return`<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${n===x?`file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark`:`hover:dark:!bg-[#263730]`}" data-file-index="${n}" type="button"><span class="file-type">${e.type}</span><span class="file-name" title="${e.path}">${e.path}</span>${i>0?`<span class="${a}" title="${o}" aria-label="${o}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${i}</span></span>`:``}</button>`}).join(``)}
          <div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${h(`workspace.commentsCount`,{count:j.length})}</div>
        </aside>
        <main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark">
          <div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${M.path}</strong>
              <span class="text-brand-muted-light dark:!text-brand-muted-dark">${h(`workspace.diffView`,{lines:M.lines.length})}</span>
            </div>
            <div class="code-toolbar__actions">
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">${h(`workspace.newProposal`)}</button>
            </div>
          </div>
          <div class="code-frame">
            ${M.lines.map((e,t)=>{let n=t+1,r=N.filter(e=>e.line===n);return`<div class="code-line ${r.length?`code-line--commented dark:!bg-[#352f19]`:``}" data-line="${n}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${n}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${e.replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`)}</code>${r.length?`<span class="line-marker" title="${h(`workspace.lineCommentsMarker`,{count:r.length})}">●</span>`:``}</div>`}).join(``)}
          </div>
        </main>
        <aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${h(`workspace.commentsPanelTitle`)}</span>
              <h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${N.length===1?h(`workspace.singleProposalCount`):h(`workspace.proposalsCount`,{count:N.length})}</h2>
              <small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${M.path}</small>
            </div>
          </div>
          ${N.length?N.map(e=>`<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${e.id??``}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${ie(e.severity)}">${v(e.severity)}</span><span>${e.file?`${e.file}${e.line?`:`+e.line:``}`:h(`workspace.globalProposal`)}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${e.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${e.author} · ${p(e.category)} · ${u(e.decision)}</small>${e.id&&!D?`<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${h(`common.edit`)}</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${h(`common.delete`)}</button></div>`:``}</article>`).join(``):`<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">${h(`workspace.emptyComments`)}</div>`}
        </aside>
      </div>
    </div>
    <dialog id="new-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="new-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel" aria-label="${h(`common.close`)}">×</button>
        <span class="eyebrow">${h(`dialogs.proposal.eyebrow`)}</span>
        <h2 id="new-proposal-title">${h(`dialogs.proposal.addTitle`)}</h2>
        <p id="new-proposal-hint" class="text-brand-muted-light dark:!text-brand-muted-dark"></p>
        <label for="proposal-message">${h(`dialogs.proposal.descLabel`)}</label>
        <textarea id="proposal-message" name="proposal-message" rows="3" required placeholder="${h(`dialogs.proposal.descPlaceholder`)}" class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"></textarea>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-author">${h(`dialogs.proposal.authorLabel`)}</label>
            <input id="proposal-author" name="proposal-author" type="text" readonly class="proposal-input proposal-input--readonly bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark">
          </div>
          <div class="proposal-field">
            <label for="proposal-category">${h(`dialogs.proposal.categoryLabel`)}</label>
            <select id="proposal-category" name="proposal-category" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${r.SOLID}">${p(r.SOLID)}</option>
              <option value="${r.SECURITY}">${p(r.SECURITY)}</option>
              <option value="${r.QUALITY}">${p(r.QUALITY)}</option>
            </select>
          </div>
        </div>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-decision">${h(`dialogs.proposal.decisionLabel`)}</label>
            <select id="proposal-decision" name="proposal-decision" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${i.PENDING}">${u(i.PENDING)}</option>
              <option value="${i.DESIRABLE}">${u(i.DESIRABLE)}</option>
              <option value="${i.IMPORTANT}">${u(i.IMPORTANT)}</option>
              <option value="${i.BLOCKING}">${u(i.BLOCKING)}</option>
            </select>
          </div>
          <div class="proposal-field">
            <span class="field-label">${h(`dialogs.proposal.severityLabel`)}</span>
            <div class="severity-picker" id="proposal-severity-picker">
              <label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="${t.LOW}"><span>${v(t.LOW)}</span></label>
              <label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="${t.MEDIUM}" checked><span>${v(t.MEDIUM)}</span></label>
              <label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="${t.HIGH}"><span>${v(t.HIGH)}</span></label>
            </div>
          </div>
        </div>
        <label class="proposal-global-toggle" id="proposal-global-toggle"><input type="checkbox" id="proposal-global" name="proposal-global"> ${h(`dialogs.proposal.globalCheckbox`)}</label>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel">${h(`common.cancel`)}</button>
          <button class="primary-action" id="save-proposal" type="submit" value="default">${h(`dialogs.proposal.saveProposal`)}</button>
        </div>
      </form>
    </dialog>
    <dialog id="delete-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="delete-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel" aria-label="${h(`common.close`)}">×</button>
        <span class="eyebrow">${h(`dialogs.delete.eyebrow`)}</span>
        <h2>${h(`dialogs.delete.title`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${h(`dialogs.delete.warning`)}</p>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button" formnovalidate value="cancel">${h(`common.cancel`)}</button>
          <button class="primary-action primary-action--danger" type="submit" value="default">${h(`dialogs.delete.confirmBtn`)}</button>
        </div>
      </form>
    </dialog>
  `,document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>w(`#/reviews`)),document.querySelector(`#workspace-theme-toggle`)?.addEventListener(`click`,re),document.querySelector(`#workspace-lang-toggle`)?.addEventListener(`click`,()=>f()),document.querySelectorAll(`[data-file-index]`).forEach(e=>e.addEventListener(`click`,()=>{let t=Number(e.dataset.fileIndex);A[t]&&(E?.(t),C(a,{...s,activeFileIndex:t}))})),document.querySelectorAll(`[data-decision]`).forEach(e=>e.addEventListener(`click`,async()=>{if(!g.id)return;let t=Number(e.dataset.decision);try{if(t===o.CLOSE){let{cancelReviewWorkflow:e}=await _(async()=>{let{cancelReviewWorkflow:e}=await import(`./review-runtime-DAsbGlOA.js`);return{cancelReviewWorkflow:e}},__vite__mapDeps([0,1,2,3,4,5,6,7]),import.meta.url);e(g.id)}t===o.APPROVE&&await se(g);let e=t===o.APPROVE?n.APPROVED:t===o.REOPEN?n.IN_PROGRESS:n.CLOSED;await te(g.id,e),await T(),w(t===o.REOPEN?`#/reviews/${g.id}`:`#/reviews`)}catch(e){window.alert(e instanceof Error?e.message:h(`alerts.cannotUpdateReview`))}}));let L=async()=>{await T(),await C(a,{...s,activeFileIndex:x})},R=document.querySelector(`#new-proposal-dialog`),z=document.querySelector(`#new-proposal-form`),B=document.querySelector(`#new-proposal-title`),V=document.querySelector(`#new-proposal-hint`),H=document.querySelector(`#proposal-message`),U=document.querySelector(`#proposal-author`),W=document.querySelector(`#proposal-category`),G=document.querySelector(`#proposal-decision`),K=document.querySelectorAll(`input[name="proposal-severity"]`),ce=document.querySelector(`#proposal-global-toggle`),q=document.querySelector(`#proposal-global`),J=document.querySelector(`#save-proposal`),Y=document.querySelector(`#delete-proposal-dialog`),le=document.querySelector(`#delete-proposal-form`);R.querySelectorAll(`.dialog-close, .secondary-action`).forEach(e=>{e.addEventListener(`click`,()=>{R.close()})}),Y.querySelectorAll(`.dialog-close, .secondary-action`).forEach(e=>{e.addEventListener(`click`,()=>{Q=void 0,Y.close()})});let X={},Z,Q,$=e=>{X={path:e.path,line:e.line},Z=e.editId,H.value=e.initialMessage??``,U.value=e.initialAuthor??h(`domain.authors.localReviewer`),W.value=String(e.initialCategory??r.SOLID),G.value=String(e.initialDecision??i.PENDING),K.forEach(n=>{n.checked=Number(n.value)===(e.initialSeverity??t.MEDIUM)}),q.checked=!1,ce.style.display=e.allowGlobalToggle?`flex`:`none`,e.editId?(B.textContent=h(`dialogs.proposal.editTitle`),V.textContent=e.path?`${e.path}${e.line?`:`+e.line:``}`:h(`workspace.globalProposal`),J.textContent=h(`dialogs.proposal.saveChanges`)):e.line?(B.textContent=h(`dialogs.proposal.lineTitle`,{line:e.line}),V.textContent=`${e.path}:${e.line}`,J.textContent=h(`dialogs.proposal.saveProposal`)):(B.textContent=h(`dialogs.proposal.generalTitle`),V.textContent=e.path??``,J.textContent=h(`dialogs.proposal.saveProposal`)),R.showModal()};document.querySelectorAll(`.review-comment[data-comment-id]`).forEach(e=>{let t=Number(e.dataset.commentId);t&&(e.querySelector(`.comment-action--edit`)?.addEventListener(`click`,()=>{let e=j.find(e=>e.id===t);e&&$({path:e.file,line:e.line,allowGlobalToggle:!1,editId:t,initialMessage:e.message,initialSeverity:e.severity,initialAuthor:e.author,initialCategory:e.category,initialDecision:e.decision})}),e.querySelector(`.comment-action--delete`)?.addEventListener(`click`,()=>{Q=t,Y.showModal()}))}),document.querySelector(`#new-file-proposal`)?.addEventListener(`click`,()=>$({path:M.path,allowGlobalToggle:!0,initialAuthor:h(`domain.authors.localReviewer`),initialCategory:r.SOLID,initialDecision:i.PENDING})),document.querySelectorAll(`.code-line`).forEach(e=>e.addEventListener(`contextmenu`,t=>{t.preventDefault();let n=Number(e.dataset.line);$({path:M.path,line:n,allowGlobalToggle:!1,initialAuthor:h(`domain.authors.localReviewer`),initialCategory:r.SOLID,initialDecision:i.PENDING})})),z.addEventListener(`submit`,async e=>{if(e.preventDefault(),e.submitter?.value===`cancel`){R.close();return}if(!g.id)return;let n=H.value.trim();if(!n)return;let i=Array.from(K).find(e=>e.checked),a=i?Number(i.value):t.MEDIUM,o=W.value?Number(W.value):r.SOLID,s=S(G.value);if(Z)await ne(Z,{body:n,severity:a,category:o,decision:s});else{let e=q.checked;await y(g.id,{path:e?void 0:X.path,line:X.line,body:n,severity:a,category:o,decision:s})}R.close(),await L()}),le.addEventListener(`submit`,async e=>{e.preventDefault();let t=e.submitter;Y.close(),t?.value!==`cancel`&&Q&&(await ee(Q),Q=void 0,await L())})}export{C as renderReviewWorkspace};