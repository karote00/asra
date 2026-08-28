/* global document, window */

;(function () {
  'use strict'

  const bundle = globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE
  if (!bundle || !Array.isArray(bundle.entries)) {
    throw new Error('Missing Flow Inspector workspace bundle.')
  }

  const catalog = document.querySelector('[data-catalog]')
  const search = document.querySelector('[data-search]')
  const overviewButton = document.querySelector('[data-overview]')
  const frame = document.querySelector('[data-target-frame]')
  const errorMessage = document.querySelector('[data-route-error]')
  const views = new Map(
    [...document.querySelectorAll('[data-view]')].map((node) => [
      node.dataset.view,
      node
    ])
  )
  const entriesById = new Map(bundle.entries.map((entry) => [entry.id, entry]))
  const excludedIds = new Set(
    bundle.exclusions.map((entry) =>
      entry.path.replace(/^.*\//, '').replace(/-flow-inspector\.data\.(?:cjs|js)$/, '')
    )
  )

  const showView = (name) => {
    for (const [viewName, node] of views) node.hidden = viewName !== name
  }

  const routeId = () => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.get('inspector')
  }

  const select = (id) => {
    window.location.hash = id ? `inspector=${encodeURIComponent(id)}` : ''
  }

  const itemButton = (entry) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'inspector-link'
    button.dataset.inspectorId = entry.id
    button.dataset.searchText = [
      entry.title,
      entry.id,
      entry.subgroup,
      ...entry.labels
    ]
      .join(' ')
      .toLocaleLowerCase()
    button.innerHTML = `<span>${entry.title}</span><small>${entry.subgroup} · ${entry.kind}</small>`
    button.addEventListener('click', () => select(entry.id))
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        select(entry.id)
      }
    })
    return button
  }

  const renderCatalog = () => {
    const groups = ['Apps', 'Framework', 'Release', 'Tools']
    for (const groupName of groups) {
      const entries = bundle.entries.filter((entry) => entry.group === groupName)
      const section = document.createElement('section')
      section.className = 'group'
      section.dataset.group = groupName
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'group-toggle'
      toggle.dataset.groupToggle = ''
      toggle.setAttribute('aria-expanded', 'true')
      toggle.innerHTML = `<span>${groupName}</span><span>${entries.length}</span>`
      const items = document.createElement('div')
      items.className = 'group-items'
      items.dataset.groupItems = ''
      entries.forEach((entry) => items.append(itemButton(entry)))
      toggle.addEventListener('click', () => {
        items.hidden = !items.hidden
        toggle.setAttribute('aria-expanded', String(!items.hidden))
      })
      section.append(toggle, items)
      catalog.append(section)
    }
  }

  const renderMetrics = () => {
    const metrics = document.querySelector('[data-overview-metrics]')
    const values = [
      ['Inspectors', bundle.entries.length],
      ['Flow v2', bundle.entries.filter((entry) => entry.kind === 'flow-v2').length],
      ['Compatibility', bundle.entries.filter((entry) => entry.kind !== 'flow-v2').length],
      ['Explicit exclusions', bundle.exclusions.length]
    ]
    metrics.innerHTML = values
      .map(([label, value]) => `<article class="metric"><strong>${value}</strong><span>${label}</span></article>`)
      .join('')
  }

  const applyRoute = () => {
    const id = routeId()
    const buttons = [...document.querySelectorAll('[data-inspector-id]')]
    buttons.forEach((button) => button.removeAttribute('aria-current'))
    overviewButton.removeAttribute('aria-current')
    if (!id) {
      frame.removeAttribute('src')
      overviewButton.setAttribute('aria-current', 'page')
      showView('overview')
      return
    }
    const entry = entriesById.get(id)
    if (!entry) {
      frame.removeAttribute('src')
      errorMessage.textContent = `Inspector “${id}” is not available in this workspace${excludedIds.has(id) ? ' because it is explicitly excluded' : ''}.`
      showView('error')
      return
    }
    const selected = buttons.find((button) => button.dataset.inspectorId === id)
    selected?.setAttribute('aria-current', 'page')
    frame.setAttribute('src', `./target.html#inspector=${encodeURIComponent(id)}`)
    showView('target')
  }

  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase()
    for (const button of document.querySelectorAll('[data-inspector-id]')) {
      button.hidden = Boolean(query) && !button.dataset.searchText.includes(query)
    }
  })
  overviewButton.addEventListener('click', () => select(null))
  window.addEventListener('hashchange', applyRoute)

  renderCatalog()
  renderMetrics()
  applyRoute()
})()
