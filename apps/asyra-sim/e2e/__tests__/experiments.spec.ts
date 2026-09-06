import { expect, test } from '@playwright/test'

test('ordinary experiment controls run, replay frozen evidence, preserve edits, and cancel', async ({
  page
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  const originalOptionCount = await page
    .getByLabel('Experiment', { exact: true })
    .locator('option')
    .count()
  await expect(
    page.getByRole('button', { name: 'Save experiment', exact: true })
  ).toBeDisabled()
  const depth = await page.getByTestId('history-depth').textContent()
  await page.getByLabel('Sampled trajectory preview time').press('End')
  await expect(page.locator('.viewport-summary')).toContainText(
    'Sampled preview - 8.0000 s'
  )
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  await expect(page.getByTestId('preflight-report')).toContainText(
    'Ready for formal local analysis'
  )
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  const result = page.getByTestId('analysis-result')
  await expect(result).toBeVisible({ timeout: 20000 })
  await expect(result).toContainText('Execution')
  await expect(result).toContainText('Coverage')
  await expect(result).toContainText('Witness upper bound')
  await result.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('experiment-result.png') })
  await result.locator('.evidence-pair > summary').first().click()
  await result
    .getByRole('button', { name: 'Replay pair', exact: true })
    .first()
    .click()
  await expect(page.locator('.viewport-summary')).toContainText(
    'Historical run replay'
  )
  await page.screenshot({ path: info.outputPath('experiment-replay.png') })
  await page.getByLabel('Minimum clearance (mm)').fill('30')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  await expect(result).toContainText('Historical inputs differ')
  await expect(
    page.getByRole('button', { name: 'Save experiment', exact: true })
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Cancel analysis', exact: true })
    .click()
  await expect(result).toContainText('cancelled')
  await expect(result).toContainText('partial')
  await page
    .getByRole('button', { name: 'New experiment', exact: true })
    .click()
  await page.getByLabel('Experiment name').fill('Independent static study')
  await page
    .getByRole('button', { name: 'Create experiment', exact: true })
    .click()
  await expect(
    page.getByLabel('Experiment', { exact: true }).locator('option')
  ).toHaveCount(originalOptionCount + 1)
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      scope: 'files:e2e/__tests__/experiments.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      screenshots: ['experiment-result.png', 'experiment-replay.png'],
      pipeline:
        'ordinary Features, frozen snapshot, production worker, CUSTOM renderer'
    })
  })
  expect(errors).toEqual([])
})

test('invalid trajectory mapping and empty scope are actionable without mutating the model', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.locator('.trajectory-import > summary').click()
  await page.getByLabel('Trajectory source data').fill('time,wrong\n0,abc')
  await page
    .getByRole('button', { name: 'Preview trajectory', exact: true })
    .click()
  await expect(page.locator('.diagnostic-list')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Accept into draft', exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await page.locator('summary').filter({ hasText: 'Analysis scope' }).click()
  await page.getByLabel('Self-collision between primary bodies').uncheck()
  await page.getByLabel('Primary-to-influencing collision').uncheck()
  await page.getByLabel('Excluded pairs', { exact: true }).fill('')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  await expect(page.getByTestId('preflight-report')).toContainText('no-pairs')
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'no checkable collider pairs'
  )
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
})
