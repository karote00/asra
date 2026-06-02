import fs from 'node:fs'
import path from 'node:path'
import { test } from '@playwright/test'
import {
  FAILURE_REPLAY_DIR,
  addFailureMarkerOverlay,
  focusFailureReplayViewport,
  prepareFailureReplayFixture,
  readCanonicalFailureManifest,
  writeFailureReplayReport
} from './stroke-canonical-failure-replay-utils'

test('canonical stroke matrix: replay unit failure manifest with visual markers', async ({
  page
}, testInfo) => {
  testInfo.setTimeout(180_000)
  const manifest = readCanonicalFailureManifest()
  test.skip(
    !manifest || manifest.failures.length === 0,
    'No unit failure manifest found'
  )

  if (!manifest) {
    return
  }

  fs.mkdirSync(FAILURE_REPLAY_DIR, { recursive: true })
  const screenshots: { markerId: string; screenshot: string }[] = []
  for (const failure of manifest.failures) {
    await prepareFailureReplayFixture(page, failure)
    await focusFailureReplayViewport(page, failure)
    await addFailureMarkerOverlay(page, failure)
    const screenshot = path.join(
      FAILURE_REPLAY_DIR,
      `${failure.markerId}-${failure.caseKey.replaceAll(':', '-')}-${failure.errorCode}.png`
    )
    await page.screenshot({ path: screenshot, fullPage: false })
    screenshots.push({ markerId: failure.markerId, screenshot })
  }

  writeFailureReplayReport(manifest, screenshots)
})
