import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const component = fs.readFileSync(
  path.join(appRoot, 'components/runtime-atlas.tsx'),
  'utf8'
)
const projection = fs.readFileSync(
  path.join(appRoot, 'components/runtime-atlas-projection.tsx'),
  'utf8'
)
const styles = fs.readFileSync(path.join(appRoot, 'app/globals.css'), 'utf8')

test('Atlas explains outcome and ownership before technical mechanics', () => {
  assert.match(component, /See what changed\. See who owned it\./)
  assert.match(component, /You do not need to read code first\./)
  assert.match(component, /START WITH AN OUTCOME/)
  assert.match(component, /Plain explanation/)
  assert.match(component, /Technical evidence/)
  assert.ok(
    component.indexOf('You do not need to read code first.') <
      component.indexOf('PUBLIC PATH')
  )
})

test('Atlas exposes literal replay controls and visible runtime status', () => {
  for (const action of ['run', 'pause', 'step', 'replay', 'reset']) {
    assert.match(component, new RegExp(`data-atlas-action="${action}"`))
  }
  assert.match(component, /role="status"/)
  assert.match(component, /label: 'PAUSED'/)
  assert.match(component, /tone: 'paused'/)
  assert.match(component, /role="alert"/)
  assert.match(component, /No replacement success result was created\./)
  assert.match(component, /prefers-reduced-motion: reduce/)
  assert.match(component, /event\.key === 'Escape'/)
})

test('Atlas presentation consumes worker evidence without importing Framework runtime', () => {
  assert.match(component, /new Worker\(/)
  assert.match(component, /runtime-atlas\.worker\.ts/)
  assert.doesNotMatch(component, /from '@asyra\//)
  assert.match(component, /snapshot\.evidence/)
  assert.match(component, /completedRuns/)
  assert.match(component, /Comparison appears only after a real run completes/)
})

test('all projection views are explicitly App-owned and Canvas has text equivalence', () => {
  assert.match(projection, /DOWNSTREAM \/ APP-OWNED/)
  assert.equal((projection.match(/<small>App-owned<\/small>/g) ?? []).length, 4)
  assert.match(projection, /aria-label=\{`\$\{projection\.canonical\.label\}/)
  assert.match(projection, /Hierarchy projection/)
  assert.match(projection, /Properties projection/)
  assert.match(projection, /Detached serialized projection/)
  assert.match(projection, /ResizeObserver/)
  assert.match(projection, /devicePixelRatio/)
  assert.doesNotMatch(projection, /\.png|\.jpg|selected-atlas-states/)
})

test('Atlas keeps current browser support and future Headless work separate', () => {
  assert.match(component, /supported browser composition/)
  assert.match(component, /Headless Core and Core Kernel remain Roadmap work/)
  assert.match(
    component,
    /Your\s+App still owns its schema, rules, search, permissions, engines, and\s+domain knowledge/
  )
  assert.match(component, /Roadmap, not current support/)
})

test('Atlas CSS owns responsive, touch, focus, reduced-motion, and forced-color states', () => {
  assert.match(styles, /\.atlas-workbench/)
  assert.match(styles, /min-height:\s*44px/)
  assert.match(styles, /\.atlas-page[^}]*--shell/s)
  assert.match(styles, /@media \(max-width: 767px\)/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /@media \(forced-colors: active\)/)
})
