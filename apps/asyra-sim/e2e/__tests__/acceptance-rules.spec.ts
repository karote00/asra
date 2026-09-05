import { expect, test, type Page } from '@playwright/test'
import { MethodIds, MethodVersions } from '../../src/constants'

async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Missing report download')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test('ordinary nested acceptance editing preserves findings, versions, comparisons and portable history', async ({
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
  await page.getByRole('button', { name: 'New workcell', exact: true }).click()
  for (const [name, role] of [
    ['Primary sphere', 'tool'],
    ['Obstacle sphere', 'fixture']
  ]) {
    await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
    await page.getByLabel('Object name').fill(name)
    await page.getByLabel('Body role').selectOption(role)
    await page.getByLabel('Mount position (m) X', { exact: true }).fill('0')
    await page.getByLabel('Shape 1 type').selectOption('sphere')
    await page
      .getByRole('button', { name: 'Apply changes', exact: true })
      .click()
  }
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.getByLabel('Experiment name').fill('Intentional contact study')
  await page
    .getByLabel('Analysis method')
    .selectOption(
      `${MethodIds.STATIC_SPHERES}@${MethodVersions.STATIC_SPHERES}`
    )
  await page.locator('summary').filter({ hasText: 'Analysis scope' }).click()
  await page.getByLabel('Primary sphere analysis role').selectOption('primary')
  await page
    .getByLabel('Obstacle sphere analysis role')
    .selectOption('influencing')
  await page.getByLabel('Primary-to-influencing collision').check()
  await page.locator('summary').filter({ hasText: 'Analysis scope' }).click()
  const initialDepth = await page.getByTestId('history-depth').textContent()
  await page.locator('.acceptance-fields > summary').click()
  await page
    .getByRole('button', { name: 'Add acceptance conditions', exact: true })
    .click()
  await page.getByLabel('Condition 1 type', { exact: true }).selectOption('all')
  await page
    .getByLabel('Condition 1.1 type', { exact: true })
    .selectOption('penetration')
  await page
    .getByLabel('Condition 1.1 expected penetration')
    .selectOption('present')
  await page
    .getByLabel('Condition 1.2 type', { exact: true })
    .selectOption('any')
  await page.getByLabel('Condition 1.2.1 comparison').selectOption('below')
  await page.getByLabel('Condition 1.2.1 threshold (mm)').fill('100')
  await expect(page.getByTestId('history-depth')).toHaveText(initialDepth ?? '')
  await page
    .getByLabel('Condition 1.1 expected penetration')
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('nested-rule-editor.png') })
  await page
    .getByLabel('Condition 1.2.2 threshold (mm)')
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('nested-rule-editor-bottom.png')
  })
  await page
    .getByRole('button', { name: 'Create experiment', exact: true })
    .click()
  await page.locator('.acceptance-fields > summary').click()
  const result = page.getByTestId('analysis-result')
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(result).toContainText('Issue found')
  await expect(result.getByLabel('User verdict')).toHaveText('User: meets')
  await expect(result.locator('.rule-evaluation')).toContainText(
    'Condition 1.2.2 · false'
  )
  await page.getByRole('button', { name: 'Retain result', exact: true }).click()

  await page.locator('.acceptance-fields > summary').click()
  await page
    .getByLabel('Condition 1.1 expected penetration')
    .selectOption('absent')
  const before = await page.getByTestId('history-depth').textContent()
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByTestId('history-depth')).toHaveText(before ?? '')
  await expect(
    page.getByLabel('Condition 1.1 expected penetration')
  ).toHaveValue('present')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(
    page.getByLabel('Condition 1.1 expected penetration')
  ).toHaveValue('absent')
  await page.locator('.acceptance-fields > summary').click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(result.getByLabel('User verdict')).toHaveText(
    'User: does not meet'
  )
  await expect(result).toContainText('rule r2')
  await page.getByRole('button', { name: 'Retain result', exact: true }).click()
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  await library.getByRole('checkbox').nth(0).check()
  await library.getByRole('checkbox').nth(1).check()
  await library
    .getByRole('button', { name: 'Compare selected runs (2/3)' })
    .click()
  await expect(library).toContainText('Decision rules differ')
  await expect(library).toContainText('Not directly comparable')
  const report = JSON.parse(await download(page, 'Export JSON'))
  expect(report.run.result.decision.value).toBe('false')
  expect(report.run.result.findingPairCount).toBe(1)
  expect(report.run.result.rule.revision).toBe(2)
  const csv = await download(page, 'Export CSV')
  expect(csv).toContain('rule_evaluation_json')
  expect(csv).toContain('""value"":""false""')
  expect(await download(page, 'Export HTML')).toContain(
    'User acceptance evaluation'
  )
  await library.locator('.rule-evaluation').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('retained-rule-evaluation.png')
  })
  await library
    .getByRole('region', { name: 'Run history' })
    .getByRole('button')
    .nth(1)
    .click()
  await expect(library.getByLabel('User verdict')).toHaveText('User: meets')
  await expect(library.getByTestId('analysis-result')).toContainText(
    'Issue found'
  )
  await library.locator('.rule-evaluation').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('accepted-finding-evaluation.png')
  })
  await library
    .getByRole('region', { name: 'Run history' })
    .getByRole('button')
    .nth(0)
    .click()
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  const payload = await download(page, 'Export project')
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'acceptance-history.json',
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
  expect(JSON.parse(await download(page, 'Export JSON')).run).toEqual(
    report.run
  )
  await expect(library.locator('.rule-evaluation')).toContainText(
    'Condition 1 · false'
  )
  await info.attach('visual-review-metadata', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      scope: 'files:e2e/__tests__/acceptance-rules.spec.ts',
      command:
        'yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/acceptance-rules.spec.ts --reporter=line',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      source:
        'Two user-created coincident sphere proxies; explicit primary/influencing scope',
      snapshotId: report.run.snapshot.snapshotId,
      rule: report.run.snapshot.rule,
      evaluation: report.run.result.decision,
      screenshots: [
        'nested-rule-editor.png',
        'nested-rule-editor-bottom.png',
        'retained-rule-evaluation.png',
        'accepted-finding-evaluation.png'
      ]
    })
  })
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
