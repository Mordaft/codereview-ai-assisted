import{W as e,b as t,c as n,d as r,i,m as a,n as o,p as s,r as c,s as l,u,y as d}from"./index-DvYkLLok.js";function f(f,p){let{reviews:m,navigate:h}=p,g=e(),_=[...m].sort((e,t)=>new Date(t.createdAt||0).getTime()-new Date(e.createdAt||0).getTime()),v=m.filter(e=>!i(e)).length,y=m.filter(e=>e.provider?.toLowerCase()===`github`),b=m.filter(e=>e.provider?.toLowerCase()===`gitlab`),x=m.length,S=y.length,C=b.length,w=x>0?Math.round(S/x*100):0,T=x>0?100-w:0,E=2*Math.PI*38,D=w/100*E,O=T/100*E,k=new Date,A=864e5,j=new Map;for(let e of m)if(e.createdAt){let t=new Date(e.createdAt);if(!Number.isNaN(t.getTime())){let e=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}-${String(t.getDate()).padStart(2,`0`)}`;j.set(e,(j.get(e)??0)+1)}}let M=6-k.getDay(),N=new Date(k.getFullYear(),k.getMonth(),k.getDate()+M),P=new Date(N.getTime()-139*A),F=s()===`es`?[`Ene`,`Feb`,`Mar`,`Abr`,`May`,`Jun`,`Jul`,`Ago`,`Sep`,`Oct`,`Nov`,`Dic`]:[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`],I=s()===`es`?[``,`Lun`,``,`Mié`,``,`Vie`,``]:[``,`Mon`,``,`Wed`,``,`Fri`,``],L=new Date(P.getTime()),R=``,z=``,B=-1;for(let e=0;e<20;e++){let t=30+e*14;for(let e=0;e<7;e++){let n=20+e*14,r=L.getFullYear(),i=L.getMonth(),o=L.getDate(),s=`${r}-${String(i+1).padStart(2,`0`)}-${String(o).padStart(2,`0`)}`;e===0&&i!==B&&(z+=`<text x="${t}" y="14" class="heatmap-text">${F[i]}</text>`,B=i);let c=L.getTime()>k.getTime(),l=c?0:j.get(s)??0,u=0;!c&&l>0&&(u=l===1?1:l===2?2:l<=4?3:4);let d=l>0?a(`history.reviewsOnDate`,{count:l,date:s}):a(`history.noReviewsOnDate`,{date:s});R+=`<rect class="heatmap-cell heatmap-cell--level-${u} ${c?`heatmap-cell--future`:``}" x="${t}" y="${n}" width="11" height="11" rx="2" ry="2"><title>${d}</title></rect>`,L=new Date(L.getTime()+A)}}let V=``;for(let e=0;e<7;e++)if(I[e]){let t=20+e*14+11-2;V+=`<text x="24" y="${t}" class="heatmap-text text-right" text-anchor="end">${I[e]}</text>`}let H=_.length?_.map(e=>{let t=e.model||g.model||`llama3.2`,n=e.processedFilesCount??e.remoteFiles?.length??0,r=e.comments??0,i=c(e.processingTimeMs),s=o(e.createdAt),l=d(e.status),f=u(e.status);return`
      <tr class="history-row" data-history-review-id="${e.id}" title="${a(`history.openReview`)}">
        <td class="history-cell history-cell--title">
          <div class="history-title-wrapper">
            <strong class="history-review-title text-brand-primary-light dark:!text-brand-primary-dark">${e.title}</strong>
            <span class="history-repo text-brand-muted-light dark:!text-brand-muted-dark">${e.repository}${e.remoteChange?.number?` #${e.remoteChange.number}`:``}</span>
          </div>
        </td>
        <td class="history-cell">
          <span class="provider provider--${e.provider.toLowerCase()} font-semibold">${e.provider}</span>
        </td>
        <td class="history-cell">
          <span class="status status--${f}"><span></span>${l}</span>
        </td>
        <td class="history-cell text-brand-muted-light dark:!text-brand-muted-dark font-mono text-xs">
          <time datetime="${e.createdAt}">${s}</time>
        </td>
        <td class="history-cell">
          <span class="metric-pill">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="opacity-70"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073Z"/></svg>
            ${n}
          </span>
        </td>
        <td class="history-cell">
          <span class="comment-badge font-semibold">
            <svg class="comment-badge__icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.75.75 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
            ${r}
          </span>
        </td>
        <td class="history-cell">
          <span class="duration-pill ${i===`—`?``:`duration-pill--active`}">${i}</span>
        </td>
        <td class="history-cell">
          <span class="model-badge">${t}</span>
        </td>
      </tr>
    `}).join(``):`
    <tr>
      <td colspan="8" class="empty-history-cell text-brand-muted-light dark:!text-brand-muted-dark">
        ${a(`history.emptyReviews`)}
      </td>
    </tr>
  `;f.innerHTML=`
    <div class="app-shell">
      ${n(`history`,v)}
      <main class="content bg-brand-canvas-light text-brand-primary-light dark:!bg-brand-canvas-dark dark:!text-brand-primary-dark">
        <header class="topbar">
          <div>
            <span class="eyebrow">${a(`history.eyebrow`)}</span>
            <h1>${a(`history.title`)}</h1>
          </div>
          <div class="flex items-center gap-2">
            ${l(`lang-toggle`)}
            <button class="icon-button bg-brand-surface-light text-brand-muted-light dark:!bg-brand-surface-dark dark:!text-brand-muted-dark" id="theme-toggle" type="button" aria-label="${a(`common.toggleTheme`)}" title="${a(`common.toggleTheme`)}">◐</button>
          </div>
        </header>

        <div class="history-metrics-grid">
          <section class="history-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div class="history-card__header">
              <h2 class="history-card__title">${a(`history.platformDistributionTitle`)}</h2>
              <p class="history-card__subtitle">${a(`history.platformDistributionSubtitle`)}</p>
            </div>
            <div class="platform-distribution">
              <div class="donut-container">
                <svg class="donut-chart" width="110" height="110" viewBox="0 0 100 100">
                  <circle class="donut-ring" cx="50" cy="50" r="38" fill="none" stroke-width="11" />
                  ${x>0?`
                    <circle class="donut-segment donut-segment--github" cx="50" cy="50" r="38" fill="none" stroke-width="11"
                      stroke-dasharray="${D} ${E}"
                      stroke-dashoffset="0" />
                    <circle class="donut-segment donut-segment--gitlab" cx="50" cy="50" r="38" fill="none" stroke-width="11"
                      stroke-dasharray="${O} ${E}"
                      stroke-dashoffset="-${D}" />
                  `:``}
                </svg>
                <div class="donut-center">
                  <span class="donut-total">${x}</span>
                  <span class="donut-label">${a(`history.reviewsCount`)}</span>
                </div>
              </div>
              <div class="distribution-bars">
                <div class="distribution-item">
                  <div class="distribution-item__meta">
                    <span class="provider provider--github flex items-center gap-1.5 font-semibold">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                      ${a(`history.github`)}
                    </span>
                    <span class="distribution-item__count text-brand-muted-light dark:!text-brand-muted-dark"><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${S}</strong> (${w}%)</span>
                  </div>
                  <div class="distribution-track"><div class="distribution-fill distribution-fill--github" style="width: ${w}%"></div></div>
                </div>
                <div class="distribution-item">
                  <div class="distribution-item__meta">
                    <span class="provider provider--gitlab flex items-center gap-1.5 font-semibold">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="m15.97 9.058-.888-2.735L13.565 1.74a.486.486 0 0 0-.928 0l-1.517 4.583H4.88L3.363 1.74a.486.486 0 0 0-.928 0L.918 6.323.03 9.058a.972.972 0 0 0 .354 1.09l7.616 5.534 7.616-5.534a.972.972 0 0 0 .354-1.09z"/></svg>
                      ${a(`history.gitlab`)}
                    </span>
                    <span class="distribution-item__count text-brand-muted-light dark:!text-brand-muted-dark"><strong class="text-brand-primary-light dark:!text-brand-primary-dark">${C}</strong> (${T}%)</span>
                  </div>
                  <div class="distribution-track"><div class="distribution-fill distribution-fill--gitlab" style="width: ${T}%"></div></div>
                </div>
              </div>
            </div>
          </section>

          <section class="history-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
            <div class="history-card__header">
              <h2 class="history-card__title">${a(`history.activityHeatmapTitle`)}</h2>
              <p class="history-card__subtitle">${a(`history.activityHeatmapSubtitle`)}</p>
            </div>
            <div class="activity-heatmap">
              <div class="heatmap-container">
                <svg class="heatmap-svg" width="310" height="123" viewBox="0 0 310 123">
                  ${z}
                  ${V}
                  ${R}
                </svg>
              </div>
              <div class="heatmap-legend">
                <span class="heatmap-legend-label">${a(`history.legendLess`)}</span>
                <span class="heatmap-legend-cell heatmap-cell--level-0"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-1"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-2"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-3"></span>
                <span class="heatmap-legend-cell heatmap-cell--level-4"></span>
                <span class="heatmap-legend-label">${a(`history.legendMore`)}</span>
              </div>
            </div>
          </section>
        </div>

        <section class="history-table-card bg-brand-surface-light border-brand-line-light dark:!bg-brand-surface-dark dark:!border-brand-line-dark">
          <div class="history-table-header">
            <div>
              <h2 class="history-card__title">${a(`history.tableTitle`)}</h2>
              <p class="history-card__subtitle">${a(`history.tableSubtitle`)}</p>
            </div>
            <span class="nav-count text-xs">${m.length} ${a(`history.reviewsCount`)}</span>
          </div>
          <div class="history-table-wrapper">
            <table class="history-table">
              <thead>
                <tr>
                  <th>${a(`history.colName`)}</th>
                  <th>${a(`history.colRepoType`)}</th>
                  <th>${a(`history.colStatus`)}</th>
                  <th>${a(`history.colCreatedAt`)}</th>
                  <th>${a(`history.colProcessedFiles`)}</th>
                  <th>${a(`history.colSuggestions`)}</th>
                  <th>${a(`history.colDuration`)}</th>
                  <th>${a(`history.colModel`)}</th>
                </tr>
              </thead>
              <tbody>
                ${H}
              </tbody>
            </table>
          </div>
        </section>

        <footer class="content-footer text-brand-muted-light dark:!text-brand-muted-dark">
          <span><span class="live-dot"></span> ${a(`reviews.footer.slmReady`)}</span>
          <span>${a(`reviews.footer.localDataNotice`)}</span>
        </footer>
      </main>
    </div>
  `,document.querySelector(`#reviews-nav`)?.addEventListener(`click`,()=>h(`#/reviews`)),document.querySelector(`#history-nav`)?.addEventListener(`click`,()=>h(`#/history`)),document.querySelector(`#settings-nav`)?.addEventListener(`click`,()=>h(`#/settings`)),document.querySelector(`#theme-toggle`)?.addEventListener(`click`,r),document.querySelector(`#lang-toggle`)?.addEventListener(`click`,()=>t()),document.querySelectorAll(`.history-row[data-history-review-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=Number(e.dataset.historyReviewId);t&&h(`#/reviews/${t}`)})})}export{f as renderHistory};