import { expect, test } from '@playwright/test'
import { readHistoryDepth } from '../history-depth'

test('Undo can remove the initial model and a blank workcell is editable', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const initialDepth = await readHistoryDepth(page)
  for (let remaining = initialDepth - 1; remaining > 0; remaining--) {
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('treeitem')).toHaveCount(11)
    await expect.poll(() => readHistoryDepth(page)).toBe(remaining)
  }
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Add fixture', exact: true })
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  await page.getByRole('button', { name: 'New workcell', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await expect(page.getByRole('treeitem')).toHaveCount(1)
  await expect(page.getByLabel('Object name')).toHaveValue('New fixture')
})

test('normal CUSTOM workbench renders, edits, undoes, resizes, and picks canonical bodies', async ({
  page
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.getByRole('treeitem')).toHaveCount(11)
  const canvas = page.getByTestId('workcell-canvas').locator('canvas')
  await expect(canvas).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('workcell-overview.png') })
  await page.getByRole('treeitem', { name: '◇ fixture post' }).click()
  await expect(page.getByLabel('Object name')).toHaveValue('fixture post')
  await page.getByLabel('Mount position (m) X', { exact: true }).fill('-1.25')
  await page.getByLabel('Object name').click()
  await expect(page.getByRole('status')).toContainText('Property updated')
  await expect(page.getByRole('button', { name: 'Apply changes' })).toHaveCount(
    0
  )
  await expect(page.getByLabel('Object name')).toBeFocused()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-1.25')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-1.25')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
  await page.getByLabel('Length unit').selectOption('mm')
  await expect(
    page.getByLabel('Mount position (mm) X', { exact: true })
  ).toHaveValue('-750')
  await page.getByRole('treeitem', { name: '◉ J1 - Base yaw' }).click()
  await page.setViewportSize({ width: 1600, height: 1050 })
  await expect
    .poll(() =>
      canvas.evaluate((node) => {
        if (!(node instanceof HTMLCanvasElement))
          throw new Error('Expected canvas')
        return [node.width, node.height]
      })
    )
    .toEqual([975, 904])
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Missing canvas surface')
  // Independent perspective projection of the fixed fixture center, not renderer picking.
  const eye = [3.2, 2.4, 3.6],
    target = [0, 0.9, 0],
    point = [-0.75, 0.65, 0.45]
  const normalize = (v: number[]) => {
    const length = Math.hypot(...v)
    return v.map((x) => x / length)
  }
  const dot = (a: number[], b: number[]) =>
    a.reduce((sum, v, i) => sum + v * b[i], 0)
  const forward = normalize(target.map((v, i) => v - eye[i])),
    right = normalize([-forward[2], 0, forward[0]])
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0]
  ]
  const relative = point.map((v, i) => v - eye[i]),
    depth = dot(relative, forward),
    focal = box.height / (2 * Math.tan((23 * Math.PI) / 180))
  await page.mouse.click(
    box.x + box.width / 2 + (dot(relative, right) * focal) / depth,
    box.y + box.height / 2 - (dot(relative, up) * focal) / depth
  )
  await expect(page.getByLabel('Object name')).toHaveValue('fixture post')
  await page.screenshot({ path: testInfo.outputPath('workcell-selected.png') })
  await canvas.screenshot({
    path: testInfo.outputPath('workcell-viewport.png')
  })
  await testInfo.attach('visual-review-metadata', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        url: page.url(),
        scope: 'files:e2e/__tests__/workcell.spec.ts',
        viewport: page.viewportSize(),
        dpr: 1,
        selection: 'example:fixture-post',
        camera: { eye, target, fov: 46 },
        geometry: 'synthetic-workcell v1; fixed post at (-0.75, 0.65, 0.45) m',
        rendering:
          'normal Core/Render/CUSTOM; installed Chrome with SwiftShader',
        screenshots: [
          'workcell-overview.png',
          'workcell-selected.png',
          'workcell-viewport.png'
        ]
      },
      null,
      2
    )
  })
  expect(errors).toEqual([])
})

test('invalid original part placement is rejected without losing the existing model', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('treeitem', { name: '◇ fixture post' }).click()
  await page.locator('.visual-bindings > summary').click()
  await page.getByLabel('Visual scale X', { exact: true }).fill('-1')
  await page.getByLabel('Object name').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Visual scale X', { exact: true })).toHaveValue(
    '1'
  )
  await expect(page.getByRole('treeitem')).toHaveCount(11)
})

test('invalid native part dimensions are rejected without losing the authored geometry', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  const dimension = page.getByLabel('Shape 1 size (m) X', { exact: true })
  const original = await dimension.inputValue()
  await dimension.fill('-1')
  await page.getByLabel('Object name').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(dimension).toHaveValue(original)
  await expect(page.getByRole('treeitem')).toHaveCount(12)
})
