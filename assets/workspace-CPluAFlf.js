const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./review-runtime-DTN2Og1f.js","./enums-5HL4wscD.js","./index-BwnfBAas.js","./rolldown-runtime-hePW80VL.js","./dexie-D3KjN6fK.js","./index-CbRxoG4b.css","./langgraph-CTtiDLzx.js","./review-prompts-BEeKHNk5.js"])))=>i.map(i=>d[i]);
import{a as e,i as t,l as n,n as r,o as i,r as a,s as o}from"./enums-5HL4wscD.js";import{A as s,C as ee,D as c,H as l,I as u,O as d,P as f,_ as p,a as m,b as h,d as te,g,h as _,l as ne,m as v,s as re,t as ie,u as ae,v as y,w as b,y as x}from"./index-BwnfBAas.js";import{i as S}from"./platform-api-CcoprtR-.js";function C(e){if(e==null)return i.PENDING;if(typeof e==`number`&&(e===i.DESIRABLE||e===i.IMPORTANT||e===i.BLOCKING||e===i.PENDING))return e;if(typeof e==`string`)switch(e.toLowerCase().trim()){case`1`:case`deseable`:case`desirable`:return i.DESIRABLE;case`2`:case`importante`:case`important`:return i.IMPORTANT;case`3`:case`bloqueante`:case`blocking`:return i.BLOCKING;default:return i.PENDING}return i.PENDING}async function oe(e){if(!e.id||!e.remoteChange?.webUrl)return;let n=(await d(e.id)).filter(e=>e.decision!==a.PUBLISHED);if(!n.length)return;let r=l(e.remoteChange.webUrl);for(let e of n){let n=e.path?`${e.path}${e.line?`:`+e.line:``}`:v(`workspace.generalComment`),i=`**[${y(e.severity??t.MEDIUM)}]** ${n}\n\n${e.body}`;await S(r,{body:i}),e.id&&await s(e.id)}}async function w(a,s){let{review:l,activeFileIndex:S=0,navigate:T,refreshReviews:E,onFileSelect:D}=s,O=l.status===n.APPROVED||l.status===n.CLOSED||l.status===`Aprobada`||l.status===`Cerrada`,k=m(l),A=l.id?await d(l.id):[],j=l.remoteFiles?.length?l.remoteFiles.map(e=>({path:e.path,type:e.path.split(`.`).at(-1)?.toUpperCase()??`TXT`,lines:(e.content??e.patch??v(`workspace.noFilesDownloadedText`)).split(`
`)})):[{path:v(`workspace.noFilesDownloaded`),type:`TXT`,lines:[v(`workspace.noFilesDownloadedText`)]}],M=A.length?A.map(e=>({id:e.id,file:e.path,line:e.line,severity:e.severity??t.MEDIUM,message:e.body,author:_(e.author,e.source),category:e.category??r.SOLID,decision:C(e.decision),source:e.source})):l.remoteComments?.length?l.remoteComments.map(n=>({id:void 0,file:n.path,line:n.line,severity:t.MEDIUM,message:n.body,author:_(n.author,e.REMOTE),category:r.SOLID,decision:i.PENDING,source:e.REMOTE})):[],N=j[S]??j[0],P=M.filter(e=>!e.file||e.file===N.path),F=new Map;for(let e of M){if(!e.file)continue;let t=F.get(e.file)??[];t.push(e),F.set(e.file,t)}let I=l.id?ee(l.id):void 0,se=I&&I.phase!==`completed`?`<span class="status status--thinking"><span class="thinking-pulse"></span>${I?.phase===`suggesting`?v(`reviews.card.generatingProposals`):v(`reviews.card.slmThinking`)}</span>`:`<span class="status status--${ae(l.status)}"><span></span>${x(l.status)}</span>`;a.innerHTML=`
    <div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${v(`common.backToReviews`)}</button>
        <div class="workspace-title">
          <span class="provider provider--${l.provider.toLowerCase()}">${l.provider}</span>
          <strong class="text-brand-primary-light dark:!text-brand-primary-dark">${l.title}</strong>
          <span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${l.repository}</span>
        </div>
        <div class="workspace-actions">
          ${se}
          ${O?`<button class="primary-action" data-decision="${o.REOPEN}" type="button">${v(`common.reopen`)}</button>`:k?`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${o.CLOSE}" type="button">${v(`common.close`)}</button>`:`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${o.CLOSE}" type="button">${v(`common.close`)}</button><button class="primary-action" data-decision="${o.APPROVE}" type="button">${v(`workspace.approveLocally`)}</button>`}
          ${re(`workspace-lang-toggle`)}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="${v(`common.toggleTheme`)}" title="${v(`common.toggleTheme`)}">◐</button>
        </div>
      </header>
      <div class="workspace-grid">
        <aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.modifiedFiles`)} <span class="panel-counter">${j.length}</span></div>
          <div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${l.repository}</div>
          ${j.map((e,n)=>{let r=F.get(e.path)??[],i=r.length,a=r.some(e=>e.severity===t.HIGH||e.severity===`alta`)?`comment-badge comment-badge--alta`:`comment-badge`,o=v(`workspace.reviewProposalBadge`,{count:i,label:v(i===1?`workspace.proposalWordSingular`:`workspace.proposalWordPlural`)});return`<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${n===S?`file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark`:`hover:dark:!bg-[#263730]`}" data-file-index="${n}" type="button"><span class="file-type">${e.type}</span><span class="file-name" title="${e.path}">${e.path}</span>${i>0?`<span class="${a}" title="${o}" aria-label="${o}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${i}</span></span>`:``}</button>`}).join(``)}
          <div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${v(`workspace.commentsCount`,{count:M.length})}</div>
        </aside>
        <main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark">
          <div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${N.path}</strong>
              <span class="text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.diffView`,{lines:N.lines.length})}</span>
            </div>
            <div class="code-toolbar__actions">
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">${v(`workspace.newProposal`)}</button>
            </div>
          </div>
          <div class="code-frame">
            ${N.lines.map((e,t)=>{let n=t+1,r=P.filter(e=>e.line===n);return`<div class="code-line ${r.length?`code-line--commented dark:!bg-[#352f19]`:``}" data-line="${n}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${n}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${e.replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`)}</code>${r.length?`<span class="line-marker" title="${v(`workspace.lineCommentsMarker`,{count:r.length})}">●</span>`:``}</div>`}).join(``)}
          </div>
        </main>
        <aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.commentsPanelTitle`)}</span>
              <h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${P.length===1?v(`workspace.singleProposalCount`):v(`workspace.proposalsCount`,{count:P.length})}</h2>
              <small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${N.path}</small>
            </div>
          </div>
          ${P.length?P.map(e=>`<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${e.id??``}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${ne(e.severity)}">${y(e.severity)}</span><span>${e.file?`${e.file}${e.line?`:`+e.line:``}`:v(`workspace.globalProposal`)}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${e.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${e.author} · ${g(e.category)} · ${p(e.decision)}</small>${e.id&&!O?`<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${v(`common.edit`)}</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${v(`common.delete`)}</button></div>`:``}</article>`).join(``):`<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">${v(`workspace.emptyComments`)}</div>`}
        </aside>
      </div>
    </div>
    <dialog id="new-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="new-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${v(`common.close`)}">×</button>
        <span class="eyebrow">${v(`dialogs.proposal.eyebrow`)}</span>
        <h2 id="new-proposal-title">${v(`dialogs.proposal.addTitle`)}</h2>
        <p id="new-proposal-hint" class="text-brand-muted-light dark:!text-brand-muted-dark"></p>
        <label for="proposal-message">${v(`dialogs.proposal.descLabel`)}</label>
        <textarea id="proposal-message" name="proposal-message" rows="3" required placeholder="${v(`dialogs.proposal.descPlaceholder`)}" class="bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark"></textarea>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-author">${v(`dialogs.proposal.authorLabel`)}</label>
            <input id="proposal-author" name="proposal-author" type="text" readonly class="proposal-input proposal-input--readonly bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-muted-dark dark:!border-brand-line-dark">
          </div>
          <div class="proposal-field">
            <label for="proposal-category">${v(`dialogs.proposal.categoryLabel`)}</label>
            <select id="proposal-category" name="proposal-category" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${r.SOLID}">${g(r.SOLID)}</option>
              <option value="${r.SECURITY}">${g(r.SECURITY)}</option>
              <option value="${r.QUALITY}">${g(r.QUALITY)}</option>
            </select>
          </div>
        </div>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-decision">${v(`dialogs.proposal.decisionLabel`)}</label>
            <select id="proposal-decision" name="proposal-decision" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${i.PENDING}">${p(i.PENDING)}</option>
              <option value="${i.DESIRABLE}">${p(i.DESIRABLE)}</option>
              <option value="${i.IMPORTANT}">${p(i.IMPORTANT)}</option>
              <option value="${i.BLOCKING}">${p(i.BLOCKING)}</option>
            </select>
          </div>
          <div class="proposal-field">
            <span class="field-label">${v(`dialogs.proposal.severityLabel`)}</span>
            <div class="severity-picker" id="proposal-severity-picker">
              <label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="${t.LOW}"><span>${y(t.LOW)}</span></label>
              <label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="${t.MEDIUM}" checked><span>${y(t.MEDIUM)}</span></label>
              <label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="${t.HIGH}"><span>${y(t.HIGH)}</span></label>
            </div>
          </div>
        </div>
        <label class="proposal-global-toggle" id="proposal-global-toggle"><input type="checkbox" id="proposal-global" name="proposal-global"> ${v(`dialogs.proposal.globalCheckbox`)}</label>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${v(`common.cancel`)}</button>
          <button class="primary-action" id="save-proposal" value="default">${v(`dialogs.proposal.saveProposal`)}</button>
        </div>
      </form>
    </dialog>
    <dialog id="delete-proposal-dialog" class="review-dialog bg-brand-surface-light text-brand-primary-light dark:!bg-brand-surface-dark dark:!text-brand-primary-dark">
      <form method="dialog" id="delete-proposal-form">
        <button class="dialog-close text-brand-muted-light dark:!text-brand-muted-dark" value="cancel" aria-label="${v(`common.close`)}">×</button>
        <span class="eyebrow">${v(`dialogs.delete.eyebrow`)}</span>
        <h2>${v(`dialogs.delete.title`)}</h2>
        <p class="text-brand-muted-light dark:!text-brand-muted-dark">${v(`dialogs.delete.warning`)}</p>
        <div class="dialog-actions">
          <button class="secondary-action bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" value="cancel">${v(`common.cancel`)}</button>
          <button class="primary-action primary-action--danger" value="default">${v(`dialogs.delete.confirmBtn`)}</button>
        </div>
      </form>
    </dialog>
  `,document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>T(`#/reviews`)),document.querySelector(`#workspace-theme-toggle`)?.addEventListener(`click`,te),document.querySelector(`#workspace-lang-toggle`)?.addEventListener(`click`,()=>h()),document.querySelectorAll(`[data-file-index]`).forEach(e=>e.addEventListener(`click`,()=>{let t=Number(e.dataset.fileIndex);j[t]&&(D?.(t),w(a,{...s,activeFileIndex:t}))})),document.querySelectorAll(`[data-decision]`).forEach(e=>e.addEventListener(`click`,async()=>{if(!l.id)return;let t=Number(e.dataset.decision);try{if(t===o.CLOSE){let{cancelReviewWorkflow:e}=await ie(async()=>{let{cancelReviewWorkflow:e}=await import(`./review-runtime-DTN2Og1f.js`);return{cancelReviewWorkflow:e}},__vite__mapDeps([0,1,2,3,4,5,6,7]),import.meta.url);e(l.id)}(t===o.APPROVE||t===o.CLOSE&&!m(l))&&await oe(l);let e=t===o.APPROVE?n.APPROVED:t===o.REOPEN?n.IN_PROGRESS:n.CLOSED;await u(l.id,e),await E(),T(t===o.REOPEN?`#/reviews/${l.id}`:`#/reviews`)}catch(e){window.alert(e instanceof Error?e.message:v(`alerts.cannotUpdateReview`))}}));let L=async()=>{await E(),await w(a,{...s,activeFileIndex:S})},R=document.querySelector(`#new-proposal-dialog`),z=document.querySelector(`#new-proposal-form`),B=document.querySelector(`#new-proposal-title`),V=document.querySelector(`#new-proposal-hint`),H=document.querySelector(`#proposal-message`),U=document.querySelector(`#proposal-author`),W=document.querySelector(`#proposal-category`),G=document.querySelector(`#proposal-decision`),K=document.querySelectorAll(`input[name="proposal-severity"]`),ce=document.querySelector(`#proposal-global-toggle`),q=document.querySelector(`#proposal-global`),J=document.querySelector(`#save-proposal`),Y=document.querySelector(`#delete-proposal-dialog`),le=document.querySelector(`#delete-proposal-form`),X={},Z,Q,$=e=>{X={path:e.path,line:e.line},Z=e.editId,H.value=e.initialMessage??``,U.value=e.initialAuthor??v(`domain.authors.localReviewer`),W.value=String(e.initialCategory??r.SOLID),G.value=String(e.initialDecision??i.PENDING),K.forEach(n=>{n.checked=Number(n.value)===(e.initialSeverity??t.MEDIUM)}),q.checked=!1,ce.style.display=e.allowGlobalToggle?`flex`:`none`,e.editId?(B.textContent=v(`dialogs.proposal.editTitle`),V.textContent=e.path?`${e.path}${e.line?`:`+e.line:``}`:v(`workspace.globalProposal`),J.textContent=v(`dialogs.proposal.saveChanges`)):e.line?(B.textContent=v(`dialogs.proposal.lineTitle`,{line:e.line}),V.textContent=`${e.path}:${e.line}`,J.textContent=v(`dialogs.proposal.saveProposal`)):(B.textContent=v(`dialogs.proposal.generalTitle`),V.textContent=e.path??``,J.textContent=v(`dialogs.proposal.saveProposal`)),R.showModal()};document.querySelectorAll(`.review-comment[data-comment-id]`).forEach(e=>{let t=Number(e.dataset.commentId);t&&(e.querySelector(`.comment-action--edit`)?.addEventListener(`click`,()=>{let e=M.find(e=>e.id===t);e&&$({path:e.file,line:e.line,allowGlobalToggle:!1,editId:t,initialMessage:e.message,initialSeverity:e.severity,initialAuthor:e.author,initialCategory:e.category,initialDecision:e.decision})}),e.querySelector(`.comment-action--delete`)?.addEventListener(`click`,()=>{Q=t,Y.showModal()}))}),document.querySelector(`#new-file-proposal`)?.addEventListener(`click`,()=>$({path:N.path,allowGlobalToggle:!0,initialAuthor:v(`domain.authors.localReviewer`),initialCategory:r.SOLID,initialDecision:i.PENDING})),document.querySelectorAll(`.code-line`).forEach(e=>e.addEventListener(`contextmenu`,t=>{t.preventDefault();let n=Number(e.dataset.line);$({path:N.path,line:n,allowGlobalToggle:!1,initialAuthor:v(`domain.authors.localReviewer`),initialCategory:r.SOLID,initialDecision:i.PENDING})})),z.addEventListener(`submit`,async e=>{if(e.preventDefault(),e.submitter?.value===`cancel`){R.close();return}if(!l.id)return;let n=H.value.trim();if(!n)return;let i=Array.from(K).find(e=>e.checked),a=i?Number(i.value):t.MEDIUM,o=W.value?Number(W.value):r.SOLID,s=C(G.value);if(Z)await f(Z,{body:n,severity:a,category:o,decision:s});else{let e=q.checked;await b(l.id,{path:e?void 0:X.path,line:X.line,body:n,severity:a,category:o,decision:s})}R.close(),await L()}),le.addEventListener(`submit`,async e=>{e.preventDefault();let t=e.submitter;Y.close(),t?.value!==`cancel`&&Q&&(await c(Q),Q=void 0,await L())})}export{w as renderReviewWorkspace};