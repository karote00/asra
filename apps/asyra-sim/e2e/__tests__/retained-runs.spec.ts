import { expect, test, type Download, type Page } from '@playwright/test'

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('Download stream unavailable')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  return downloadText(await pending)
}

test('retains runs with Undo, compares evidence, exports reports, and reopens portable history', async ({
  page
}, info) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  for (const threshold of ['20', '35']) {
    await page.getByLabel('Minimum clearance (mm)').fill(threshold)
    const save = page.getByRole('button', {
      name: 'Save experiment',
      exact: true
    })
    if (await save.isEnabled()) await save.click()
    await page
      .getByRole('button', { name: 'Run formal analysis', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Cancel analysis', exact: true })
    ).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByTestId('analysis-result')).toBeVisible()
    const before = await page.getByTestId('history-depth').innerText()
    await page
      .getByRole('button', { name: 'Retain result', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Retain result', exact: true })
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByTestId('history-depth')).toHaveText(before)
    await expect(
      page.getByRole('button', { name: 'Retain result', exact: true })
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retain result', exact: true })
    ).toBeDisabled()
  }
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  const checkboxes = library.getByRole('checkbox')
  await expect(checkboxes).toHaveCount(2)
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()
  await library
    .getByRole('button', { name: 'Compare selected runs (2/3)' })
    .click()
  const comparison = library.getByRole('region', { name: 'Run comparison' })
  await expect(comparison).toContainText('Not directly comparable')
  await expect(comparison).toContainText('Decision rules differ')
  await comparison.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('retained-comparison.png') })
  const report = JSON.parse(await download(page, 'Export JSON'))
  expect(report.format).toBe('sim-run-report')
  expect(report.run.snapshot.rule.minimumClearance).toBe(0.035)
  expect(report.run.environment.appVersion).toBe('0.1.0-alpha.0')
  expect(await download(page, 'Export CSV')).toContain(report.run.result.runId)
  expect(await download(page, 'Export HTML')).toContain(report.run.result.runId)
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Traceable experiment')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Traceable experiment'
  )
  const payload = await download(page, 'Export project')
  expect(JSON.parse(payload).runs).toHaveLength(2)
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'unsupported.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":999}')
    })
  await expect(
    page
      .getByRole('region', { name: 'Portable project files' })
      .getByRole('alert')
  ).toContainText('Unsupported')
  await expect(page.getByTestId('project-import-preview')).toHaveCount(0)
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'portable.json',
      mimeType: 'application/json',
      buffer: Buffer.from(payload)
    })
  await expect(page.getByTestId('project-import-preview')).toContainText(
    '2 retained runs'
  )
  await page.screenshot({
    path: info.outputPath('portable-project-preview.png')
  })
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Import and replace current project' })
    .click()
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Traceable experiment'
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Import and replace current project' })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Local projects' })
  ).toHaveCount(0)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Unsaved changes'
  )
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  await expect(library.getByRole('checkbox')).toHaveCount(2)
  const reopened = JSON.parse(await download(page, 'Export JSON'))
  expect(reopened.run).toEqual(report.run)
  await expect(
    library.getByRole('button', { name: 'Retain selected result' })
  ).toBeDisabled()
  await library.locator('.evidence-pair > summary').first().click()
  await library
    .getByRole('button', { name: 'Replay pair', exact: true })
    .first()
    .click()
  await expect(page.locator('.viewport-summary')).toContainText(
    'Historical run replay'
  )
  await page.screenshot({ path: info.outputPath('retained-replay.png') })
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      scope: 'files:e2e/__tests__/retained-runs.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      screenshots: [
        'retained-comparison.png',
        'portable-project-preview.png',
        'retained-replay.png'
      ],
      runId: reopened.run.result.runId,
      snapshotId: reopened.run.snapshot.snapshotId,
      pipeline:
        'ordinary Features, immutable retained evidence, portable import, complete App reset, CUSTOM renderer'
    })
  })
  expect(errors).toEqual([])
})
