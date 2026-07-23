import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('production bundle keeps the deployable collaboration reference composition', async () => {
  const result = await build({
    root: appRoot,
    configFile: path.resolve(appRoot, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
    build: {
      emptyOutDir: false,
      write: false
    }
  })
  const buildResults = Array.isArray(result) ? result : [result]
  const chunks = buildResults.flatMap((buildResult) => buildResult.output)
  const moduleIds = chunks
    .filter((output) => output.type === 'chunk')
    .flatMap((chunk) => Object.keys(chunk.modules))
  const bundledCode = chunks
    .filter((output) => output.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')

  assert.equal(
    moduleIds.some(
      (moduleId) =>
        /[/\\]apps[/\\]asyra-design[/\\]src[/\\]collaboration[/\\]/.test(
          moduleId
        ) ||
        /[/\\]packages[/\\]collaboration[/\\](?:src|dist)[/\\]/.test(moduleId)
    ),
    true,
    'deployable collaboration modules are missing from the production graph'
  )
  ;['__AsyraCollaboration__', '/asyra-design-collaboration'].forEach(
    (marker) => {
      assert.equal(
        bundledCode.includes(marker),
        true,
        `production bundle is missing collaboration marker: ${marker}`
      )
    }
  )
})
