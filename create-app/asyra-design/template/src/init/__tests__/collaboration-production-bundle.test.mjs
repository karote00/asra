import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

const buildProductionBundle = async (collaborationEndpoint) => {
  const result = await build({
    root: appRoot,
    configFile: path.resolve(appRoot, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_COLLABORATION_WS_URL':
        collaborationEndpoint === undefined
          ? 'undefined'
          : JSON.stringify(collaborationEndpoint)
    },
    build: {
      emptyOutDir: false,
      write: false
    }
  })
  return (Array.isArray(result) ? result : [result]).flatMap(
    (buildResult) => buildResult.output
  )
}

test('production bundle keeps local-only and configured collaboration modes distinct', async () => {
  const configuredEndpoint = 'wss://collaboration.example.test/socket'
  const [localOnlyChunks, configuredChunks] = await Promise.all([
    buildProductionBundle(undefined),
    buildProductionBundle(configuredEndpoint)
  ])
  const chunks = configuredChunks
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
    localOnlyChunks
      .filter((output) => output.type === 'chunk')
      .some((chunk) => chunk.code.includes(configuredEndpoint)),
    false,
    'local-only production bundle must not contain a configured collaboration endpoint'
  )
  assert.equal(
    bundledCode.includes(configuredEndpoint),
    true,
    'configured production bundle is missing its collaboration endpoint'
  )
  assert.equal(
    bundledCode.includes('ws://127.0.0.1'),
    false,
    'production bundle must not connect a public page to the visitor loopback interface'
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
      /[/\\]src[/\\]toolbar[/\\]reset-stored-document\.ts$/.test(moduleId)
    ),
    true,
    'the permanent standalone Reset utility is missing from the production graph'
  )
  assert.equal(
    bundledCode.includes('/api/documents/'),
    false,
    'the browser bundle must not contain a direct document-backend route'
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
