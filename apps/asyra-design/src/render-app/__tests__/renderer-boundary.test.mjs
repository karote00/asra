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

test('Asyra Design configures only the engine-neutral framework renderer', () => {
  assert.match(
    renderAppSource,
    /import\s+\{\s*RenderAdapter\s*\}\s+from ['"]@asyra\/render['"]/
  )
  assert.doesNotMatch(
    renderAppSource,
    /Pixi|@asyra\/render-engine-pixi|from ['"]pixi\.js['"]/i
  )
  assert.equal(packageJson.dependencies['@asyra/render'], 'workspace:*')
  assert.equal(packageJson.dependencies['@asyra/render-engine-pixi'], undefined)
  assert.equal(packageJson.dependencies['@types/pixi.js'], undefined)
})

test('Asyra Design tears down the exact framework renderer it starts', () => {
  assert.match(renderAppSource, /const renderer = new RenderAdapter\(\)/)
  assert.match(renderAppSource, /core\.setRenderer\(renderer\)/)
  assert.match(renderAppSource, /renderer\.destroy\(\)/)
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
