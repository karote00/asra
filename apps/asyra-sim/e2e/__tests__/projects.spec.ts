import { expect, test, type Page } from '@playwright/test'

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
}
async function save(page: Page, name: string, copy = false) {
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill(name)
  await page
    .getByRole('button', {
      name: copy ? 'Save copy' : 'Save project',
      exact: true
    })
    .click()
  await expect(page.getByTestId('persistence-status')).toHaveText(
    `Saved locally · ${name}`
  )
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click()
}
async function open(page: Page, name: string, accept = true) {
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  page.once('dialog', (dialog) => (accept ? dialog.accept() : dialog.dismiss()))
  await page.getByRole('button', { name: `Open ${name}`, exact: true }).click()
}
async function renameFixture(page: Page, current: string, name: string) {
  await page
    .getByRole('treeitem', { name: `◇ ${current}`, exact: true })
    .click()
  await page.getByLabel('Object name').fill(name)
  await page.getByLabel('Object name').press('Enter')
  await expect(
    page.getByRole('treeitem', { name: `◇ ${name}`, exact: true })
  ).toBeVisible()
}

test('local project A/B/A replacement resets history and view without duplicating the model or canvas', async ({
  page
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await ready(page)
  const canvas = page.getByTestId('workcell-canvas').locator('canvas')
  const initialView = await canvas.screenshot()
  await save(page, 'Project A')
  await renameFixture(page, 'fixture post', 'B fixture')
  await save(page, 'Project B', true)
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Missing canvas')
  await page.mouse.move(bounds.x + 100, bounds.y + 100)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 260, bounds.y + 180, { steps: 5 })
  await page.mouse.up()
  await page.getByLabel('Grid', { exact: true }).uncheck()
  await open(page, 'Project A')
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Project A'
  )
  await expect(page.getByLabel('Grid', { exact: true })).toBeChecked()
  expect((await canvas.screenshot()).equals(initialView)).toBe(true)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await expect(page.getByLabel('Object name')).toHaveCount(0)
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await expect(
    page.getByTestId('workcell-canvas').locator('canvas')
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await open(page, 'Project B')
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Project B'
  )
  await page.getByRole('treeitem', { name: '◇ B fixture', exact: true }).click()
  await expect(page.getByLabel('Object name')).toHaveValue('B fixture')
  await open(page, 'Project A')
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Project A'
  )
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await page.screenshot({ path: info.outputPath('reopened-project-a.png') })
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open Project B', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true })
  ).toBeEnabled()
  await page.screenshot({ path: info.outputPath('local-projects.png') })
  await info.attach('review-state.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      baseURL: info.project.use.baseURL,
      viewport: page.viewportSize(),
      candidate: 'A - Baseline workcell',
      selected: 'fixture post',
      selectedId: await page
        .getByRole('treeitem', { name: '◇ fixture post', exact: true })
        .getAttribute('data-object-id'),
      mountX: -0.75,
      grid: true,
      history: 0,
      camera: 'default',
      screenshots: ['reopened-project-a.png', 'local-projects.png']
    })
  })
  expect(errors).toEqual([])
})

