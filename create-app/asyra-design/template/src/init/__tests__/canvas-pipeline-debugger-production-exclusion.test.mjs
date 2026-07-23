import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('production bundle excludes Canvas Pipeline Debugger implementation', async () => {
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
  const outputs = buildResults.flatMap((buildResult) => buildResult.output)
  const chunks = outputs.filter((output) => output.type === 'chunk')
  const bundledCode = chunks.map((chunk) => chunk.code).join('\n')
  const moduleIds = chunks.flatMap((chunk) => Object.keys(chunk.modules))

  assert.ok(chunks.length > 0, 'expected an in-memory production bundle')
  assert.equal(
    moduleIds.some((moduleId) =>
      /[/\\]packages[/\\](?:core|render)[/\\](?:src|dist)[/\\]canvas-pipeline-debugger[/\\]/.test(
        moduleId
      )
    ),
    false,
    'optional Core or Render debugger modules entered the production graph'
  )
  ;[
    'CANVAS_PIPELINE_DEBUGGER_ALREADY_ACTIVE',
    'canvas-pipeline-debugger:overlay',
    'Canvas Pipeline Debugger has been disposed'
  ].forEach((marker) => {
    assert.equal(
      bundledCode.includes(marker),
      false,
      `production bundle contains debugger marker: ${marker}`
    )
  })
})
