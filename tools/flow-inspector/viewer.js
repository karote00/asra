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
    stages,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  } = data

  const requiredCollections = {
    links,
    lanes,
    stages,
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
  if (schema?.id !== 'asyra.flow-inspector' || schema.version !== 1) {
    throw new Error('Flow Inspector requires schema asyra.flow-inspector/v1.')
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
  const stageById = new Map(stages.map((stage) => [stage.id, stage]))
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact])
  )
  const stagesByLane = new Map(
    lanes.map((lane) => [
      lane.id,
      stages
        .filter((stage) => stage.laneId === lane.id)
        .sort((left, right) => left.order - right.order)
    ])
  )

  const layout = {
    left: 28,
    top: 68,
    cardW: 270,
    cardH: 118,
    gapX: 220,
    gapY: 100
  }

  let selectedId = stages[0]?.id ?? null
  let selectedLaneId = 'All'

  const isVisible = (stage) =>
    selectedLaneId === 'All' || stage.laneId === selectedLaneId

  const getStageLane = (stage) =>
    lanes.findIndex((lane) => lane.id === stage.laneId)

  const getStageRow = (stage) =>
    stagesByLane.get(stage.laneId)?.findIndex((item) => item.id === stage.id) ?? 0

  const stagePosition = (stage) => ({
    x: layout.left + getStageLane(stage) * (layout.cardW + layout.gapX),
    y: layout.top + getStageRow(stage) * (layout.cardH + layout.gapY)
  })

  const getFlowBounds = () => {
    const visibleStages = stages.filter(isVisible)
    const laneIndexes = visibleStages.map(getStageLane)
    const rowIndexes = visibleStages.map(getStageRow)
    const maxLane = laneIndexes.length ? Math.max(...laneIndexes) : 0
    const maxRow = rowIndexes.length ? Math.max(...rowIndexes) : 0
    return {
      width:
        layout.left * 2 +
        (maxLane + 1) * layout.cardW +
        maxLane * layout.gapX,
      height:
        layout.top * 2 +
        (maxRow + 1) * layout.cardH +
        maxRow * layout.gapY
    }
  }

  const toSvgPoint = (svg, x, y) => {
    const point = svg.createSVGPoint()
    point.x = x
    point.y = y
    const matrix = svg.getScreenCTM()
    return matrix ? point.matrixTransform(matrix.inverse()) : { x, y }
  }

  const getEdgePath = (svg, fromCard, toCard, fromStage, toStage) => {
    const fromBox = fromCard.getBoundingClientRect()
    const toBox = toCard.getBoundingClientRect()
    if (fromStage.laneId === toStage.laneId) {
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
      const from = stageById.get(route.from)
      const to = stageById.get(route.to)
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

  const routesForStage = (stageId, direction) =>
    routes
      .filter((route) => route[direction] === stageId)
      .map(
        (route) =>
          `${route.id} [${route.kind}]: ${route.predicate}; ${route.from} -> ${route.to ?? 'terminal'}; artifacts ${route.producedArtifacts.join(', ')}`
      )

  const artifactsOwnedBy = (stageId) =>
    artifacts
      .filter((artifact) => artifact.ownerStageId === stageId)
      .map(
        (artifact) =>
          `${artifact.id}: ${artifact.channel}; consumers ${artifact.consumerStageIds.join(', ') || 'terminal'}`
      )

  const artifactsConsumedBy = (stageId) =>
    artifacts
      .filter((artifact) => artifact.consumerStageIds.includes(stageId))
      .map(
        (artifact) =>
          `${artifact.id}: owner ${artifact.ownerStageId}; ${artifact.channel}`
      )

  const invariantsForStage = (stageId) =>
    invariants
      .filter((invariant) => invariant.stageIds.includes(stageId))
      .map(
        (invariant) =>
          `${invariant.id}: ${invariant.statement}; refs ${invariant.specRefs.join(', ')}`
      )

  const acceptanceForStage = (stageId) =>
    acceptanceContracts
      .filter((contract) => contract.stageIds.includes(stageId))
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
        const selectedStage = stageById.get(selectedId)
        if (selectedStage && !isVisible(selectedStage)) {
          selectedId = stages.find(isVisible)?.id ?? stages[0]?.id ?? null
        }
        render()
      })
      filters.appendChild(button)
    })
  }

  const renderDetail = () => {
    const selected = stageById.get(selectedId) ?? stages[0]
    if (!selected) {
      detail.innerHTML = '<p>No stages are declared.</p>'
      return
    }
    const lane = laneById.get(selected.laneId)
    detail.innerHTML = `
      <div class="detail-group">${escapeHtml(lane?.title ?? selected.laneId)}</div>
      <div class="detail-heading">
        <span class="step-number">Stage ${escapeHtml(selected.order)}</span>
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
      ${section('Failure owner stage', [selected.failureOwnerStageId], 'risk-box')}
      ${section('Incoming routes', routesForStage(selected.id, 'to'), 'trace-box')}
      ${section('Outgoing routes', routesForStage(selected.id, 'from'), 'trace-box')}
      ${section('Owned artifacts', artifactsOwnedBy(selected.id), 'trace-box')}
      ${section('Consumed artifacts', artifactsConsumedBy(selected.id), 'trace-box')}
      ${section('Invariants', invariantsForStage(selected.id), 'evidence-box')}
      ${section('Acceptance contracts', acceptanceForStage(selected.id), 'test-box')}`
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

    stages.filter(isVisible).forEach((stage) => {
      const position = stagePosition(stage)
      const lane = laneById.get(stage.laneId)
      const tags = stage.tags ?? []
      const card = document.createElement('button')
      card.type = 'button'
      card.className = [
        'step-card',
        stage.id === selectedId ? 'is-selected' : '',
        tags.includes('risk') ? 'is-risk' : '',
        tags.includes('critical') ? 'is-critical' : '',
        tags.includes('blocker') ? 'is-blocker' : ''
      ]
        .filter(Boolean)
        .join(' ')
      card.style.left = `${position.x}px`
      card.style.top = `${position.y}px`
      card.dataset.stepId = stage.id
      card.innerHTML = `
        <div class="step-kicker">
          <span class="step-number">Stage ${escapeHtml(stage.order)}</span>
          <span>${escapeHtml(lane?.title ?? stage.laneId)}</span>
        </div>
        <div class="step-title">${escapeHtml(stage.title)}</div>
        <div class="step-summary">${escapeHtml(stage.purpose)}</div>
        <div class="badge-row">
          <span class="badge truth">${escapeHtml(stage.ownerPackage)}</span>
          ${tags.slice(0, 2).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}
        </div>`
      card.addEventListener('click', () => {
        selectedId = stage.id
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
    uniqueIds('stage', stages)
    uniqueIds('route', routes)
    uniqueIds('artifact', artifacts)
    uniqueIds('invariant', invariants)
    uniqueIds('acceptance', acceptanceContracts)

    if (!target?.id || !target?.kind || !target?.title) {
      errors.push('target:incomplete')
    }

    const requiredStageFields = [
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
      'failureOwnerStageId'
    ]
    stages.forEach((stage) => {
      requiredStageFields.forEach((field) => {
        if (stage[field] === undefined) errors.push(`${stage.id}:missing:${field}`)
      })
      if (!laneById.has(stage.laneId)) errors.push(`${stage.id}:lane`)
      if (!stageById.has(stage.failureOwnerStageId)) {
        errors.push(`${stage.id}:failureOwnerStageId`)
      }
    })

    routes.forEach((route) => {
      if (!stageById.has(route.from)) errors.push(`${route.id}:from`)
      if (route.to && !stageById.has(route.to)) errors.push(`${route.id}:to`)
      route.producedArtifacts.forEach((artifactId) => {
        if (!artifactById.has(artifactId)) {
          errors.push(`${route.id}:artifact:${artifactId}`)
        }
      })
    })

    artifacts.forEach((artifact) => {
      if (!stageById.has(artifact.ownerStageId)) {
        errors.push(`${artifact.id}:owner`)
      }
      artifact.consumerStageIds.forEach((stageId) => {
        if (!stageById.has(stageId)) errors.push(`${artifact.id}:consumer:${stageId}`)
      })
      if (!artifact.terminal && !artifact.consumerStageIds.length) {
        errors.push(`${artifact.id}:missing-consumer`)
      }
    })

    invariants.forEach((invariant) => {
      invariant.stageIds.forEach((stageId) => {
        if (!stageById.has(stageId)) {
          errors.push(`${invariant.id}:stage:${stageId}`)
        }
      })
      invariant.artifactIds.forEach((artifactId) => {
        if (!artifactById.has(artifactId)) {
          errors.push(`${invariant.id}:artifact:${artifactId}`)
        }
      })
    })

    acceptanceContracts.forEach((contract) => {
      contract.stageIds.forEach((stageId) => {
        if (!stageById.has(stageId)) {
          errors.push(`${contract.id}:stage:${stageId}`)
        }
      })
    })

    if (errors.length) {
      console.error('Flow Inspector static check failed', { target: target.id, errors })
    } else {
      console.info('Flow Inspector static check passed', {
        target: target.id,
        lanes: lanes.length,
        stages: stages.length,
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
      console.info('Flow Inspector layout check passed', { cards: cards.length })
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
  render()
  window.addEventListener('resize', () => {
    const svg = flow.querySelector('.flow-svg')
    if (svg) renderEdges(svg)
  })
})()
