import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

async function download(page: Page, name: string): Promise<Buffer> {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Missing download stream')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('ordinary field observations preserve immutable evidence, opaque files and history across portable reopening', async ({
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
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Cancel analysis', exact: true })
  ).toHaveCount(0, { timeout: 20000 })
  await expect(page.getByTestId('analysis-result')).toBeVisible()
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  const panel = library.getByRole('region', { name: 'Field observations' })
  await expect(panel).toContainText('Retain this result first')
  const beforeReport = JSON.parse(
    (await download(page, 'Export JSON')).toString('utf8')
  )
  await library
    .getByRole('button', { name: 'Retain selected result', exact: true })
    .click()
  await panel
    .getByRole('button', { name: 'Add field observation', exact: true })
    .click()
  await panel.getByLabel('Observation title').fill('Bench measurement')
  const firstText =
    'Fixture offset measured: 25 mm. Operator note: <img src=x onerror=alert(1)> is untrusted text.'
  await panel.getByLabel('Observation text').fill(firstText)
  const csv = Buffer.from('point,clearance_mm\nfixture,25\n', 'utf8')
  const opaque = Buffer.from(
    '<script>Evidence text, never execute.</script>',
    'utf8'
  )
  await panel
    .getByLabel('Observation attachments', { exact: true })
    .setInputFiles([
      { name: 'measurement.csv', mimeType: 'text/csv', buffer: csv },
      { name: 'operator-note.txt', mimeType: 'text/plain', buffer: opaque }
    ])
  const expectedSources = [csv, opaque].map(
    (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  )
  await expect(
    panel.getByLabel('Prepared observation attachments')
  ).toContainText(expectedSources[0])
  await expect(
    panel.getByLabel('Prepared observation attachments')
  ).toContainText(expectedSources[1])
  await panel.getByLabel('Observation title').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('field-observation-editor.png')
  })
  await panel
    .getByRole('button', { name: 'Save observation', exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('field-observation-files.png')
  })
  const initialDepth = Number(
    (await page.getByTestId('history-depth').innerText()).match(/\d+/)?.[0]
  )
  await panel
    .getByRole('button', { name: 'Save observation', exact: true })
    .click()
  await expect(page.getByTestId('history-depth')).toHaveText(
    `Undo steps: ${initialDepth + 1}`
  )
  const note = panel.locator('.observation-note').first()
  await expect(note).toContainText('revision 1')
  expect(await download(page, 'Download measurement.csv')).toEqual(csv)
  expect(await download(page, 'Download operator-note.txt')).toEqual(opaque)
  expect(await panel.locator('img,script').count()).toBe(0)
  expect(
    JSON.parse((await download(page, 'Export JSON')).toString('utf8'))
  ).toEqual(beforeReport)
  await note
    .getByRole('button', { name: 'Edit observation', exact: true })
    .click()
  await panel
    .getByLabel('Observation text')
    .fill(
      'Second check: 24 mm. Same measurement files; a revised user interpretation.'
    )
  await panel
    .getByRole('button', { name: 'Save observation', exact: true })
    .click()
  await expect(note).toContainText('revision 2')
  const bundle = JSON.parse(
    (await download(page, 'Export field observations')).toString('utf8')
  )
  expect(bundle.runId).toBe(beforeReport.run.result.runId)
  expect(bundle.snapshotId).toBe(beforeReport.run.snapshot.snapshotId)
  expect(
    bundle.sources.map((source: { sourceId: string }) => source.sourceId)
  ).toEqual(expectedSources)
  expect(bundle.observations[0].revision).toBe(2)
  expect(bundle).not.toHaveProperty('result')
  for (const [action, revision] of [
    ['Undo', 1],
    ['Redo', 2]
  ] as const) {
    await library
      .getByRole('button', { name: 'Close runs', exact: true })
      .click()
    await page.getByRole('button', { name: action, exact: true }).click()
    await page
      .getByRole('button', { name: 'Runs & compare', exact: true })
      .click()
    await expect(note).toContainText(`revision ${revision}`)
  }
  page.once('dialog', (dialog) => dialog.dismiss())
  await note
    .getByRole('button', { name: 'Remove observation', exact: true })
    .click()
  await expect(note).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await note
    .getByRole('button', { name: 'Remove observation', exact: true })
    .click()
  await expect(note).toHaveCount(0)
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  await expect(note).toContainText('revision 2')
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('retained-field-observation.png')
  })
  await library.getByRole('button', { name: 'Close runs', exact: true }).click()
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Field validation pilot')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally - Field validation pilot'
  )
  const payload = await download(page, 'Export project'),
    project = JSON.parse(payload.toString('utf8'))
  expect(project.observationSources).toEqual(bundle.sources)
  expect(project.runs[0]).toEqual(beforeReport.run)
  const corrupt = structuredClone(project)
  corrupt.observationSources[0].base64 = `${corrupt.observationSources[0].base64.startsWith('A') ? 'B' : 'A'}${corrupt.observationSources[0].base64.slice(1)}`
  const depthBeforeOpen = await page.getByTestId('history-depth').innerText()
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'damaged-field-evidence.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(corrupt))
    })
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', {
      name: 'Import and replace current project',
      exact: true
    })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'Portable project files' })
      .getByRole('alert')
  ).toContainText('digest')
  await expect(page.getByTestId('history-depth')).toHaveText(depthBeforeOpen)
  await expect(
    page.getByRole('dialog', { name: 'Local projects' })
  ).toBeVisible()
  await page.screenshot({ path: info.outputPath('rejected-field-source.png') })
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'field-evidence.json',
      mimeType: 'application/json',
      buffer: payload
    })
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', {
      name: 'Import and replace current project',
      exact: true
    })
    .click()
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  expect(
    JSON.parse(
      (await download(page, 'Export field observations')).toString('utf8')
    )
  ).toEqual(bundle)
  expect(
    JSON.parse((await download(page, 'Export JSON')).toString('utf8'))
  ).toEqual(beforeReport)
  expect(await download(page, 'Download measurement.csv')).toEqual(csv)
  await panel
    .getByRole('button', { name: 'Add field observation', exact: true })
    .click()
  await panel.getByLabel('Observation title').fill('Text-only follow-up')
  await panel
    .getByLabel('Observation text')
    .fill('No attachments. A user-reported observation only.')
  await panel
    .getByRole('button', { name: 'Save observation', exact: true })
    .click()
  const finalBundle = JSON.parse(
    (await download(page, 'Export field observations')).toString('utf8')
  )
  expect(finalBundle.observations).toHaveLength(2)
  expect(finalBundle.observations[1].attachments).toEqual([])
  expect(finalBundle.sources).toEqual(bundle.sources)
  await panel.locator('.observation-note').last().scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('text-only-field-observation.png')
  })
  await info.attach('visual-review-metadata', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      scope: 'files:e2e/__tests__/field-observations.spec.ts',
      command:
        'yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/field-observations.spec.ts --reporter=line',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      source:
        'Unchanged synthetic six-axis example and its real production-Worker result',
      runId: bundle.runId,
      snapshotId: bundle.snapshotId,
      observations: finalBundle.observations,
      sourceIds: expectedSources,
      screenshots: [
        'field-observation-editor.png',
        'field-observation-files.png',
        'retained-field-observation.png',
        'rejected-field-source.png',
        'text-only-field-observation.png'
      ]
    })
  })
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
