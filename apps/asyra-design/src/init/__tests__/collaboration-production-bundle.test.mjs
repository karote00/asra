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
        /[/\\]src[/\\]collaboration[/\\]/.test(moduleId) ||
        /[/\\](?:packages[/\\]collaboration|node_modules[/\\]@asyra[/\\]collaboration)[/\\](?:src|dist)[/\\]/.test(
          moduleId
        )
    ),
    true,
    'deployable collaboration modules are missing from the production graph'
  )
  assert.equal(
    bundledCode.includes('/collaboration'),
    true,
    'production bundle is missing the collaboration route'
  )
  assert.equal(
    moduleIds.some((moduleId) =>
      /[/\\]apps[/\\]asyra-design[/\\]src[/\\]document-persistence\.ts$/.test(
        moduleId
      )
    ),
    false,
    'browser document persistence must not be bundled'
  )
  assert.equal(
    moduleIds.some((moduleId) =>
      /[/\\]apps[/\\]asyra-design[/\\]src[/\\]toolbar[/\\]reset-stored-document\.ts$/.test(
        moduleId
      )
    ),
    true,
    'the permanent standalone Reset utility is missing from the production graph'
  )
  assert.equal(
    bundledCode.includes('/api/documents/'),
    true,
    'the browser bundle is missing the permanent Reset DELETE endpoint'
  )
  assert.equal(
    bundledCode.includes('/bootstrap-checkpoint'),
    false,
    'browser bootstrap persistence must not be bundled'
  )
  assert.equal(
    bundledCode.includes('/persistence-batches'),
    false,
    'browser persistence batches must not be bundled'
  )
})
