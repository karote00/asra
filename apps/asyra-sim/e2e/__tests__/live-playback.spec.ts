import { expect, test } from '@playwright/test'
import { observePlaybackFeedback } from '../playback-observer'

test('Play detects the original-part collision without a formal run', async ({
  page
}, info) => {
  test.setTimeout(45_000)

  await page.goto('/')

  await expect(page.getByRole('status')).toHaveText('Local runtime ready')

  const history = await page.getByTestId('history-depth').textContent()

  await page.getByRole('button', { name: 'Experiments', exact: true }).click()

  await page.getByLabel('Experiment', { exact: true }).selectOption({
    label: 'Tool and table collision - r1'
  })

  const collision = await observePlaybackFeedback(page, { kind: 'collision' })

  await page
    .getByRole('button', { name: 'Play trajectory', exact: true })
    .click()

  const feedback = page.getByTestId('playback-feedback')

  const observed = await collision()
  expect(observed.text).toContain('Collision detected')

  await expect(
    page.getByRole('button', { name: 'Pause trajectory', exact: true })
  ).toBeVisible()

  expect(observed.text).toContain('fixture table')

  await page
    .getByRole('button', { name: 'Pause trajectory', exact: true })
    .click()
  await page.getByLabel('Sampled trajectory preview time').fill('4')
  await expect(feedback).toContainText('Collision detected')

  await expect(feedback).toHaveAttribute('data-pose-matches', 'true')

  await expect(page.getByTestId('live-observations')).toContainText(
    'checked poses'
  )

  await expect(page.getByTestId('analysis-result')).toHaveCount(0)

  await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')

  await page.screenshot({ path: info.outputPath('live-collision.png') })

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({ path: info.outputPath('live-collision-dark.png') })

  await page.locator('canvas').hover()
  await page.mouse.wheel(0, -240)
  await page.screenshot({ path: info.outputPath('live-collision-closeup.png') })

  const created: string[] = []

  page.on('worker', (worker) => created.push(worker.url()))

  await page.getByRole('button', { name: 'Return to editing pose' }).click()
  await expect(feedback).toHaveCount(0)
  await page.getByLabel('Sampled trajectory preview time').fill('4')
  await expect(feedback).toContainText('Collision detected')
  expect(created).toHaveLength(0)

  await page.setViewportSize({ width: 600, height: 700 })
  await expect(feedback).toBeInViewport()
  await expect
    .poll(async () => (await feedback.boundingBox())?.height ?? Infinity)
    .toBeLessThan(100)
  await page.screenshot({ path: info.outputPath('live-collision-narrow.png') })

  await info.attach('live-playback-review', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      scope: 'files:e2e/__tests__/live-playback.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      pipeline: 'Play / live method Worker / Core CUSTOM projection',
      formalRunCreated: false,
      feedback: await feedback.innerText(),
      screenshots: [
        'live-collision.png',
        'live-collision-dark.png',
        'live-collision-closeup.png',
        'live-collision-narrow.png'
      ]
    })
  })
})

test('known formal witnesses need no Worker, missing poses are checked, and edits retire reusable evidence', async ({
  page
}, info) => {
  test.setTimeout(60_000)

  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByLabel('Experiment', { exact: true })
    .selectOption({ label: 'Tool and table collision - r1' })
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(page.getByTestId('analysis-result')).toBeVisible({
    timeout: 35_000
  })

  const created: string[] = []

  page.on('worker', (worker) => created.push(worker.url()))

  await page.getByLabel('Sampled trajectory preview time').fill('4')

  const feedback = page.getByTestId('playback-feedback')

  await expect(feedback).toContainText('Collision detected', {
    timeout: 10_000
  })
  await expect(feedback).toContainText('Recorded')
  await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
  expect(created).toHaveLength(0)

  await page.screenshot({ path: info.outputPath('recorded-collision.png') })

  await page.getByLabel('Sampled trajectory preview time').fill('3.888')
  await expect(feedback).toContainText('Checked 3.8880 s')
  await expect(feedback).toContainText('Collision detected')
  await expect(feedback).toContainText('Live')
  expect(created).toHaveLength(1)

  await page.getByRole('button', { name: 'Return to editing pose' }).click()
  await page.getByLabel('Minimum clearance (mm)').fill('25')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()

  await expect(feedback).toHaveCount(0)
  await expect(page.getByTestId('live-observations')).toHaveCount(0)
  const collision = await observePlaybackFeedback(page, { kind: 'collision' })
  await page
    .getByRole('button', { name: 'Play trajectory', exact: true })
    .click()
  const observed = await collision()
  expect(observed.text).toContain('Collision detected')
  expect(observed.text).toContain('Live')
  expect(created.length).toBeGreaterThan(0)

  await page.getByRole('treeitem', { name: '◇ fixture table' }).click()

  const mountX = page.getByLabel('Mount position (m) X', { exact: true })

  await mountX.fill('3')
  await mountX.press('Enter')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()

  await expect(feedback).toHaveCount(0)
  await expect(page.getByTestId('live-observations')).toHaveCount(0)
  await page.getByLabel('Sampled trajectory preview time').fill('4')
  await expect(feedback).toContainText('No issue in checked scope', {
    timeout: 15_000
  })
  await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
})
