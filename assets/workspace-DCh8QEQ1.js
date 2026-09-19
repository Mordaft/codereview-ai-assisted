const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./review-runtime-DgWJDepv.js","./index-CsTOpFkU.js","./dexie-DT85gwXl.js","./rolldown-runtime-CbXtAM7H.js","./index-KMKmznIw.css","./langgraph-Z193pUsQ.js","./review-prompts-BEeKHNk5.js"])))=>i.map(i=>d[i]);
import{A as e,B as t,C as n,D as r,F as i,I as a,L as o,N as ee,O as s,R as c,U as l,V as u,Y as d,_ as f,a as p,b as te,d as m,g as h,h as g,l as _,m as v,s as ne,t as y,u as b,v as x,w as S,y as re,z as C}from"./index-CsTOpFkU.js";import{i as w}from"./platform-api-DMtpF7yF.js";function T(e){if(e==null)return t.PENDING;if(typeof e==`number`&&(e===t.DESIRABLE||e===t.IMPORTANT||e===t.BLOCKING||e===t.PENDING))return e;if(typeof e==`string`)switch(e.toLowerCase().trim()){case`1`:case`deseable`:case`desirable`:return t.DESIRABLE;case`2`:case`importante`:case`important`:return t.IMPORTANT;case`3`:case`bloqueante`:case`blocking`:return t.BLOCKING;default:return t.PENDING}return t.PENDING}async function ie(t){if(!t.id||!t.remoteChange?.webUrl)return;let n=(await s(t.id)).filter(e=>e.decision!==o.PUBLISHED);if(!n.length)return;let r=d(t.remoteChange.webUrl);for(let t of n){let n=t.path?`${t.path}${t.line?`:`+t.line:``}`:v(`workspace.generalComment`),i=`**[${x(t.severity??c.MEDIUM)}]** ${n}\n\n${t.body}`;await w(r,{body:i}),t.id&&await e(t.id)}}async function E(e,o){let{review:d,activeFileIndex:w=0,navigate:D,refreshReviews:O,onFileSelect:k}=o,A=d.status===l.APPROVED||d.status===l.CLOSED||d.status===`Aprobada`||d.status===`Cerrada`,j=p(d),M=d.id?await s(d.id):[],N=d.remoteFiles?.length?d.remoteFiles.map(e=>({path:e.path,type:e.path.split(`.`).at(-1)?.toUpperCase()??`TXT`,lines:(e.content??e.patch??v(`workspace.noFilesDownloadedText`)).split(`
`)})):[{path:v(`workspace.noFilesDownloaded`),type:`TXT`,lines:[v(`workspace.noFilesDownloadedText`)]}],P=M.length?M.map(e=>({id:e.id,file:e.path,line:e.line,severity:e.severity??c.MEDIUM,message:e.body,author:g(e.author,e.source),category:e.category??a.SOLID,decision:T(e.decision),source:e.source})):d.remoteComments?.length?d.remoteComments.map(e=>({id:void 0,file:e.path,line:e.line,severity:c.MEDIUM,message:e.body,author:g(e.author,C.REMOTE),category:a.SOLID,decision:t.PENDING,source:C.REMOTE})):[],F=N[w]??N[0],I=P.filter(e=>!e.file||e.file===F.path),L=new Map;for(let e of P){if(!e.file)continue;let t=L.get(e.file)??[];t.push(e),L.set(e.file,t)}let R=d.id?n(d.id):void 0,ae=R&&R.phase!==`completed`?`<span class="status status--thinking"><span class="thinking-pulse"></span>${R?.phase===`suggesting`?v(`reviews.card.generatingProposals`):v(`reviews.card.slmThinking`)}</span>`:`<span class="status status--${b(d.status)}"><span></span>${re(d.status)}</span>`;e.innerHTML=`
    <div class="review-workspace bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
      <header class="workspace-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
        <button class="back-button text-brand-muted-light dark:!text-brand-muted-dark hover:text-brand-primary-light dark:hover:!text-brand-primary-dark" id="back-to-reviews" type="button">${v(`common.backToReviews`)}</button>
        <div class="workspace-title">
          <span class="provider provider--${d.provider.toLowerCase()}">${d.provider}</span>
          <strong class="text-brand-primary-light dark:!text-brand-primary-dark">${d.title}</strong>
          <span class="workspace-repository text-brand-muted-light dark:!text-brand-muted-dark">${d.repository}</span>
        </div>
        <div class="workspace-actions">
          ${ae}
          ${A?`<button class="primary-action" data-decision="${u.REOPEN}" type="button">${v(`common.reopen`)}</button>`:j?`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${u.CLOSE}" type="button">${v(`common.close`)}</button>`:`<button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" data-decision="${u.CLOSE}" type="button">${v(`common.close`)}</button><button class="primary-action" data-decision="${u.APPROVE}" type="button">${v(`workspace.approveLocally`)}</button>`}
          ${ne(`workspace-lang-toggle`)}
          <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="workspace-theme-toggle" type="button" aria-label="${v(`common.toggleTheme`)}" title="${v(`common.toggleTheme`)}">◐</button>
        </div>
      </header>
      <div class="workspace-grid">
        <aside class="file-tree bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.modifiedFiles`)} <span class="panel-counter">${N.length}</span></div>
          <div class="tree-root text-brand-muted-light dark:!text-brand-muted-dark">⌄ ${d.repository}</div>
          ${N.map((e,t)=>{let n=L.get(e.path)??[],r=n.length,i=n.some(e=>e.severity===c.HIGH||e.severity===`alta`)?`comment-badge comment-badge--alta`:`comment-badge`,a=v(`workspace.reviewProposalBadge`,{count:r,label:v(r===1?`workspace.proposalWordSingular`:`workspace.proposalWordPlural`)});return`<button class="file-item text-brand-muted-light dark:!text-brand-muted-dark ${t===w?`file-item--active dark:!bg-[#2e3e37] dark:!text-brand-primary-dark`:`hover:dark:!bg-[#263730]`}" data-file-index="${t}" type="button"><span class="file-type">${e.type}</span><span class="file-name" title="${e.path}">${e.path}</span>${r>0?`<span class="${i}" title="${a}" aria-label="${a}"><svg class="comment-badge__icon" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12h2.5v2.793a.5.5 0 0 0 .854.353L8.707 12H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 2h-11z"/></svg><span class="comment-badge__count">${r}</span></span>`:``}</button>`}).join(``)}
          <div class="tree-summary border-brand-line-light text-brand-muted-light dark:!border-brand-line-dark dark:!text-brand-muted-dark"><span class="live-dot"></span> ${v(`workspace.commentsCount`,{count:P.length})}</div>
        </aside>
        <main class="code-review-panel bg-[#fbfcfb] dark:!bg-brand-canvas-dark">
          <div class="code-toolbar bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <strong id="active-file-path" class="text-brand-primary-light dark:!text-brand-primary-dark">${F.path}</strong>
              <span class="text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.diffView`,{lines:F.lines.length})}</span>
            </div>
            <div class="code-toolbar__actions">
              <button class="outline-action bg-brand-surface-light text-brand-muted-light border-brand-line-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark dark:!border-brand-line-dark" id="new-file-proposal" type="button">${v(`workspace.newProposal`)}</button>
            </div>
          </div>
          <div class="code-frame">
            ${F.lines.map((e,t)=>{let n=t+1,r=I.filter(e=>e.line===n);return`<div class="code-line ${r.length?`code-line--commented dark:!bg-[#352f19]`:``}" data-line="${n}"><span class="line-number text-[#aab6ae] dark:!text-[#62776c]">${n}</span><code class="text-[#30433a] dark:!text-[#d6e2db]">${e.replaceAll(`&`,`&amp;`).replaceAll(`<`,`&lt;`)}</code>${r.length?`<span class="line-marker" title="${v(`workspace.lineCommentsMarker`,{count:r.length})}">●</span>`:``}</div>`}).join(``)}
          </div>
        </main>
        <aside class="comments-panel bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="comments-header bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div>
              <span class="panel-label text-brand-muted-light dark:!text-brand-muted-dark">${v(`workspace.commentsPanelTitle`)}</span>
              <h2 class="text-brand-primary-light dark:!text-brand-primary-dark">${I.length===1?v(`workspace.singleProposalCount`):v(`workspace.proposalsCount`,{count:I.length})}</h2>
              <small class="comments-file text-brand-muted-light dark:!text-brand-muted-dark">${F.path}</small>
            </div>
          </div>
          ${I.length?I.map(e=>`<article class="review-comment bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark" data-comment-id="${e.id??``}"><div class="comment-meta text-brand-muted-light dark:!text-brand-muted-dark"><span class="severity severity--${_(e.severity)}">${x(e.severity)}</span><span>${e.file?`${e.file}${e.line?`:`+e.line:``}`:v(`workspace.globalProposal`)}</span></div><p class="text-brand-primary-light dark:!text-brand-primary-dark">${e.message}</p><small class="text-brand-muted-light dark:!text-brand-muted-dark">${e.author} · ${h(e.category)} · ${f(e.decision)}</small>${e.id&&!A?`<div class="comment-actions"><button class="comment-action comment-action--edit bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${v(`common.edit`)}</button><button class="comment-action comment-action--delete bg-brand-surface-light border-brand-line-light text-brand-muted-light dark:!bg-brand-canvas-dark dark:!border-brand-line-dark dark:!text-brand-muted-dark" type="button">${v(`common.delete`)}</button></div>`:``}</article>`).join(``):`<div class="comments-empty text-brand-muted-light dark:!text-brand-muted-dark dark:!border-brand-line-dark">${v(`workspace.emptyComments`)}</div>`}
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
              <option value="${a.SOLID}">${h(a.SOLID)}</option>
              <option value="${a.SECURITY}">${h(a.SECURITY)}</option>
              <option value="${a.QUALITY}">${h(a.QUALITY)}</option>
            </select>
          </div>
        </div>
        <div class="proposal-form-grid">
          <div class="proposal-field">
            <label for="proposal-decision">${v(`dialogs.proposal.decisionLabel`)}</label>
            <select id="proposal-decision" name="proposal-decision" class="proposal-select bg-brand-surface-light text-brand-primary-light border-brand-line-light dark:!bg-[#182521] dark:!text-brand-primary-dark dark:!border-brand-line-dark">
              <option value="${t.PENDING}">${f(t.PENDING)}</option>
              <option value="${t.DESIRABLE}">${f(t.DESIRABLE)}</option>
              <option value="${t.IMPORTANT}">${f(t.IMPORTANT)}</option>
              <option value="${t.BLOCKING}">${f(t.BLOCKING)}</option>
            </select>
          </div>
          <div class="proposal-field">
            <span class="field-label">${v(`dialogs.proposal.severityLabel`)}</span>
            <div class="severity-picker" id="proposal-severity-picker">
              <label class="severity-option severity-option--baja"><input type="radio" name="proposal-severity" value="${c.LOW}"><span>${x(c.LOW)}</span></label>
              <label class="severity-option severity-option--media"><input type="radio" name="proposal-severity" value="${c.MEDIUM}" checked><span>${x(c.MEDIUM)}</span></label>
              <label class="severity-option severity-option--alta"><input type="radio" name="proposal-severity" value="${c.HIGH}"><span>${x(c.HIGH)}</span></label>
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
  `,document.querySelector(`#back-to-reviews`)?.addEventListener(`click`,()=>D(`#/reviews`)),document.querySelector(`#workspace-theme-toggle`)?.addEventListener(`click`,m),document.querySelector(`#workspace-lang-toggle`)?.addEventListener(`click`,()=>te()),document.querySelectorAll(`[data-file-index]`).forEach(t=>t.addEventListener(`click`,()=>{let n=Number(t.dataset.fileIndex);N[n]&&(k?.(n),E(e,{...o,activeFileIndex:n}))})),document.querySelectorAll(`[data-decision]`).forEach(e=>e.addEventListener(`click`,async()=>{if(!d.id)return;let t=Number(e.dataset.decision);try{if(t===u.CLOSE){let{cancelReviewWorkflow:e}=await y(async()=>{let{cancelReviewWorkflow:e}=await import(`./review-runtime-DgWJDepv.js`);return{cancelReviewWorkflow:e}},__vite__mapDeps([0,1,2,3,4,5,6]),import.meta.url);e(d.id)}(t===u.APPROVE||t===u.CLOSE&&!p(d))&&await ie(d);let e=t===u.APPROVE?l.APPROVED:t===u.REOPEN?l.IN_PROGRESS:l.CLOSED;await i(d.id,e),await O(),D(t===u.REOPEN?`#/reviews/${d.id}`:`#/reviews`)}catch(e){window.alert(e instanceof Error?e.message:v(`alerts.cannotUpdateReview`))}}));let z=async()=>{await O(),await E(e,{...o,activeFileIndex:w})},B=document.querySelector(`#new-proposal-dialog`),oe=document.querySelector(`#new-proposal-form`),V=document.querySelector(`#new-proposal-title`),H=document.querySelector(`#new-proposal-hint`),U=document.querySelector(`#proposal-message`),se=document.querySelector(`#proposal-author`),W=document.querySelector(`#proposal-category`),G=document.querySelector(`#proposal-decision`),K=document.querySelectorAll(`input[name="proposal-severity"]`),ce=document.querySelector(`#proposal-global-toggle`),q=document.querySelector(`#proposal-global`),J=document.querySelector(`#save-proposal`),Y=document.querySelector(`#delete-proposal-dialog`),le=document.querySelector(`#delete-proposal-form`),X={},Z,Q,$=e=>{X={path:e.path,line:e.line},Z=e.editId,U.value=e.initialMessage??``,se.value=e.initialAuthor??v(`domain.authors.localReviewer`),W.value=String(e.initialCategory??a.SOLID),G.value=String(e.initialDecision??t.PENDING),K.forEach(t=>{t.checked=Number(t.value)===(e.initialSeverity??c.MEDIUM)}),q.checked=!1,ce.style.display=e.allowGlobalToggle?`flex`:`none`,e.editId?(V.textContent=v(`dialogs.proposal.editTitle`),H.textContent=e.path?`${e.path}${e.line?`:`+e.line:``}`:v(`workspace.globalProposal`),J.textContent=v(`dialogs.proposal.saveChanges`)):e.line?(V.textContent=v(`dialogs.proposal.lineTitle`,{line:e.line}),H.textContent=`${e.path}:${e.line}`,J.textContent=v(`dialogs.proposal.saveProposal`)):(V.textContent=v(`dialogs.proposal.generalTitle`),H.textContent=e.path??``,J.textContent=v(`dialogs.proposal.saveProposal`)),B.showModal()};document.querySelectorAll(`.review-comment[data-comment-id]`).forEach(e=>{let t=Number(e.dataset.commentId);t&&(e.querySelector(`.comment-action--edit`)?.addEventListener(`click`,()=>{let e=P.find(e=>e.id===t);e&&$({path:e.file,line:e.line,allowGlobalToggle:!1,editId:t,initialMessage:e.message,initialSeverity:e.severity,initialAuthor:e.author,initialCategory:e.category,initialDecision:e.decision})}),e.querySelector(`.comment-action--delete`)?.addEventListener(`click`,()=>{Q=t,Y.showModal()}))}),document.querySelector(`#new-file-proposal`)?.addEventListener(`click`,()=>$({path:F.path,allowGlobalToggle:!0,initialAuthor:v(`domain.authors.localReviewer`),initialCategory:a.SOLID,initialDecision:t.PENDING})),document.querySelectorAll(`.code-line`).forEach(e=>e.addEventListener(`contextmenu`,n=>{n.preventDefault();let r=Number(e.dataset.line);$({path:F.path,line:r,allowGlobalToggle:!1,initialAuthor:v(`domain.authors.localReviewer`),initialCategory:a.SOLID,initialDecision:t.PENDING})})),oe.addEventListener(`submit`,async e=>{if(e.preventDefault(),e.submitter?.value===`cancel`){B.close();return}if(!d.id)return;let t=U.value.trim();if(!t)return;let n=Array.from(K).find(e=>e.checked),r=n?Number(n.value):c.MEDIUM,i=W.value?Number(W.value):a.SOLID,o=T(G.value);if(Z)await ee(Z,{body:t,severity:r,category:i,decision:o});else{let e=q.checked;await S(d.id,{path:e?void 0:X.path,line:X.line,body:t,severity:r,category:i,decision:o})}B.close(),await z()}),le.addEventListener(`submit`,async e=>{e.preventDefault();let t=e.submitter;Y.close(),t?.value!==`cancel`&&Q&&(await r(Q),Q=void 0,await z())})}export{E as renderReviewWorkspace};