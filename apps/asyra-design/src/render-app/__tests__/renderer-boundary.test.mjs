import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const renderAppSource = readFileSync(
  path.resolve(testDirectory, '../index.tsx'),
  'utf8'
)
const packageJson = JSON.parse(
  readFileSync(path.resolve(testDirectory, '../../../package.json'), 'utf8')
)

test('Asyra Design delegates default renderer ownership to Core', () => {
  assert.doesNotMatch(renderAppSource, /RenderAdapter|core\.setRenderer/)
  assert.doesNotMatch(renderAppSource, /from ['"]@asyra\/render['"]/)
  assert.doesNotMatch(
    renderAppSource,
    /Pixi|@asyra\/render-engine-pixi|from ['"]pixi\.js['"]/i
  )
  assert.equal(packageJson.dependencies['@asyra/render'], undefined)
  assert.equal(packageJson.dependencies['@asyra/render-engine-pixi'], undefined)
  assert.equal(packageJson.dependencies['@types/pixi.js'], undefined)
})

test('Asyra Design tears down the Core-owned renderer lifecycle', () => {
  assert.match(renderAppSource, /core\.destroy\(\)/)
  assert.doesNotMatch(renderAppSource, /core\.destroyRenderer\(\)/)
  assert.doesNotMatch(renderAppSource, /renderer\.destroy\(\)/)
  assert.match(renderAppSource, /lifecycleRef\.current/)
  assert.match(renderAppSource, /if \(!active\)/)
  assert.doesNotMatch(renderAppSource, /hasInit/)
  assert.doesNotMatch(renderAppSource, /destroyRenderApp/)
})

test('Asyra Design reports active render startup failures', () => {
  assert.doesNotMatch(
    renderAppSource,
    /void lifecycle\.catch\(\(\) => undefined\)/
  )
  assert.match(
    renderAppSource,
    /void lifecycle\.catch\(\(error: unknown\) => \{/
  )
  assert.match(
    renderAppSource,
    /if \(active\) \{\s*console\.error\(\s*'\[RenderApp\] Render startup failed:'/s
  )
})
