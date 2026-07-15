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
  assert.doesNotMatch(renderAppSource, /destroyRenderApp/)
})
