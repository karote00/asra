/* global document, URL, URLSearchParams, window */

;(function () {
  'use strict'

  const bundle = globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE
  const error = document.querySelector('[data-target-error]')
  const hashId = new URLSearchParams(window.location.hash.slice(1)).get(
    'inspector'
  )
  const queryId = new URLSearchParams(window.location.search).get('inspector')
  const id = hashId === queryId ? hashId : null
  const entry = bundle?.entries?.find((candidate) => candidate.id === id)

  if (!id || !entry) {
    document.documentElement.dataset.targetState = 'error'
    error.hidden = false
    let errorTitle = 'Target route requires a matching Inspector id.'
    if (hashId && queryId && hashId !== queryId) {
      errorTitle = 'Target query and hash Inspector ids must match.'
    } else if (id) {
      errorTitle = `Inspector “${id}” is not available.`
    }
    error.querySelector('h1').textContent = errorTitle
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
  renderer.src =
    entry.kind === 'flow-v2' ? sharedRendererUrl : legacyRendererUrl
  renderer.addEventListener('load', () => {
    document.documentElement.dataset.targetState = 'rendered'
  })
  renderer.addEventListener('error', () => {
    document.documentElement.dataset.targetState = 'error'
    error.hidden = false
    error.querySelector('h1').textContent =
      `The ${entry.kind} renderer could not be loaded.`
  })
  document.head.append(renderer)
})()
