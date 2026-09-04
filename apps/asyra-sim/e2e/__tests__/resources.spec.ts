import { expect, test } from '@playwright/test'

test('ordinary analysis exposes truthful progress and cancellation leaves editing history unchanged', async ({
  page
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .locator('summary')
    .filter({ hasText: 'Numerical settings' })
    .click()
  await page.getByLabel('Global interval budget').fill('20000')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  const depth = await page.getByTestId('history-depth').textContent()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  const progress = page.getByTestId('analysis-progress')
  await expect(progress).toContainText('pair records received')
  await expect(progress).toContainText('not a clearance conclusion')
  await expect(progress).toHaveAttribute('data-run-id', /.+/)
  const state = {
    baseURL: info.project.use.baseURL,
    viewport: page.viewportSize(),
    dpr: 1,
    scope: 'files:e2e/__tests__/resources.spec.ts',
    snapshotId: await progress.getAttribute('data-snapshot-id'),
    runId: await progress.getAttribute('data-run-id'),
    progressText: await progress.textContent(),
    camera: 'default',
    screenshot: 'analysis-progress.png',
    pipeline:
      'ordinary experiment Feature, production worker, validated bounded progress, CUSTOM renderer'
  }
  await progress.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('analysis-progress.png') })
  await page
    .getByRole('button', { name: 'Cancel analysis', exact: true })
    .click()
  await expect(progress).toHaveCount(0)
  await expect(page.getByTestId('analysis-result')).toContainText('cancelled')
  await expect(page.getByTestId('analysis-result')).toContainText('partial')
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify(state)
  })
  expect(errors).toEqual([])
})

test('an oversized GLB is rejected visibly without changing the canonical workcell', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const depth = await page.getByTestId('history-depth').textContent()
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .locator('summary')
    .filter({ hasText: 'GLB visual reference' })
    .click()
  await page.getByLabel('Choose visual GLB').setInputFiles({
    name: 'oversized.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.alloc(16 * 1024 * 1024 + 1)
  })
  const preview = page.locator('.glb-preview')
  await expect(preview).toContainText('no larger than 16 MiB')
  await expect(page.getByLabel('Choose visual GLB')).toBeEnabled()
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await preview.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('oversized-visual.png') })
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      viewport: page.viewportSize(),
      dpr: 1,
      scope: 'files:e2e/__tests__/resources.spec.ts',
      camera: 'default',
      selectedCandidate: await page
        .getByLabel('Candidate', { exact: true })
        .inputValue(),
      screenshot: 'oversized-visual.png',
      sourceBytes: 16 * 1024 * 1024 + 1
    })
  })
})
