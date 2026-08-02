import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('production bundle contains only the formal server-response Agent route', async () => {
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
    'server-response-inbox.ts',
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
      /[/\\]src[/\\]ai[/\\](?:fixtures|mode\.ts|mock-provider\.ts|mock-backend-response-store\.ts)/.test(
        moduleId
      )
    ),
    false,
    'production graph retained a legacy local response source'
  )
  ;['Mock mode', 'mock-ai', 'planId', 'generateActionPlan', 'ai=mock'].forEach(
    (marker) => {
      assert.equal(
        bundledCode.includes(marker),
        false,
        `production bundle retained a legacy Agent marker: ${marker}`
      )
    }
  )
})
