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

const manifest = readCanonicalFailureManifest()

if (!manifest || manifest.failures.length === 0) {
  test('canonical stroke matrix: replay unit failure manifest with visual markers', () => {
    test.skip(true, 'No unit failure manifest found')
  })
} else {
  test.describe('canonical stroke matrix failure replay', () => {
    test.describe.configure({ mode: 'serial' })
    fs.mkdirSync(FAILURE_REPLAY_DIR, { recursive: true })
    const replayRunId =
      process.env.ASYRA_FAILURE_REPLAY_RUN_ID ?? `run-${Date.now()}`
    const screenshots = manifest.failures.flatMap((failure) =>
      (['fill', 'no-fill'] as const).map((replayVariant) => ({
        markerId:
          replayVariant === 'fill'
            ? failure.markerId
            : `${failure.markerId}-no-fill`,
        screenshot: path.join(
          FAILURE_REPLAY_DIR,
          `${failure.markerId}-${failure.caseKey.replaceAll(':', '-')}-${failure.errorCode}-${replayVariant}-${replayRunId}.png`
        )
      }))
    )

    test.afterAll(() => {
      writeFailureReplayReport(manifest, screenshots)
    })

    for (const failure of manifest.failures) {
      for (const replayVariant of ['fill', 'no-fill'] as const) {
        test(`canonical stroke matrix: replay ${failure.markerId} ${replayVariant}`, async ({
          page
        }, testInfo) => {
          testInfo.setTimeout(30_000)
          const markerId =
            replayVariant === 'fill'
              ? failure.markerId
              : `${failure.markerId}-no-fill`
          const screenshot = screenshots.find(
            (entry) => entry.markerId === markerId
          )?.screenshot
          if (!screenshot) {
            throw new Error(`Missing replay screenshot path for ${markerId}`)
          }
          await prepareFailureReplayFixture(page, failure, {
            includeFill: replayVariant === 'fill'
          })
          await focusFailureReplayViewport(page, failure)
          await addFailureMarkerOverlay(page, failure)
          await page.screenshot({ path: screenshot, fullPage: false })
        })
      }
    }
  })
}
