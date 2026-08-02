import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('frontend production bundle contains only the formal HTTP Agent provider', async () => {
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

  ;[
    'server-action-batch-provider.ts',
    'action-batch-endpoint.ts',
    'ai/startup.ts'
  ].forEach((marker) => {
    assert.equal(
      moduleIds.some((moduleId) => moduleId.endsWith(marker)),
      true,
      `production graph is missing formal Agent module: ${marker}`
    )
  })

  assert.equal(
    moduleIds.some((moduleId) =>
      /[/\\](?:samples[/\\]crdt-7076|server[/\\]action-batch|src[/\\]ai[/\\](?:fixtures|mode\.ts|server-response-inbox\.ts))/.test(
        moduleId
      )
    ),
    false,
    'frontend graph retained a backend sample or legacy response source'
  )
  ;[
    'planId',
    'generateActionPlan',
    'Draw only the cat from the reference image',
    'server-response-inbox'
  ].forEach((marker) => {
    assert.equal(
      bundledCode.includes(marker),
      false,
      `production bundle retained a legacy Agent marker: ${marker}`
    )
  })
})
