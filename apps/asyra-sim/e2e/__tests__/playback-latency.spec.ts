import { expect, test } from '@playwright/test'
import { observePlaybackFeedback } from '../playback-observer'

test('first-pass Play presents original-part collision feedback near its checked pose without a report', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByLabel('Experiment', { exact: true })
    .selectOption({ label: 'Tool and table collision - r1' })

  const collision = await observePlaybackFeedback(page, { kind: 'collision' })

  await page
    .getByRole('button', { name: 'Play trajectory', exact: true })
    .click()
  const feedback = page.getByTestId('playback-feedback')
  const first = await collision()
  expect(first.text).toContain('Collision detected')
  const ageSeconds = first.playhead - first.checked

  await info.attach('first-collision-latency', {
    contentType: 'application/json',
    body: JSON.stringify({
      ...first,
      ageSeconds,
      url: page.url(),
      viewport: page.viewportSize(),
      dpr: 1,
      clock: 'ordinary uninterrupted Play',
      pipeline: 'original parts / installed live Worker / Core CUSTOM',
      formalRunCreated: false
    })
  })
  expect(ageSeconds).toBeGreaterThanOrEqual(-0.0001)
  expect(ageSeconds).toBeLessThan(0.2)
  await expect(
    page.getByRole('button', { name: 'Pause trajectory', exact: true })
  ).toBeVisible()
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('first-pass-collision.png') })
  await page
    .getByRole('button', { name: 'Pause trajectory', exact: true })
    .click()
  await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
  await page.screenshot({ path: info.outputPath('exact-pause.png') })
})
