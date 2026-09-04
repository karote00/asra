import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import {
  encodeGlb,
  triangleFixture
} from '../../src/engine/glb/__tests__/fixtures'

const fixture = triangleFixture(),
  bytes = Buffer.from(encodeGlb(fixture.json, fixture.binary))
const digest = createHash('sha256').update(bytes).digest('hex')
async function chooseVisual(page: Page) {
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.locator('.glb-preview > summary').click()
  await page.getByLabel('Choose visual GLB').setInputFiles({
    name: 'reference.glb',
    mimeType: 'model/gltf-binary',
    buffer: bytes
  })
  await expect(page.locator('.asset-summary')).toContainText(digest)
  await page
    .getByLabel('Visual target body')
    .selectOption({ label: 'fixture post' })
  await page
    .getByRole('button', { name: 'Preview placement in 3D', exact: true })
    .click()
  await expect(page.locator('.viewport-summary')).toContainText(
    'Visual preview · not accepted'
  )
}
async function exportProject(page: Page) {
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  const pending = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Export project', exact: true })
    .click()
  const stream = await (await pending).createReadStream()
  if (!stream) throw new Error('Missing portable download')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
async function importProject(page: Page, payload: unknown) {
  await page
    .getByLabel('Portable project file', { exact: true })
    .setInputFiles({
      name: 'reference.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload))
    })
  await expect(page.getByTestId('project-import-preview')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Import and replace current project' })
    .click()
}

test('previews, accepts, edits, undoes and reopens a visual without changing proxy geometry', async ({
  page
}, info) => {
  const errors: string[] = [],
    external: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !==
        new URL(String(info.project.use.baseURL)).origin
    )
      external.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const depth = await page.getByTestId('history-depth').textContent()
  await chooseVisual(page)
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await page.locator('.glb-preview').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('visual-preview.png') })
  await page
    .getByRole('button', { name: 'Accept visual reference', exact: true })
    .click()
  await expect(page.locator('.glb-preview')).toContainText('one Undo action')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 3')
  await expect(page.locator('.viewport-summary')).toContainText(
    '11 analysis shapes'
  )
  const canvas = page.getByTestId('workcell-canvas').locator('canvas'),
    accepted = await canvas.screenshot()
  await page.getByLabel('Visuals', { exact: true }).uncheck()
  expect((await canvas.screenshot()).equals(accepted)).toBe(false)
  await page.getByLabel('Visuals', { exact: true }).check()
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 3')
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click()
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await page.getByRole('button', { name: '↷ Redo', exact: true }).click()
  expect((await canvas.screenshot()).equals(accepted)).toBe(true)
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.locator('.visual-bindings > summary').click()
  const reference = page.getByRole('group', {
    name: 'Visual reference 1',
    exact: true
  })
  await reference.getByLabel('Visual scale X', { exact: true }).fill('0.5')
  await reference.getByLabel('Visual scale X', { exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await page.locator('.visual-bindings > summary').click()
  await expect(
    reference.getByLabel('Visual scale X', { exact: true })
  ).toHaveValue('0.5')
  await expect(page.locator('.viewport-summary')).toContainText(
    '11 analysis shapes'
  )
  await reference.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('visual-binding.png') })
  const payload = await exportProject(page)
  expect(payload.visualSources).toHaveLength(1)
  expect(payload.visualSources[0].assetId).toBe(digest)
  expect(Buffer.from(payload.visualSources[0].base64, 'base64')).toEqual(bytes)
  const damaged = structuredClone(payload),
    invalid = Buffer.from(bytes)
  invalid[0] = 0
  damaged.visualSources[0].base64 = invalid.toString('base64')
  await importProject(page, damaged)
  await expect(
    page.getByRole('dialog', { name: 'Local projects' })
  ).toBeVisible()
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 4')
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await importProject(page, payload)
  await expect(
    page.getByRole('dialog', { name: 'Local projects' })
  ).toHaveCount(0)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.locator('.visual-bindings > summary').click()
  await expect(
    reference.getByLabel('Visual scale X', { exact: true })
  ).toHaveValue('0.5')
  await page.screenshot({ path: info.outputPath('visual-reopened.png') })
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      scope: 'files:e2e/__tests__/visual-references.spec.ts',
      command:
        'yarn workspace @asyra/asyra-sim test:e2e e2e/__tests__/visual-references.spec.ts --reporter=line',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      sourceDigest: digest,
      selectedId: await page
        .getByRole('treeitem', { name: '◇ fixture post', exact: true })
        .getAttribute('data-object-id'),
      visualScale: [0.5, 1, 1],
      proxyCount: 11,
      screenshots: [
        'visual-preview.png',
        'visual-binding.png',
        'visual-reopened.png'
      ],
      pipeline:
        'ordinary Features, owned decoder worker, canonical bindings, CUSTOM spatial projection, portable reset'
    })
  })
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('keeps a historical-only visual source available for replay after portable replacement', async ({
  page
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await chooseVisual(page)
  await page
    .getByRole('button', { name: 'Accept visual reference', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  await expect(page.getByTestId('analysis-result')).toBeVisible({
    timeout: 20000
  })
  await page.getByRole('button', { name: 'Retain result', exact: true }).click()
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.locator('.visual-bindings > summary').click()
  await page
    .getByRole('button', { name: 'Remove visual reference 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click()
  const payload = await exportProject(page)
  expect(payload.visualSources[0].assetId).toBe(digest)
  expect(
    payload.runs[0].snapshot.workcell.bodies.find(
      (body: { name: string }) => body.name === 'fixture post'
    ).visuals[0].assetId
  ).toBe(digest)
  await importProject(page, payload)
  await expect(
    page.getByRole('dialog', { name: 'Local projects' })
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Runs & compare', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Runs and comparison' })
  await library.locator('.evidence-pair > summary').first().click()
  await library
    .getByRole('button', { name: 'Replay pair', exact: true })
    .first()
    .click()
  await expect(page.locator('.viewport-summary')).toContainText(
    'Historical run replay'
  )
  await page.screenshot({ path: info.outputPath('historical-visual.png') })
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      scope: 'files:e2e/__tests__/visual-references.spec.ts',
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      runId: payload.runs[0].result.runId,
      snapshotId: payload.runs[0].snapshot.snapshotId,
      sourceDigest: digest,
      screenshots: ['historical-visual.png'],
      historicalOnly: true
    })
  })
  expect(errors).toEqual([])
})
