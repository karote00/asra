/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { JSDOM } = require('jsdom')

const workspaceRoot = path.resolve(__dirname, '..')
const bundleSource = fs.readFileSync(
  path.join(workspaceRoot, 'workspace-bundle.data.js'),
  'utf8'
)
const workspaceSourcePath = path.join(workspaceRoot, 'workspace.js')
const targetSourcePath = path.join(workspaceRoot, 'target.js')
const viewerSource = fs.readFileSync(
  path.resolve(workspaceRoot, '../viewer.js'),
  'utf8'
)
const legacyViewerPath = path.join(workspaceRoot, 'legacy-viewer.js')

const loadBundle = () => {
  const sandbox = { globalThis: {} }
  vm.runInNewContext(bundleSource, sandbox)
  return JSON.parse(
    JSON.stringify(sandbox.globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE)
  )
}

const createWorkspace = (hash = '') => {
  const html = fs.readFileSync(path.join(workspaceRoot, 'workspace.html'), 'utf8')
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: `file://${path.join(workspaceRoot, 'workspace.html')}${hash}`
  })
  dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE = loadBundle()
  dom.window.eval(fs.readFileSync(workspaceSourcePath, 'utf8'))
  return dom
}

const createTarget = (hash = '') => {
  const html = fs.readFileSync(path.join(workspaceRoot, 'target.html'), 'utf8')
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: `file://${path.join(workspaceRoot, 'target.html')}${hash}`
  })
  dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE = loadBundle()
  dom.window.eval(fs.readFileSync(targetSourcePath, 'utf8'))
  return dom
}

const createRenderedTarget = (entry) => {
  const html = fs.readFileSync(path.join(workspaceRoot, 'target.html'), 'utf8')
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: `file://${path.join(workspaceRoot, 'target.html')}#inspector=${encodeURIComponent(entry.id)}`
  })
  dom.window.SVGSVGElement.prototype.createSVGPoint = function () {
    return {
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x, y: this.y }
      }
    }
  }
  dom.window.SVGElement.prototype.getScreenCTM = function () {
    return { inverse: () => ({}) }
  }
  const originalAppend = dom.window.document.head.append.bind(dom.window.document.head)
  dom.window.document.head.append = (...nodes) => {
    for (const node of nodes) {
      if (node.tagName === 'SCRIPT') {
        const source = node.dataset.rendererKind === 'flow-v2'
          ? viewerSource
          : fs.readFileSync(legacyViewerPath, 'utf8')
        dom.window.eval(source)
        node.dispatchEvent(new dom.window.Event('load'))
      } else originalAppend(node)
    }
  }
  dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE = loadBundle()
  dom.window.eval(fs.readFileSync(targetSourcePath, 'utf8'))
  return dom
}

test('workspace route owner files exist', () => {
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'workspace.html')), true)
  assert.equal(fs.existsSync(workspaceSourcePath), true)
})

test('missing hash renders Overview and the complete grouped catalog', () => {
  const dom = createWorkspace()
  const { document } = dom.window
  const bundle = dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE

  assert.equal(document.querySelector('[data-view="overview"]').hidden, false)
  assert.equal(document.querySelector('[data-view="target"]').hidden, true)
  assert.equal(
    document.querySelectorAll('[data-inspector-id]').length,
    bundle.entries.length
  )
  assert.deepEqual(
    [...document.querySelectorAll('[data-group]')].map((node) => node.dataset.group),
    ['Apps', 'Framework', 'Release', 'Tools']
  )
  assert.match(document.body.textContent, /static documentation/i)
  assert.doesNotMatch(document.body.textContent, /runtime healthy/i)
})

test('known deep link selects exactly one entry and navigates the target frame', () => {
  const bundle = loadBundle()
  const selected = bundle.entries.find((entry) => entry.group === 'Tools')
  const dom = createWorkspace(`#inspector=${encodeURIComponent(selected.id)}`)
  const { document } = dom.window

  assert.equal(document.querySelector('[data-view="overview"]').hidden, true)
  assert.equal(document.querySelector('[data-view="target"]').hidden, false)
  assert.equal(document.querySelectorAll('[aria-current="page"]').length, 1)
  assert.equal(
    document.querySelector('[aria-current="page"]').dataset.inspectorId,
    selected.id
  )
  assert.match(
    document.querySelector('[data-target-frame]').getAttribute('src'),
    new RegExp(`#inspector=${encodeURIComponent(selected.id)}$`)
  )
})

test('search filters title, id, subgroup, and labels without changing route', () => {
  const dom = createWorkspace()
  const { document, location } = dom.window
  const search = document.querySelector('[data-search]')
  search.value = 'flow-v2'
  search.dispatchEvent(new dom.window.Event('input', { bubbles: true }))

  const visible = [...document.querySelectorAll('[data-inspector-id]')].filter(
    (node) => !node.hidden
  )
  assert.ok(visible.length > 0)
  assert.ok(visible.length < loadBundle().entries.length)
  assert.equal(location.hash, '')
})

