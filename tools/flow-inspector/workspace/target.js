/* global document, window */

;(function () {
  'use strict'

  const bundle = globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE
  const error = document.querySelector('[data-target-error]')
  const params = new URLSearchParams(window.location.hash.slice(1))
  const id = params.get('inspector')
  const entry = bundle?.entries?.find((candidate) => candidate.id === id)

  if (!id || !entry) {
    document.documentElement.dataset.targetState = 'error'
    error.hidden = false
    error.querySelector('h1').textContent = id
      ? `Inspector “${id}” is not available.`
      : 'Target route requires an Inspector id.'
    return
  }

  globalThis.FLOW_INSPECTOR_WORKSPACE_ENTRY = entry
  document.documentElement.dataset.targetState = 'ready'
  document.documentElement.dataset.rendererKind = entry.kind

  const targetRoot = document.querySelector('[data-target-root]')
  const workspaceUrl = new URL(window.location.href)
  const sharedRendererUrl = new URL('../viewer.js', workspaceUrl).href
  const legacyRendererUrl = new URL('./legacy-viewer.js', workspaceUrl).href
  const sourceUrl = new URL(`../../../${entry.sourcePath}`, workspaceUrl)
  const sourceDirectoryUrl = new URL('./', sourceUrl)
  const standaloneUrl = entry.standalonePath
    ? new URL(`../../../${entry.standalonePath}`, workspaceUrl).href
    : null

  const style = document.createElement('style')
  style.textContent = `
    :root { --panel-2:#1d2530; --warn:#f6c85f; --ok:#7bd88f; --card-w:270px; --card-h:118px; --gap-x:220px; --gap-y:100px; }
    .target-meta { display:flex; justify-content:space-between; gap:16px; border-bottom:1px solid var(--line); padding:8px 18px; color:var(--muted); background:#0c1117; }
    .target-meta a,a { color:var(--accent); }
    .app { display:grid; grid-template-columns:minmax(980px,1fr) 430px; height:calc(100vh - 42px); overflow:hidden; }
    .main { min-width:0; overflow:auto; padding:24px; }
    .header { display:flex; justify-content:space-between; margin-bottom:18px; }
    h1 { margin:0 0 6px; font-size:24px; }
    .subtitle,.detail-summary { color:var(--muted); }
    .header-links,.filters { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 18px; }
    .header-link,.filter-button { border:1px solid var(--line); border-radius:999px; padding:6px 10px; color:var(--accent); background:var(--panel); }
    .filter-button.active { border-color:var(--accent); }
    .guide-panel { margin-bottom:18px; border:1px solid var(--line); border-radius:14px; padding:12px 16px; background:var(--panel); }
    .guide-grid { display:grid; grid-template-columns:repeat(2,minmax(240px,1fr)); gap:12px; }
    .guide-card { border:1px solid var(--line); border-radius:12px; padding:12px; background:var(--panel-2); }
    .flow { position:relative; min-width:100%; min-height:620px; }
    .flow-svg { position:absolute; inset:0; pointer-events:none; }
    .step-card { position:absolute; width:var(--card-w); min-height:var(--card-h); border:1px solid var(--line); border-radius:14px; padding:14px; color:var(--text); background:var(--panel); text-align:left; }
    .step-card.selected { border-color:var(--accent); }
    .step-card h2 { margin:0 0 6px; font-size:15px; }
    .detail { height:calc(100vh - 42px); overflow:auto; border-left:1px solid var(--line); padding:24px; background:#0f1720; }
    .detail-section { margin-bottom:16px; border:1px solid var(--line); border-radius:12px; padding:14px; background:var(--panel); }
    .detail-section h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase; }
    code { color:#dbeafe; }
    .compatibility-view { max-width:1180px; margin:0 auto; padding:clamp(24px,5vw,64px); }
    .compatibility-label { color:var(--warn); font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .compatibility-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:28px; }
    .compatibility-card { min-width:0; border:1px solid var(--line); border-radius:14px; padding:16px; background:var(--panel); }
    .compatibility-card h2 { margin:0; font-size:16px; }
    .compatibility-card pre { max-height:360px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; color:#cbd5e1; }
    @media (max-width:900px) { .app { grid-template-columns:1fr; height:auto; overflow:visible; } .main { min-height:70vh; } .detail { height:auto; border-left:0; border-top:1px solid var(--line); } .target-meta { align-items:flex-start; flex-direction:column; } }
  `
  document.head.append(style)

  const meta = `<div class="target-meta"><span>${entry.group} · ${entry.subgroup} · ${entry.lifecycle}</span>${standaloneUrl ? `<a data-standalone-link href="${standaloneUrl}">Open standalone Inspector</a>` : ''}</div>`

  if (entry.kind === 'flow-v2') {
    globalThis.FLOW_INSPECTOR_DATA = entry.data
    targetRoot.dataset.flowV2Shell = ''
    targetRoot.innerHTML = `${meta}
      <div class="app">
        <main class="main">
          <div class="header"><div><h1 id="inspector-title">Flow Inspector</h1><p id="inspector-subtitle" class="subtitle">Loading target contract.</p><div id="inspector-links" class="header-links"></div></div></div>
          <div id="filters" class="filters"></div>
          <details class="guide-panel"><summary>Viewer controls and contract</summary><section class="guide-grid"><article class="guide-card"><h2>Viewer controls</h2><p>Filter by owner lane and select a card to inspect its exact contract.</p></article><article class="guide-card"><h2>Target contract</h2><p id="target-contract-summary">Loading target contract.</p></article></section></details>
          <section id="flow" class="flow" aria-label="Flow Inspector"></section>
        </main>
        <aside id="detail" class="detail" aria-label="Step detail"></aside>
      </div>`
  } else {
    targetRoot.innerHTML = meta
  }

  const base = document.createElement('base')
  base.href = sourceDirectoryUrl.href
  document.head.append(base)

  const renderer = document.createElement('script')
  renderer.dataset.rendererKind = entry.kind
  renderer.src = entry.kind === 'flow-v2' ? sharedRendererUrl : legacyRendererUrl
  renderer.addEventListener('load', () => {
    document.documentElement.dataset.targetState = 'rendered'
  })
  renderer.addEventListener('error', () => {
    document.documentElement.dataset.targetState = 'error'
    error.hidden = false
    error.querySelector('h1').textContent = `The ${entry.kind} renderer could not be loaded.`
  })
  document.head.append(renderer)
})()
