/* global document, fetch, setTimeout, clearTimeout */
const element = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const byId = (id) => document.getElementById(id)
const cards = new Map()
const flowBadges = new Map()
let capability
let contractDigest
let selectedId = null
let activeId = null
let revision = 0
let refreshing = false
let timer
let historySignature = ''
let recordSignature = ''

async function api(route, body) {
  const options = {}
  if (body !== undefined) {
    options.method = 'POST'
    options.headers = {
      'Content-Type': 'application/json',
      'X-Proof-Capability': capability
    }
    options.body = JSON.stringify(body)
  }
  const response = await fetch(route, options)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error ?? 'Request failed')
  return value
}
function showError(error) {
  byId('error').textContent = error.message
  byId('error').hidden = false
}
async function start(flowIds) {
  try {
    byId('error').hidden = true
    const request = { scenario: byId('scenario').value }
    if (flowIds) request.flowIds = flowIds
    const { id } = await api('/api/runs', request)
    selectedId = id
    revision++
    recordSignature = ''
    await refresh()
  } catch (error) {
    showError(error)
  }
}
function buildFlows(contract) {
  if (contract.digest === contractDigest) return
  contractDigest = contract.digest
  cards.clear()
  flowBadges.clear()
  byId('flows').replaceChildren()
  contract.flows.forEach((flow, index) => {
    const column = element('section', 'flow-column')
    column.dataset.flow = flow.id
    const heading = element('div', 'flow-heading')
    const label = element(
      'div',
      'flow-index',
      'FLOW ' + String(index + 1).padStart(2, '0')
    )
    const badge = element('span', 'badge', 'Unknown')
    label.append(badge)
    flowBadges.set(flow.id, badge)
    heading.append(
      label,
      element('h2', '', flow.title),
      element('p', 'flow-goal', flow.goal)
    )
    column.append(heading)
    flow.steps.forEach((step, stepIndex) => {
      const card = element('article', 'step-card')
      card.dataset.step = step.id
      const top = element('div', 'step-top')
      const status = element('span', 'badge', 'Unknown')
      top.append(
        element(
          'span',
          'step-number',
          'STEP ' + String(stepIndex + 1).padStart(2, '0')
        ),
        status
      )
      card.append(
        top,
        element('h3', '', step.title),
        element('p', 'owner', step.ownerPackage)
      )
      const shared = element(
        'button',
        'shared',
        'Shared responsibility in both flows'
      )
      shared.type = 'button'
      shared.addEventListener('click', () => {
        for (const value of cards.values())
          value.card.dataset.highlight = String(value.stepId === step.id)
      })
      card.append(shared)
      const details = element('details')
      details.append(element('summary', '', 'Inspect contract'))
      const content = element('div', 'contract-body')
      content.append(element('p', '', step.purpose))
      for (const [label, values] of [
        ['Inputs', step.inputs],
        ['Outputs', step.outputs],
        ['Conditions', step.conditions],
        ['Bypasses', step.bypasses],
        ['Allowed contributors', step.allowedContributors],
        ['Forbidden contributors', step.forbiddenContributors],
        ['Implementation boundary', step.implementationBoundary],
        ['Specification references', step.specRefs],
        ['Failure owner', [step.failureOwnerStepId]]
      ]) {
        content.append(element('p', '', label))
        const list = element('ul')
        values.forEach((value) => list.append(element('li', '', value)))
        content.append(list)
      }
      details.append(content)
      card.append(details)
      const failure = element('div', 'failure')
      failure.hidden = true
      card.append(failure)
      const bottom = element('div', 'step-bottom')
      const count = element('span', 'case-count', 'Not verified')
      const run = element('button', 'step-run', 'Verify linked flow')
      run.type = 'button'
      run.setAttribute(
        'aria-label',
        'Verify ' + flow.title + ' - ' + step.title
      )
      run.addEventListener('click', () => start([flow.id]))
      bottom.append(count, run)
      card.append(bottom)
      column.append(card)
      cards.set(flow.id + ':' + step.id, {
        card,
        status,
        count,
        failure,
        run,
        stepId: step.id,
        flowId: flow.id
      })
    })
    byId('flows').append(column)
  })
}
function paintBadge(node, status) {
  node.dataset.status = status
  node.textContent = status[0].toUpperCase() + status.slice(1)
}
function renderRecord(record) {
  const signature = record
    ? record.id +
      record.phase +
      record.snapshot?.digest +
      record.matchesCurrentContract
    : 'empty'
  if (signature === recordSignature) return
  recordSignature = signature
  const evidence = record?.matchesCurrentContract ? record.evidence : null
  paintBadge(byId('overall'), evidence?.status ?? 'unknown')
  byId('checks').textContent =
    (evidence?.passedCount ?? 0) + ' / ' + (evidence?.expectedCount ?? 6)
  let context =
    'No verified snapshot selected. Run the supported flow set to establish a baseline.'
  if (record)
    context =
      record.scenario === 'inverse-regression'
        ? 'NEGATIVE DEMONSTRATION - isolated inverse regression. A failed cancellation flow is the expected demonstration outcome.'
        : 'Evidence for the captured current source. Coverage is limited to the selected flow obligations.'
  if (record?.snapshot && !record.matchesCurrentContract)
    context =
      'Historical contract differs from these cards. Its original evidence remains in the local artifacts; current steps are unverified.'
  if (evidence?.issues.length) context += ' ' + evidence.issues.join(' ')
  if (record?.error) context += ' ' + record.error
  byId('result-context').textContent = context
  byId('source-digest').textContent =
    record?.snapshot?.digest ?? 'No snapshot yet'
  byId('source-head').textContent = record?.snapshot?.head ?? '-'
  byId('attempt-id').textContent = record?.id ?? '-'
  byId('artifacts').textContent = record?.artifactDirectory ?? '-'
  for (const [id, badge] of flowBadges)
    paintBadge(
      badge,
      evidence?.flows.find((flow) => flow.id === id)?.status ?? 'unknown'
    )
  for (const value of cards.values()) {
    const cases =
      evidence?.cases.filter(
        (item) => item.flowId === value.flowId && item.stepId === value.stepId
      ) ?? []
    const item = cases[0]
    const status =
      evidence?.issues.length && item?.status !== 'failed'
        ? 'unknown'
        : (item?.status ?? 'unknown')
    paintBadge(value.status, status)
    value.card.dataset.status = status
    value.count.textContent = 'Not verified'
    if (item)
      value.count.textContent =
        status === 'passed' ? '1 / 1 check passed' : '0 / 1 check passed'
    value.failure.replaceChildren()
    value.failure.hidden = !item || status !== 'failed'
    if (item && status === 'failed') {
      value.failure.append(element('strong', '', item.id + ' - failed'))
      item.failures.forEach((message) =>
        value.failure.append(
          element(
            'pre',
            '',
            message.replace(
              new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'),
              ''
            )
          )
        )
      )
    }
  }
}
function renderHistory(state) {
  const signature = JSON.stringify(state.runs) + selectedId
  if (signature === historySignature) return
  historySignature = signature
  byId('history').replaceChildren()
  if (!state.runs.length)
    byId('history').append(
      element('p', 'muted', 'Your verification history will appear here.')
    )
  state.runs.forEach((run) => {
    const button = element(
      'button',
      '',
      (run.scenario === 'baseline' ? 'Current source' : 'Regression demo') +
        ' - ' +
        run.status
    )
    button.type = 'button'
    button.setAttribute('aria-pressed', String(run.id === selectedId))
    button.append(
      element(
        'small',
        '',
        new Date(run.startedAt).toLocaleTimeString() + ' - ' + run.phase
      )
    )
    button.addEventListener('click', () => {
      selectedId = run.id
      revision++
      recordSignature = ''
      refresh()
    })
    byId('history').append(button)
  })
}
async function refresh() {
  if (refreshing) return
  refreshing = true
  clearTimeout(timer)
  const requestRevision = revision
  try {
    const state = await api('/api/state')
    buildFlows(state.contract)
    activeId = state.activeRunId
    if (!selectedId && state.runs.length) selectedId = state.runs[0].id
    const id = selectedId
    const record = id ? await api('/api/runs/' + id) : null
    if (requestRevision !== revision || id !== selectedId) return
    renderRecord(record)
    renderHistory(state)
    byId('run-state').textContent = activeId
      ? 'Verification running - isolated source'
      : 'Ready to verify'
    byId('run-all').disabled = Boolean(activeId)
    byId('scenario').disabled = Boolean(activeId)
    byId('cancel').disabled = !activeId
    for (const value of cards.values()) value.run.disabled = Boolean(activeId)
  } catch (error) {
    showError(error)
  } finally {
    refreshing = false
    if (activeId || requestRevision !== revision)
      timer = setTimeout(refresh, 500)
  }
}
byId('run-all').addEventListener('click', () => start())
byId('refresh').addEventListener('click', () => refresh())
byId('cancel').addEventListener('click', async () => {
  try {
    await api('/api/runs/' + activeId + '/cancel', {})
    await refresh()
  } catch (error) {
    showError(error)
  }
})
api('/api/session')
  .then((session) => {
    capability = session.capability
    return refresh()
  })
  .catch(showError)
