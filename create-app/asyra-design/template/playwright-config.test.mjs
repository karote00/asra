import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

const appDirectory = fileURLToPath(new URL('.', import.meta.url))

const listTests = (config) => {
  const result = spawnSync(
    'yarn',
    ['playwright', 'test', '--list', '--config', config],
    {
      cwd: appDirectory,
      encoding: 'utf8',
      env: process.env
    }
  )
  assert.equal(
    result.status,
    0,
    `Playwright discovery failed for ${config}:\n${result.stderr}`
  )
  return result.stdout
}

test('ordinary and collaboration Playwright suites have separate discovery', () => {
  const ordinary = listTests('playwright.config.ts')
  const collaboration = listTests('playwright.collaboration.config.ts')

  assert.doesNotMatch(ordinary, /collaboration\.spec\.ts/)
  assert.match(collaboration, /collaboration\.spec\.ts/)
  assert.match(collaboration, /Total: [1-9]\d* tests? in 1 file/)
})

test('ordinary Playwright runtime policy is local-friendly and CI fail-fast', async () => {
  const { resolveOrdinaryPlaywrightRuntimePolicy } = await import(
    './playwright-runtime-policy.mjs'
  )

  assert.deepEqual(resolveOrdinaryPlaywrightRuntimePolicy({}), {
    maxFailures: undefined,
    reporter: 'html',
    retries: 0,
    workers: undefined
  })
  assert.deepEqual(
    resolveOrdinaryPlaywrightRuntimePolicy({
      CI: 'true',
      GITHUB_EVENT_NAME: 'pull_request'
    }),
    {
      maxFailures: 1,
      reporter: 'line',
      retries: 0,
      workers: 2
    }
  )
  assert.deepEqual(
    resolveOrdinaryPlaywrightRuntimePolicy({
      CI: 'true',
      GITHUB_EVENT_NAME: 'schedule'
    }),
    {
      maxFailures: undefined,
      reporter: 'line',
      retries: 1,
      workers: 2
    }
  )
})
