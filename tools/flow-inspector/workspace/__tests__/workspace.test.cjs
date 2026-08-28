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
