/* global document */

;(function () {
  'use strict'

  const entry = globalThis.FLOW_INSPECTOR_WORKSPACE_ENTRY
  if (!entry || entry.kind === 'flow-v2') {
    throw new Error('Compatibility viewer requires a legacy catalog entry.')
  }

  const root = document.querySelector('[data-target-root]')
  const escapeHtml = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const summarize = (value) => {
    if (Array.isArray(value)) return `${value.length} records`
    if (value && typeof value === 'object')
      return `${Object.keys(value).length} fields`
    return String(value)
  }

  const sections = Object.entries(entry.data)
    .map(
      ([key, value]) =>
        `<article class="compatibility-card"><h2>${escapeHtml(key)}</h2><p>${escapeHtml(summarize(value))}</p><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></article>`
    )
    .join('')

  root.insertAdjacentHTML(
    'beforeend',
    `<main class="compatibility-view" data-compatibility-view>
      <p class="compatibility-label">Read-only compatibility - ${escapeHtml(entry.kind)}</p>
      <h1>${escapeHtml(entry.title)}</h1>
      <p>This source predates or differs from the Flow Inspector v2 contract. Its original fields are shown without schema conversion or execution-state claims.</p>
      <section class="compatibility-grid">${sections}</section>
    </main>`
  )
})()
