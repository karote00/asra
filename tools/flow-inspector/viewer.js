/* global console, document, window */

;(function () {
  'use strict'

  const data = globalThis.FLOW_INSPECTOR_DATA
  if (!data) {
    throw new Error(
      'Missing FLOW_INSPECTOR_DATA. Load the target data file before the shared viewer.'
    )
  }

  const {
    schema,
    target,
    authority,
    links = [],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  } = data

  const requiredCollections = {
    links,
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }
  const invalidCollections = Object.entries(requiredCollections)
    .filter(([, value]) => !Array.isArray(value))
    .map(([name]) => name)
  if (invalidCollections.length) {
    throw new Error(
      `Flow Inspector target has invalid collections: ${invalidCollections.join(', ')}`
    )
  }
  const schemaId = schema?.id
  const recognizedSchemaId =
    schemaId === 'flow-inspector' ||
    (typeof schemaId === 'string' && schemaId.endsWith('.flow-inspector'))
  if (!recognizedSchemaId || schema.version !== 2) {
    throw new Error('Flow Inspector requires the flow-inspector/v2 schema.')
  }

  const flow = document.getElementById('flow')
  const detail = document.getElementById('detail')
  const filters = document.getElementById('filters')
  const title = document.getElementById('inspector-title')
  const subtitle = document.getElementById('inspector-subtitle')
  const headerLinks = document.getElementById('inspector-links')
  const targetSummary = document.getElementById('target-contract-summary')

  const requiredElements = {
    flow,
    detail,
    filters,
    title,
    subtitle,
    headerLinks,
    targetSummary
  }
  const missingElements = Object.entries(requiredElements)
    .filter(([, element]) => !element)
    .map(([name]) => name)
  if (missingElements.length) {
    throw new Error(
      `Flow Inspector shell is missing: ${missingElements.join(', ')}`
    )
  }

  const escapeHtml = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const specLink = links.find((link) => link.kind === 'authority')

  const formatItem = (value) => {
    if (value && typeof value === 'object' && value.href && value.label) {
      return `<a href="${escapeHtml(value.href)}">${escapeHtml(value.label)}</a>`
    }
    const text = String(value)
    if (text.startsWith('#') && specLink) {
      return `<a href="${escapeHtml(`${specLink.href}${text}`)}"><code>${escapeHtml(text)}</code></a>`
    }
    return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')
  }

  const section = (heading, items, className = '') => {
    const values = items && items.length ? items : ['None']
    return `
      <section class="detail-section ${className}">
        <h3>${escapeHtml(heading)}</h3>
        <ul>${values.map((item) => `<li>${formatItem(item)}</li>`).join('')}</ul>
      </section>`
  }

  const laneById = new Map(lanes.map((lane) => [lane.id, lane]))
  const stepById = new Map(steps.map((step) => [step.id, step]))
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact])
  )
  const stepsByLane = new Map(
    lanes.map((lane) => [
      lane.id,
      steps
        .filter((step) => step.laneId === lane.id)
        .sort((left, right) => left.order - right.order)
    ])
  )

  const layout = {
    left: 28,
    top: 68,
    cardW: 290,
    cardH: 168,
    gapX: 180,
    gapY: 84
  }

  let selectedId = steps[0]?.id ?? null
  let selectedLaneId = 'All'

  const ensureFlowViewport = () => {
    if (flow.parentElement?.classList.contains('flow-viewport')) return
    const viewport = document.createElement('div')
    viewport.className = 'flow-viewport'
    flow.before(viewport)
    viewport.appendChild(flow)
  }

  const isVisible = (step) =>
    selectedLaneId === 'All' || step.laneId === selectedLaneId

  const getStepLane = (step) =>
    lanes.findIndex((lane) => lane.id === step.laneId)

  const getStepRow = (step) =>
    stepsByLane.get(step.laneId)?.findIndex((item) => item.id === step.id) ?? 0

  const stepPosition = (step) => ({
    x: layout.left + getStepLane(step) * (layout.cardW + layout.gapX),
    y: layout.top + getStepRow(step) * (layout.cardH + layout.gapY)
  })

  const getFlowBounds = () => {
    const visibleSteps = steps.filter(isVisible)
    const laneIndexes = visibleSteps.map(getStepLane)
    const rowIndexes = visibleSteps.map(getStepRow)
    const maxLane = laneIndexes.length ? Math.max(...laneIndexes) : 0
    const maxRow = rowIndexes.length ? Math.max(...rowIndexes) : 0
    return {
      width:
        layout.left * 2 + (maxLane + 1) * layout.cardW + maxLane * layout.gapX,
      height:
        layout.top * 2 + (maxRow + 1) * layout.cardH + maxRow * layout.gapY
    }
  }

  const toSvgPoint = (svg, x, y) => {
    const point = svg.createSVGPoint()
    point.x = x
    point.y = y
    const matrix = svg.getScreenCTM()
    return matrix ? point.matrixTransform(matrix.inverse()) : { x, y }
  }

  const getEdgePath = (svg, fromCard, toCard, fromStep, toStep) => {
    const fromBox = fromCard.getBoundingClientRect()
    const toBox = toCard.getBoundingClientRect()
    if (fromStep.laneId === toStep.laneId) {
      const start = toSvgPoint(
        svg,
        fromBox.left + fromBox.width / 2,
        fromBox.bottom
      )
      const end = toSvgPoint(svg, toBox.left + toBox.width / 2, toBox.top)
      const midpointY = fromBox.bottom + (toBox.top - fromBox.bottom) * 0.5
      const controlStart = toSvgPoint(
        svg,
        fromBox.left + fromBox.width / 2,
        midpointY
      )
      const controlEnd = toSvgPoint(
        svg,
        toBox.left + toBox.width / 2,
        midpointY
      )
      return `M ${start.x} ${start.y} C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${end.x} ${end.y}`
    }

    const direction = toBox.left >= fromBox.left ? 1 : -1
    const startX = direction > 0 ? fromBox.right : fromBox.left
    const startY = fromBox.top + fromBox.height / 2
    const endX = direction > 0 ? toBox.left : toBox.right
    const endY = toBox.top + toBox.height / 2
    const distanceX = Math.abs(endX - startX)
    const curve = Math.max(120, Math.min(distanceX * 0.46, layout.gapX * 0.92))
    const start = toSvgPoint(svg, startX, startY)
    const end = toSvgPoint(svg, endX, endY)
    const controlStart = toSvgPoint(svg, startX + direction * curve, startY)
    const controlEnd = toSvgPoint(svg, endX - direction * curve, endY)
    return `M ${start.x} ${start.y} C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${end.x} ${end.y}`
  }

  const routeClass = (kind) => {
    if (kind === 'bypass') return 'route-bypass'
    if (kind === 'coexecute' || kind === 'fanout') return 'route-parallel'
    return `route-${kind}`
  }

  const renderEdges = (svg) => {
    svg.querySelectorAll('.edge-path').forEach((node) => node.remove())
    routes.forEach((route) => {
      if (!route.to) return
      const from = stepById.get(route.from)
      const to = stepById.get(route.to)
      if (!from || !to || !isVisible(from) || !isVisible(to)) return
      const fromCard = flow.querySelector(`[data-step-id="${route.from}"]`)
      const toCard = flow.querySelector(`[data-step-id="${route.to}"]`)
      if (!fromCard || !toCard) return

      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('d', getEdgePath(svg, fromCard, toCard, from, to))
      path.setAttribute(
        'class',
        `edge-path ${routeClass(route.kind)}${route.from === selectedId || route.to === selectedId ? ' is-active' : ''}`
      )
      path.setAttribute('data-route-id', route.id)
      path.setAttribute('marker-end', 'url(#arrow)')
      const tooltip = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'title'
      )
      tooltip.textContent = `${route.id}: ${route.kind}; ${route.predicate}`
      path.appendChild(tooltip)
      svg.appendChild(path)
    })
  }

  const routesForStep = (stepId, direction) =>
    routes
      .filter((route) => route[direction] === stepId)
      .map(
        (route) =>
          `${route.id} [${route.kind}]: ${route.predicate}; ${route.from} -> ${route.to ?? 'terminal'}; artifacts ${route.producedArtifacts.join(', ')}`
      )

  const artifactsOwnedBy = (stepId) =>
    artifacts
      .filter((artifact) => artifact.ownerStepId === stepId)
      .map(
        (artifact) =>
          `${artifact.id}: ${artifact.channel}; consumers ${artifact.consumerStepIds.join(', ') || 'terminal'}`
      )

  const artifactsConsumedBy = (stepId) =>
    artifacts
      .filter((artifact) => artifact.consumerStepIds.includes(stepId))
      .map(
        (artifact) =>
          `${artifact.id}: owner ${artifact.ownerStepId}; ${artifact.channel}`
      )

  const invariantsForStep = (stepId) =>
    invariants
      .filter((invariant) => invariant.stepIds.includes(stepId))
      .map(
        (invariant) =>
          `${invariant.id}: ${invariant.statement}; refs ${invariant.specRefs.join(', ')}`
      )

  const acceptanceForStep = (stepId) =>
    acceptanceContracts
      .filter((contract) => contract.stepIds.includes(stepId))
      .map(
        (contract) =>
          `${contract.id}: ${contract.assertions.join('; ')}; refs ${contract.specRefs.join(', ')}`
      )

  const renderHeader = () => {
    document.title = target.title
    title.textContent = target.title
    subtitle.textContent = target.subtitle
    headerLinks.innerHTML = links
      .map(
        (link) =>
          `<a class="header-link" href="${escapeHtml(link.href)}" data-link-kind="${escapeHtml(link.kind)}">${escapeHtml(link.label)}</a>`
      )
      .join('')
    targetSummary.innerHTML = [
      `Target: <code>${escapeHtml(target.kind)}:${escapeHtml(target.id)}</code>`,
      `Schema: <code>${escapeHtml(schema.id)}/v${escapeHtml(schema.version)}</code>`,
      `Semantic authority: <code>${escapeHtml(authority.specPath)}</code>`,
      `Inspector data: <code>${escapeHtml(authority.inspectorPath)}</code>`
    ].join('<br />')
  }

  const renderFilters = () => {
    filters.innerHTML = ''
    ;[{ id: 'All', title: 'All' }, ...lanes].forEach((lane) => {
      const button = document.createElement('button')
      button.className = `filter-button${lane.id === selectedLaneId ? ' is-active' : ''}`
      button.type = 'button'
      button.textContent = lane.title
      button.addEventListener('click', () => {
        selectedLaneId = lane.id
        const selectedStep = stepById.get(selectedId)
        if (selectedStep && !isVisible(selectedStep)) {
          selectedId = steps.find(isVisible)?.id ?? steps[0]?.id ?? null
        }
        render()
      })
      filters.appendChild(button)
    })
  }

  const renderDetail = () => {
    const selected = stepById.get(selectedId) ?? steps[0]
    if (!selected) {
      detail.innerHTML = '<p>No steps are declared.</p>'
      return
    }
    const lane = laneById.get(selected.laneId)
    detail.innerHTML = `
      <div class="detail-group">${escapeHtml(lane?.title ?? selected.laneId)}</div>
      <div class="detail-heading">
        <span class="step-number">Step ${escapeHtml(selected.order)}</span>
        <h2>${escapeHtml(selected.title)}</h2>
      </div>
      <p class="detail-summary">${escapeHtml(selected.purpose)}</p>
      ${section('Target links', links, 'rule-box')}
      ${section('Owner package', [selected.ownerPackage], 'alignment-box')}
      ${section('Inputs', selected.inputs)}
      ${section('Outputs', selected.outputs)}
      ${section('Conditions', selected.conditions, 'trace-box')}
      ${section('Bypasses', selected.bypasses, 'trace-box')}
      ${section('Allowed contributors', selected.allowedContributors, 'evidence-box')}
      ${section('Forbidden contributors', selected.forbiddenContributors, 'risk-box')}
      ${section('Cache dimensions', selected.cacheDimensions, 'trace-box')}
      ${section('Implementation boundary', selected.implementationBoundary)}
      ${section('Spec references', selected.specRefs, 'rule-box')}
      ${section('Failure owner step', [selected.failureOwnerStepId], 'risk-box')}
      ${section('Incoming routes', routesForStep(selected.id, 'to'), 'trace-box')}
      ${section('Outgoing routes', routesForStep(selected.id, 'from'), 'trace-box')}
      ${section('Owned artifacts', artifactsOwnedBy(selected.id), 'trace-box')}
      ${section('Consumed artifacts', artifactsConsumedBy(selected.id), 'trace-box')}
      ${section('Invariants', invariantsForStep(selected.id), 'evidence-box')}
      ${section('Acceptance contracts', acceptanceForStep(selected.id), 'test-box')}`
  }

  const renderFlow = () => {
    flow.innerHTML = ''
    const bounds = getFlowBounds()
    flow.style.minWidth = `${bounds.width}px`
    flow.style.minHeight = `${bounds.height}px`

    lanes.forEach((lane, laneIndex) => {
      const label = document.createElement('div')
      label.className = 'lane-label'
      label.style.left = `${layout.left + laneIndex * (layout.cardW + layout.gapX)}px`
      label.textContent = lane.title
      flow.appendChild(label)
    })

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'flow-svg')
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`)
    svg.style.width = `${bounds.width}px`
    svg.style.height = `${bounds.height}px`
    svg.innerHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.62)"></path>
        </marker>
      </defs>`
    flow.appendChild(svg)

    steps.filter(isVisible).forEach((step) => {
      const position = stepPosition(step)
      const lane = laneById.get(step.laneId)
      const tags = step.tags ?? []
      const card = document.createElement('button')
      card.type = 'button'
      card.className = [
        'step-card',
        step.id === selectedId ? 'is-selected' : '',
        tags.includes('risk') ? 'is-risk' : '',
        tags.includes('critical') ? 'is-critical' : '',
        tags.includes('blocker') ? 'is-blocker' : ''
      ]
        .filter(Boolean)
        .join(' ')
      card.style.left = `${position.x}px`
      card.style.top = `${position.y}px`
      card.dataset.stepId = step.id
      card.innerHTML = `
        <div class="step-kicker">
          <span class="step-number">Step ${escapeHtml(step.order)}</span>
          <span>${escapeHtml(lane?.title ?? step.laneId)}</span>
        </div>
        <div class="step-title">${escapeHtml(step.title)}</div>
        <div class="step-summary">${escapeHtml(step.purpose)}</div>
        <div class="badge-row">
          <span class="badge truth">${escapeHtml(step.ownerPackage)}</span>
          ${tags
            .slice(0, 2)
            .map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`)
            .join('')}
        </div>`
      card.addEventListener('click', () => {
        selectedId = step.id
        render()
      })
      flow.appendChild(card)
    })

    renderEdges(svg)
  }

  const runStaticChecks = () => {
    const errors = []
    const uniqueIds = (label, items) => {
      const seen = new Set()
      items.forEach((item) => {
        if (seen.has(item.id)) errors.push(`${label}:duplicate:${item.id}`)
        seen.add(item.id)
      })
    }
    uniqueIds('lane', lanes)
    uniqueIds('step', steps)
    uniqueIds('route', routes)
    uniqueIds('artifact', artifacts)
    uniqueIds('invariant', invariants)
    uniqueIds('acceptance', acceptanceContracts)

    if (!target?.id || !target?.kind || !target?.title) {
      errors.push('target:incomplete')
    }

    const requiredStepFields = [
      'id',
      'order',
      'laneId',
      'title',
      'ownerPackage',
      'purpose',
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'cacheDimensions',
      'implementationBoundary',
      'specRefs',
      'failureOwnerStepId'
    ]
    steps.forEach((step) => {
      requiredStepFields.forEach((field) => {
        if (step[field] === undefined)
          errors.push(`${step.id}:missing:${field}`)
      })
      if (!laneById.has(step.laneId)) errors.push(`${step.id}:lane`)
      if (!stepById.has(step.failureOwnerStepId)) {
        errors.push(`${step.id}:failureOwnerStepId`)
      }
      step.inputs
        .filter((input) => input.startsWith('artifact:'))
        .forEach((artifactId) => {
          if (!artifactById.has(artifactId)) {
            errors.push(`${step.id}:input:${artifactId}`)
          }
        })
      step.outputs.forEach((artifactId) => {
        if (!artifactById.has(artifactId)) {
          errors.push(`${step.id}:output:${artifactId}`)
        }
      })
    })

    routes.forEach((route) => {
      if (!stepById.has(route.from)) errors.push(`${route.id}:from`)
      if (route.to && !stepById.has(route.to)) errors.push(`${route.id}:to`)
      route.producedArtifacts.forEach((artifactId) => {
        const artifact = artifactById.get(artifactId)
        if (!artifact) {
          errors.push(`${route.id}:artifact:${artifactId}`)
          return
        }
        if (artifact.ownerStepId !== route.from) {
          errors.push(`${route.id}:artifact-owner:${artifactId}`)
        }
        if (route.to && !artifact.consumerStepIds.includes(route.to)) {
          errors.push(`${route.id}:artifact-consumer:${artifactId}`)
        }
      })
    })

    artifacts.forEach((artifact) => {
      const owner = stepById.get(artifact.ownerStepId)
      if (!owner) {
        errors.push(`${artifact.id}:owner`)
      } else if (!owner.outputs.includes(artifact.id)) {
        errors.push(`${artifact.id}:owner-output`)
      }
      artifact.consumerStepIds.forEach((stepId) => {
        const consumer = stepById.get(stepId)
        if (!consumer) {
          errors.push(`${artifact.id}:consumer:${stepId}`)
        } else if (!consumer.inputs.includes(artifact.id)) {
          errors.push(`${artifact.id}:consumer-input:${stepId}`)
        }
      })
      if (!artifact.terminal && !artifact.consumerStepIds.length) {
        errors.push(`${artifact.id}:missing-consumer`)
      }
    })

    invariants.forEach((invariant) => {
      invariant.stepIds.forEach((stepId) => {
        if (!stepById.has(stepId)) {
          errors.push(`${invariant.id}:step:${stepId}`)
        }
      })
      invariant.artifactIds.forEach((artifactId) => {
        if (!artifactById.has(artifactId)) {
          errors.push(`${invariant.id}:artifact:${artifactId}`)
        }
      })
    })

    acceptanceContracts.forEach((contract) => {
      contract.stepIds.forEach((stepId) => {
        if (!stepById.has(stepId)) {
          errors.push(`${contract.id}:step:${stepId}`)
        }
      })
    })

    if (errors.length) {
      console.error('Flow Inspector static check failed', {
        target: target.id,
        errors
      })
    } else {
      console.info('Flow Inspector static check passed', {
        target: target.id,
        lanes: lanes.length,
        steps: steps.length,
        routes: routes.length,
        artifacts: artifacts.length,
        invariants: invariants.length,
        acceptanceContracts: acceptanceContracts.length
      })
    }
  }

  const runLayoutChecks = () => {
    const cards = [...flow.querySelectorAll('.step-card')].map((card) => {
      const rect = card.getBoundingClientRect()
      return {
        id: card.dataset.stepId,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      }
    })
    const overlaps = []
    cards.forEach((card, index) => {
      cards.slice(index + 1).forEach((other) => {
        const overlapX =
          Math.min(card.right, other.right) - Math.max(card.left, other.left)
        const overlapY =
          Math.min(card.bottom, other.bottom) - Math.max(card.top, other.top)
        if (overlapX > 8 && overlapY > 8) {
          overlaps.push(`${card.id}:${other.id}`)
        }
      })
    })
    if (overlaps.length) {
      console.error('Flow Inspector layout check failed', { overlaps })
    } else {
      console.info('Flow Inspector layout check passed', {
        cards: cards.length
      })
    }
  }

  const render = () => {
    renderHeader()
    renderFilters()
    renderFlow()
    renderDetail()
    runLayoutChecks()
  }

  runStaticChecks()
  ensureFlowViewport()
  render()
  window.addEventListener('resize', () => {
    const svg = flow.querySelector('.flow-svg')
    if (svg) renderEdges(svg)
  })
})()
