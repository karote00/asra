import { expect, test, type Page } from '@playwright/test'
import { MethodIds, MethodVersions } from '../../src/constants'

const exampleSelection = `${MethodIds.STATIC_SPHERES}@${MethodVersions.STATIC_SPHERES}`
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Missing download stream')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test('method capabilities block an unsupported ordinary experiment without running or changing geometry', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  const depth = await page.getByTestId('history-depth').textContent()
  await page.getByLabel('Analysis method').selectOption(exampleSelection)
  await expect(page.getByLabel('Method parameter additionalError')).toHaveValue(
    '0'
  )
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  await expect(page.getByTestId('preflight-report')).toContainText(
    'method-capability'
  )
  await expect(page.getByTestId('preflight-report')).toContainText(
    'unsupported-geometry'
  )
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('does not support')
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click()
  await expect(page.getByLabel('Analysis method')).toHaveValue(
    `${MethodIds.CONTINUOUS_CLEARANCE}@${MethodVersions.CONTINUOUS_CLEARANCE}`
  )
})

test('a user builds spheres, selects an independent method, edits uncertainty, and reopens immutable method provenance', async ({
  page
}, info) => {
  test.setTimeout(60000)
  const errors: string[] = [],
    external: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !==
        new URL(info.project.use.baseURL ?? '').origin
    )
      external.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page
    .getByRole('button', { name: '+ New workcell', exact: true })
    .click()
  for (const [name, x, role] of [
    ['Primary sphere', '0', 'tool'],
    ['Obstacle sphere', '1', 'fixture']
  ]) {
    await page
      .getByRole('button', { name: '+ Add fixture', exact: true })
      .click()
    await page.getByLabel('Object name').fill(name)
    await page.getByLabel('Body role').selectOption(role)
    await page.getByLabel('Mount position (m) X', { exact: true }).fill(x)
    await page.getByLabel('Shape 1 type').selectOption('sphere')
    await page
      .getByRole('button', { name: 'Apply changes', exact: true })
      .click()
  }
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.getByLabel('Experiment name').fill('Independent sphere study')
  await page.getByLabel('Analysis method').selectOption(exampleSelection)
  await page.getByLabel('Method parameter additionalError').fill('0.0005')
  await page.locator('summary').filter({ hasText: 'Analysis scope' }).click()
  await page.getByLabel('Primary sphere analysis role').selectOption('primary')
  await page
    .getByLabel('Obstacle sphere analysis role')
    .selectOption('influencing')
  await page.getByLabel('Primary-to-influencing collision').check()
  await page.locator('summary').filter({ hasText: 'Analysis scope' }).click()
  await page.getByText('Method capabilities and trust', { exact: true }).click()
  await expect(page.locator('.method-details')).toContainText('Origin: example')
  await page.screenshot({
    path: info.outputPath('independent-method-settings.png')
  })
  await page.getByText('Method capabilities and trust', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Create experiment', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  const result = page.getByTestId('analysis-result')
  await expect(result).toContainText('No issue found within scope')
  await expect(result).toContainText(MethodIds.STATIC_SPHERES)
  await page.getByRole('button', { name: 'Retain result', exact: true }).click()
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  const report = JSON.parse(await download(page, 'Export JSON'))
  expect(report.run.snapshot.methodDescriptor.manifest).toMatchObject({
    origin: 'example',
    coordinates: 'right-handed-y-up'
  })
  expect(report.run.snapshot.method.settings.parameters).toEqual({
    additionalError: 0.0005
  })
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  const payload = await download(page, 'Export project')
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'methods.json',
      mimeType: 'application/json',
      buffer: Buffer.from(payload)
    })
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Import and replace current project' })
    .click()
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const reopened = JSON.parse(await download(page, 'Export JSON'))
  expect(reopened.run).toEqual(report.run)
  await library
    .getByText('Retained method declaration', { exact: true })
    .click()
  await expect(library).toContainText('Origin: example')
  await page.screenshot({
    path: info.outputPath('retained-method-provenance.png')
  })
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  // This portable fixture represents the same evidence from an unavailable private deployment.
  const privatePayload = JSON.stringify(JSON.parse(payload), (key, value) => {
    if (value === MethodIds.STATIC_SPHERES) return 'private-retired-spheres'
    if (key === 'origin' && value === 'example') return 'private'
    return value
  })
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'private-history.json',
      mimeType: 'application/json',
      buffer: Buffer.from(privatePayload)
    })
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Import and replace current project' })
    .click()
  await page
    .getByLabel('Candidate', { exact: true })
    .selectOption({ label: 'New workcell' })
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await expect(page.getByLabel('Analysis method')).toHaveValue(
    'private-retired-spheres@0.1.0'
  )
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  await expect(page.getByTestId('preflight-report')).toContainText(
    'method-unavailable'
  )
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const privateReport = JSON.parse(await download(page, 'Export JSON'))
  expect(privateReport.run.result.pairEvidence).toEqual(
    report.run.result.pairEvidence
  )
  expect(privateReport.run.snapshot.methodDescriptor.manifest.origin).toBe(
    'private'
  )
  await library
    .getByText('Retained method declaration', { exact: true })
    .click()
  await expect(library).toContainText('Origin: private')
  await page.screenshot({
    path: info.outputPath('unavailable-method-history.png')
  })
  await info.attach('visual-review-metadata', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      scope: 'files:e2e/__tests__/methods.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      bodies: 'Two user-created sphere proxies, explicit positions and roles',
      snapshotId: report.run.snapshot.snapshotId,
      method: report.run.snapshot.method,
      screenshots: [
        'independent-method-settings.png',
        'retained-method-provenance.png',
        'unavailable-method-history.png'
      ]
    })
  })
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
