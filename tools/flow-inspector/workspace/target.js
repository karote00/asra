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
})()
