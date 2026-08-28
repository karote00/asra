import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import playwrightConfig from '../playwright.config.ts'

const siteRoot = path.resolve(import.meta.dirname, '..')
const e2eRoot = path.join(siteRoot, '__tests__', 'e2e')
const expectedOutputRoot = path.join(siteRoot, 'test-results', 'platform')
const recursiveSiteRoot = path.join(siteRoot, 'apps', 'asyra-framework-site')

test('visual review artifacts stay inside the app-owned output root', async () => {
  assert.equal(
    playwrightConfig.outputDir,
    expectedOutputRoot,
    'Playwright output must be anchored to the site root instead of the current working directory'
  )

  await assert.rejects(
    access(recursiveSiteRoot),
    (error) => error?.code === 'ENOENT',
    'visual review must never recreate apps/asyra-framework-site inside the site app'
  )
})

test('visual specs resolve screenshots through Playwright testInfo', async () => {
  const specFiles = (await readdir(e2eRoot))
    .filter((file) => file.endsWith('.spec.ts'))
    .sort()

  for (const file of specFiles) {
    const source = await readFile(path.join(e2eRoot, file), 'utf8')
    const screenshotPaths = source
      .split('\n')
      .filter((line) => line.includes('path:'))

    for (const screenshotPath of screenshotPaths) {
      assert.match(
        screenshotPath,
        /path:\s*testInfo\.outputPath\(/,
        `${file} screenshot paths must use testInfo.outputPath(...)`
      )
    }
  }
})
