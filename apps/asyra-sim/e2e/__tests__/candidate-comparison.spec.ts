import { expect, test, type Page } from '@playwright/test'

async function solveAndRetain(page: Page) {
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Cancel analysis', exact: true })
  ).toHaveCount(0, { timeout: 20000 })
  await expect(page.getByTestId('analysis-result')).toBeVisible()
  await page.getByRole('button', { name: 'Retain result', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Retain result', exact: true })
  ).toBeDisabled()
}
async function duplicate(page: Page, name: string) {
  page.once('dialog', (dialog) => dialog.accept(name))
  await page
    .getByRole('button', { name: 'Duplicate candidate', exact: true })
    .click()
  await expect(page.getByRole('status')).toHaveText(
    'Candidate duplicated · one Undo action'
  )
  await expect(
    page.getByLabel('Candidate', { exact: true }).locator('option:checked')
  ).toHaveText(name)
}
async function movePost(page: Page, x: string) {
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.getByLabel('Mount position (m) X', { exact: true }).fill(x)
  await page.getByLabel('Mount position (m) X', { exact: true }).press('Enter')
  await expect(page.getByRole('status')).toContainText('Property updated')
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue(x)
}

test('Undoing the selected duplicate never presents a different candidate as the active model', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await duplicate(page, 'B')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Candidate', { exact: true })).toHaveValue('')
  await expect(page.getByRole('treeitem')).toHaveCount(0)
  await expect(
    page.getByLabel('Candidate', { exact: true }).locator('option:checked')
  ).toHaveText('No active candidate — select one or Redo')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(
    page.getByLabel('Candidate', { exact: true }).locator('option:checked')
  ).toHaveText('B')
  await expect(page.getByRole('treeitem')).toHaveCount(11)
})

test('independent A/B/C candidates retain and compare real runs with traceable body correspondence', async ({
  page
}, info) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await solveAndRetain(page)
  const a = await page.getByLabel('Candidate', { exact: true }).inputValue()
  await duplicate(page, 'B · fixture revision')
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
  await movePost(page, '-0.6')
  await solveAndRetain(page)
  const b = await page.getByLabel('Candidate', { exact: true }).inputValue()
  await duplicate(page, 'C · further revision')
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
  await movePost(page, '-0.45')
  await solveAndRetain(page)
  await page.getByLabel('Candidate', { exact: true }).selectOption(a)
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  await expect(library.getByRole('checkbox')).toHaveCount(3)
  for (let index = 0; index < 3; index++)
    await library.getByRole('checkbox').nth(index).check()
  await library
    .getByRole('button', { name: 'Compare selected runs (3/3)' })
    .click()
  const comparison = library.getByRole('region', { name: 'Run comparison' })
  await expect(comparison).toContainText(
    'Matching method, scope, rule and interval'
  )
  await expect(comparison).toContainText('workcell.bodies')
  await expect(comparison).toContainText('B · fixture revision')
  await expect(comparison).toContainText('C · further revision')
  await comparison.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('three-candidate-comparison.png')
  })
  const pending = page.waitForEvent('download')
  await library
    .getByRole('button', { name: 'Export JSON', exact: true })
    .click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Missing report download')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const report = JSON.parse(Buffer.concat(chunks).toString('utf8')).run
  expect(report.lineage.copiedFromCandidateId).toBe(b)
  expect(
    Object.values(report.lineage.bodyOrigins).every(
      (origin) => (origin as { candidateId: string }).candidateId === a
    )
  ).toBe(true)
  expect(
    report.snapshot.workcell.bodies.find(
      (body: { name: string }) => body.name === 'fixture post'
    ).pose.position[0]
  ).toBe(-0.45)
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      scope: 'files:e2e/__tests__/candidate-comparison.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      candidates: [a, b, report.snapshot.source.candidateId],
      runId: report.result.runId,
      screenshots: ['three-candidate-comparison.png'],
      pipeline:
        'ordinary duplicate Feature, independent canonical candidates, production Worker, lineage-aware comparison'
    })
  })
  expect(errors).toEqual([])
})
