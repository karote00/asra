import { expect, test } from '@playwright/test'

test('field completion preserves focus, units and consecutive edits with one Undo per field', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.locator('.visual-bindings > summary').click()
  await page.getByLabel('Length unit').selectOption('mm')
  const x = page.getByLabel('Mount position (mm) X', { exact: true })
  const y = page.getByLabel('Mount position (mm) Y', { exact: true })
  await x.fill('-1234')
  await x.press('Tab')
  await expect(y).toBeFocused()
  await y.fill('700')
  await y.press('Enter')
  await expect(x).toHaveValue('-1234')
  await expect(y).toHaveValue('700')
  await expect(page.locator('.visual-bindings')).toHaveAttribute('open', '')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(y).toHaveValue('650')
  await expect(x).toHaveValue('-1234')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(x).toHaveValue('-750')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(x).toHaveValue('-1234')
  const name = page.getByLabel('Object name')
  await name.fill('')
  await name.pressSequentially('Moved fixture')
  await name.press('Enter')
  await expect(
    page.getByRole('treeitem', { name: '◇ Moved fixture', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(name).toHaveValue('fixture post')
  await name.fill('')
  await name.press('Escape')
  await expect(name).toHaveValue('fixture post')
  const scale = page.getByLabel('Visual scale X', { exact: true })
  await scale.fill('-1')
  await scale.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(scale).toHaveValue('1')
  // Rejection and Escape must not insert an extra history entry.
  await x.fill('99')
  await x.press('Escape')
  await expect(x).toHaveValue('-1234')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(x).toHaveValue('-750')
  await expect(
    page.getByRole('button', { name: 'Apply changes', exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Reset', exact: true })
  ).toHaveCount(0)
  await page.screenshot({
    path: info.outputPath('object-direct-editing.png'),
    animations: 'disabled'
  })
  await test.step('Record ordinary live-workbench review metadata', async () => {
    await info.attach('visual-review-metadata', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        viewport: page.viewportSize(),
        dpr: 1,
        selection: 'example:fixture-post',
        mount: [-0.75, 0.65, 0.45],
        unit: 'mm',
        originalPartsOpen: true,
        camera: 'default',
        scope: 'files:e2e/__tests__/object-fields.spec.ts',
        screenshot: 'object-direct-editing.png'
      })
    })
  })
})

test('native shape, role, visibility and joint edits update directly and reject invalid limits', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Add fixture', exact: true }).click()
  await page.getByLabel('Body role', { exact: true }).selectOption('tool')
  await page.getByLabel('Shape 1 type').selectOption('sphere')
  await expect(page.getByLabel('Shape 1 radius (m)')).toHaveValue('0.1')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Shape 1 size (m) X')).toHaveValue('0.5')
  await expect(page.getByLabel('Body role', { exact: true })).toHaveValue(
    'tool'
  )
  const visible = page.getByLabel('Visible in viewport')
  await visible.uncheck()
  await expect(visible).not.toBeChecked()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(visible).toBeChecked()
  await page
    .getByRole('treeitem', { name: '◉ J1 - Base yaw', exact: true })
    .click()
  const value = page.getByLabel('Joint value (deg)', { exact: true })
  const original = await value.inputValue()
  await value.fill('10')
  await value.press('Enter')
  await value.fill('900')
  await value.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(value).toHaveValue('10')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(value).toHaveValue(original)
})

test('original-part and mount rotation fields commit without Set or Apply buttons and replay canonical angles', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page
    .locator('summary')
    .filter({ hasText: /^Mount rotation$/ })
    .click()
  const mount = page.getByLabel('Rotation angle (deg)', { exact: true })
  await mount.fill('45')
  await mount.press('Enter')
  await expect(mount).toHaveValue('45')
  await page.locator('.visual-bindings > summary').click()
  await page.getByText('Visual rotation', { exact: true }).click()
  const rotation = page.getByLabel('Visual rotation (deg)', { exact: true })
  await rotation.fill('90')
  await rotation.press('Enter')
  await expect(rotation).toHaveValue('90')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rotation).toHaveValue('0')
  await expect(mount).toHaveValue('45')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(mount).toHaveValue('0')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(mount).toHaveValue('45')
  await page.getByLabel('Angle unit').selectOption('rad')
  await expect(
    page.getByLabel('Rotation angle (rad)', { exact: true })
  ).toHaveValue('0.7853981634')
  await expect(
    page.getByRole('button', { name: /^Set (mount|visual) rotation$/ })
  ).toHaveCount(0)
})
