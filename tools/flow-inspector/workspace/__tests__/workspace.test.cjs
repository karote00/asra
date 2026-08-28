/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { JSDOM, VirtualConsole } = require('jsdom')

const workspaceRoot = path.resolve(__dirname, '..')
const bundleSource = fs.readFileSync(
  path.join(workspaceRoot, 'workspace-bundle.data.js'),
  'utf8'
)
const targetSource = fs.readFileSync(
  path.join(workspaceRoot, 'target.js'),
  'utf8'
)
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

const routeFor = (id) => {
  const encoded = encodeURIComponent(id)
  return `?inspector=${encoded}#inspector=${encoded}`
}

const createTarget = (route = '') => {
  const html = fs.readFileSync(path.join(workspaceRoot, 'target.html'), 'utf8')
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: `file://${path.join(workspaceRoot, 'target.html')}${route}`
  })
  dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE = loadBundle()
  dom.window.eval(targetSource)
  return dom
}

const createRenderedTarget = (entry) => {
  const html = fs.readFileSync(path.join(workspaceRoot, 'target.html'), 'utf8')
  const rendererErrors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', (...args) => rendererErrors.push(args))
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: `file://${path.join(workspaceRoot, 'target.html')}${routeFor(entry.id)}`,
    virtualConsole
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
  const originalAppend = dom.window.document.head.append.bind(
    dom.window.document.head
  )
  dom.window.document.head.append = (...nodes) => {
    for (const node of nodes) {
      if (node.tagName === 'SCRIPT') {
        const source =
          node.dataset.rendererKind === 'flow-v2'
            ? viewerSource
            : fs.readFileSync(legacyViewerPath, 'utf8')
        dom.window.eval(source)
        node.dispatchEvent(new dom.window.Event('load'))
      } else originalAppend(node)
    }
  }
  dom.window.FLOW_INSPECTOR_WORKSPACE_BUNDLE = loadBundle()
  dom.window.eval(targetSource)
  dom.workspaceRendererErrors = rendererErrors
  return dom
}

test('workspace entry uses checked-in classic React assets', () => {
  const html = fs.readFileSync(
    path.join(workspaceRoot, 'workspace.html'),
    'utf8'
  )
  const generatedScript = fs.readFileSync(
    path.join(workspaceRoot, 'generated/flow-inspector-workspace.js'),
    'utf8'
  )
  assert.match(html, /id="flow-inspector-workspace-root"/)
  assert.match(html, /\.\/workspace-bundle\.data\.js/)
  assert.match(html, /\.\/generated\/flow-inspector-workspace\.js/)
  assert.match(html, /\.\/generated\/flow-inspector-workspace\.css/)
  assert.doesNotMatch(html, /type="module"/)
  assert.doesNotMatch(generatedScript, /process\.env|\brequire\s*\(/)
  assert.equal(
    fs.existsSync(
      path.join(workspaceRoot, 'generated/flow-inspector-workspace.js')
    ),
    true
  )
  assert.equal(
    fs.existsSync(
      path.join(workspaceRoot, 'generated/flow-inspector-workspace.css')
    ),
    true
  )
})

test('target resolves one included entry only when query and hash match', () => {
  const entry = loadBundle().entries[0]
  const dom = createTarget(routeFor(entry.id))
  assert.equal(dom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.id, entry.id)
  assert.equal(dom.window.document.documentElement.dataset.targetState, 'ready')
  assert.equal(
    dom.window.document.querySelector('[data-target-error]').hidden,
    true
  )
})

test('target rejects missing, mismatched, unknown, and excluded ids', () => {
  for (const route of [
    '',
    '?inspector=one#inspector=two',
    routeFor('missing-target'),
    routeFor('asyra-executable-examples')
  ]) {
    const dom = createTarget(route)
    assert.equal(dom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY, undefined)
    assert.equal(
      dom.window.document.documentElement.dataset.targetState,
      'error'
    )
    assert.equal(
      dom.window.document.querySelector('[data-target-error]').hidden,
      false
    )
    assert.match(
      dom.window.document.querySelector('[data-target-error]').textContent,
      /not available|requires|must match/i
    )
  }
})

test('separate target documents do not retain selected entry globals', () => {
  const [first, second] = loadBundle().entries
  const firstDom = createTarget(routeFor(first.id))
  firstDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.transientMarker = true
  const secondDom = createTarget(routeFor(second.id))
  assert.equal(secondDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.id, second.id)
  assert.equal(
    secondDom.window.FLOW_INSPECTOR_WORKSPACE_ENTRY.transientMarker,
    undefined
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
    assert.equal(
      document.documentElement.dataset.targetState,
      'rendered',
      entry.id
    )
    assert.deepEqual(dom.workspaceRendererErrors, [], entry.id)
    assert.match(
      document.body.textContent,
      new RegExp(entry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    )
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
      assert.match(
        document.body.textContent,
        /read-only compatibility/i,
        entry.id
      )
    }
  }
})

test('rendered target links to standalone entry only when one exists', () => {
  const bundle = loadBundle()
  const withStandalone = bundle.entries.find((entry) => entry.standalonePath)
  const withoutStandalone = bundle.entries.find(
    (entry) => !entry.standalonePath
  )
  assert.match(
    createRenderedTarget(withStandalone)
      .window.document.querySelector('[data-standalone-link]')
      .getAttribute('href'),
    new RegExp(
      withStandalone.standalonePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
  )
  assert.equal(
    createRenderedTarget(withoutStandalone).window.document.querySelector(
      '[data-standalone-link]'
    ),
    null
  )
})
