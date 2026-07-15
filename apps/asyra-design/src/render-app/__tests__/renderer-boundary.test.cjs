const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const renderAppSource = fs.readFileSync(
  path.resolve(__dirname, '../index.tsx'),
  'utf8'
)
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
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