test('groups collapse without changing catalog membership', () => {
  const dom = createWorkspace()
  const { document } = dom.window
  const group = document.querySelector('[data-group="Apps"]')
  const toggle = group.querySelector('[data-group-toggle]')
  const before = document.querySelectorAll('[data-inspector-id]').length

  toggle.click()

  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.equal(group.querySelector('[data-group-items]').hidden, true)
  assert.equal(document.querySelectorAll('[data-inspector-id]').length, before)
})

test('unknown and excluded routes show an explicit error without fallback', () => {
  for (const id of ['missing-target', 'asyra-executable-examples']) {
    const dom = createWorkspace(`#inspector=${id}`)
    const { document } = dom.window
    assert.equal(document.querySelector('[data-view="error"]').hidden, false)
    assert.match(document.querySelector('[data-route-error]').textContent, /not available/i)
    assert.equal(document.querySelector('[data-target-frame]').getAttribute('src'), null)
    assert.equal(document.querySelectorAll('[aria-current="page"]').length, 0)
  }
})

test('click and keyboard activation update the stable hash route', () => {
  for (const eventName of ['click', 'keydown']) {
    const dom = createWorkspace()
    const { document } = dom.window
    const item = document.querySelector('[data-inspector-id]')
    if (eventName === 'click') item.click()
    else {
      item.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        })
      )
    }
    assert.equal(
      dom.window.location.hash,
      `#inspector=${encodeURIComponent(item.dataset.inspectorId)}`
    )
  }
})

test('target document resolves one included entry from its own hash', () => {
  const entry = loadBundle().entries[0]
  const dom = createTarget(`#inspector=${encodeURIComponent(entry.id)}`)

  assert.equal(dom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.id, entry.id)
  assert.equal(dom.window.document.documentElement.dataset.targetState, 'ready')
  assert.equal(dom.window.document.querySelector('[data-target-error]').hidden, true)
})

test('target document rejects missing, unknown, and excluded ids without fallback', () => {
  for (const hash of ['', '#inspector=missing-target', '#inspector=asyra-executable-examples']) {
    const dom = createTarget(hash)
    assert.equal(dom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY, undefined)
    assert.equal(dom.window.document.documentElement.dataset.targetState, 'error')
    assert.equal(dom.window.document.querySelector('[data-target-error]').hidden, false)
    assert.match(
      dom.window.document.querySelector('[data-target-error]').textContent,
      /not available|requires/i
    )
  }
})

test('separate target documents do not retain selected entry globals', () => {
  const [first, second] = loadBundle().entries
  const firstDom = createTarget(`#inspector=${encodeURIComponent(first.id)}`)
  firstDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.transientMarker = true
  const secondDom = createTarget(`#inspector=${encodeURIComponent(second.id)}`)

  assert.equal(secondDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.id, second.id)
  assert.equal(secondDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.transientMarker, undefined)
  assert.notEqual(
    firstDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY,
    secondDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY
  )
})

test('every catalog entry renders through its declared renderer kind', () => {
  for (const entry of loadBundle().entries) {
    const dom = createRenderedTarget(entry)
    const { document } = dom.window
    assert.equal(
      document.documentElement.dataset.rendererKind,
      entry.kind,
      entry.id
    )
    assert.equal(document.documentElement.dataset.targetState, 'rendered', entry.id)
    assert.match(document.body.textContent, new RegExp(entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    if (entry.kind === 'flow-v2') {
      assert.deepEqual(
        JSON.parse(JSON.stringify(dom.window.FLOW_INSPECTOR_DATA)),
        entry.data,
        entry.id
      )
      assert.ok(document.querySelector('[data-flow-v2-shell]'), entry.id)
    } else {
      assert.equal(dom.window.FLOW_INSPECTOR_DATA, undefined, entry.id)
      assert.ok(document.querySelector('[data-compatibility-view]'), entry.id)
      assert.match(document.body.textContent, /read-only compatibility/i, entry.id)
    }
  }
})

test('rendered target links to standalone entry only when one exists', () => {
  const bundle = loadBundle()
  const withStandalone = bundle.entries.find((entry) => entry.standalonePath)
  const withoutStandalone = bundle.entries.find((entry) => !entry.standalonePath)

  assert.match(
    createRenderedTarget(withStandalone)
      .window.document.querySelector('[data-standalone-link]')
      .getAttribute('href'),
    new RegExp(withStandalone.standalonePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  )
  assert.equal(
    createRenderedTarget(withoutStandalone).window.document.querySelector(
      '[data-standalone-link]'
    ),
    null
  )
})