test('cancel and invalid target preserve the editable current document', async ({
  page
}) => {
  await ready(page)
  await save(page, 'Stored target')
  await renameFixture(page, 'fixture post', 'Unsaved fixture')
  await open(page, 'Stored target', false)
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click()
  await expect(page.getByLabel('Object name')).toHaveValue('Unsaved fixture')
  const depth = await page.getByTestId('history-depth').textContent()
  await page.evaluate(async () => {
    const path = '/src/storage/indexed-db.ts'
    const { IndexedProjectRepository } = await import(path)
    const repository = new IndexedProjectRepository()
    const { projects } = await repository.list()
    const stored = await repository.read(projects[0].id),
      payload = JSON.parse(stored.payload)
    const elements = payload.document.sceneTree.elements
    const id = Object.keys(elements).find((key) => elements[key].parentId)
    if (!id) throw new Error('Missing parented canonical element')
    elements[id].parentId = 'missing-parent'
    await repository.write(
      {
        ...stored,
        revision: `${stored.revision}-corrupt`,
        payload: JSON.stringify(payload)
      },
      stored.revision
    )
    repository.close()
  })
  await open(page, 'Stored target')
  await expect(page.getByRole('dialog')).toContainText('invalid hierarchy')
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click()
  await expect(page.getByLabel('Object name')).toHaveValue('Unsaved fixture')
  await expect(page.getByTestId('history-depth')).toHaveText(depth ?? '')
  await expect(
    page.getByTestId('workcell-canvas').locator('canvas')
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(12)
})

test('unavailable browser storage reports an error without disabling local editing', async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined })
  })
  await ready(page)
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill('Cannot save')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'IndexedDB is unavailable'
  )
  await expect(page.getByTestId('persistence-status')).toContainText(
    'Save/open error'
  )
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(12)
})

test('failed successor startup exposes recovery and never presents A as editable', async ({
  page
}, info) => {
  await ready(page)
  await save(page, 'Startup target')
  await renameFixture(page, 'fixture post', 'Unsaved recovery fixture')
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error('Blocked successor graphics startup')
    }
  })
  await open(page, 'Startup target')
  await expect(page.getByRole('dialog')).toContainText(
    'Blocked successor graphics startup'
  )
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Add fixture', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByTestId('workcell-canvas').locator('canvas')
  ).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download recovery', exact: true })
    .click()
  const file = await download
  await file.saveAs(info.outputPath('recovered-project.json'))
  const stream = await file.createReadStream()
  if (!stream) throw new Error('Missing recovery download')
  let content = ''
  for await (const chunk of stream) content += String(chunk)
  const recovered = JSON.parse(content)
  expect(recovered.format).toBe('asyra-sim-project')
  expect(JSON.stringify(recovered.document)).toContain(
    'Unsaved recovery fixture'
  )
  await page.screenshot({
    path: info.outputPath('replacement-failure-recovery.png')
  })
})

test('retained load diagnostics stay visible and survive saving a copy', async ({
  page
}) => {
  await ready(page)
  await save(page, 'Needs review')
  await page.evaluate(async () => {
    const path = '/src/storage/indexed-db.ts'
    const { IndexedProjectRepository } = await import(path)
    const repository = new IndexedProjectRepository()
    const { projects } = await repository.list(),
      stored = await repository.read(projects[0].id)
    const payload = JSON.parse(stored.payload)
    payload.loadIssues = [
      {
        path: 'imported-source',
        message: 'Original collider data requires independent review'
      }
    ]
    await repository.write(
      {
        ...stored,
        revision: `${stored.revision}-review`,
        payload: JSON.stringify(payload)
      },
      stored.revision
    )
    repository.close()
  })
  await open(page, 'Needs review')
  await expect(page.getByTestId('load-diagnostics')).toContainText(
    '1 load review requirement'
  )
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Unsaved changes'
  )
  await page.getByTestId('load-diagnostics').locator('summary').click()
  await expect(page.getByTestId('load-diagnostics')).toContainText(
    'Original collider data requires independent review'
  )
  await save(page, 'Review copy', true)
  await open(page, 'Review copy')
  await expect(page.getByTestId('load-diagnostics')).toContainText(
    '1 load review requirement'
  )
  await expect(page.getByTestId('load-diagnostics')).toContainText(
    'Original collider data requires independent review'
  )
})

test('a blank workcell survives an App reload and explicit reopen without an extra example', async ({
  page
}) => {
  await ready(page)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'New workcell', exact: true }).click()
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(2)
  await save(page, 'Blank workcell')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await open(page, 'Blank workcell')
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Blank workcell'
  )
  await expect(page.getByRole('treeitem')).toHaveCount(2)
  await expect(page.getByLabel('Candidate').locator('option')).toHaveCount(1)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await expect(
    page.getByTestId('workcell-canvas').locator('canvas')
  ).toHaveCount(1)
})
