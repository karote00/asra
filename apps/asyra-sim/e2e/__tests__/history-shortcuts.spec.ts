import { expect, test } from '@playwright/test'
import { readHistoryDepth } from '../history-depth'

for (const modifier of ['Meta', 'Control']) {
  test(`${modifier}+Z and ${modifier}+Shift+Z replay one completed Object edit`, async ({
    page
  }) => {
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    const initialDepth = await readHistoryDepth(page)
    await page
      .getByRole('treeitem', { name: '◇ fixture post', exact: true })
      .click()
    const x = page.getByLabel('Mount position (m) X', { exact: true })
    await x.fill('-1.25')
    await x.press('Enter')
    await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth + 1)
    // Enter leaves focus on the page, so no native field editor owns the shortcut.
    await page.keyboard.press(`${modifier}+z`)
    await expect(x).toHaveValue('-0.75')
    await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth)
    await expect(page.getByRole('status')).toHaveText('Undo applied')
    await page.keyboard.press(`${modifier}+Shift+z`)
    await expect(x).toHaveValue('-1.25')
    await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth + 1)
    await expect(page.getByRole('status')).toHaveText('Redo applied')
    // Buttons and keyboard must operate the same history, not parallel stacks.
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(x).toHaveValue('-0.75')
    await page.keyboard.press(`${modifier}+Shift+z`)
    await expect(x).toHaveValue('-1.25')
  })
}

test('text and numeric input retain native Undo without replaying model history', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const initialDepth = await readHistoryDepth(page)
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  const x = page.getByLabel('Mount position (m) X', { exact: true })
  const name = page.getByLabel('Object name')
  await x.fill('-1.25')
  await x.press('Enter')
  await name.click()
  await name.press('End')
  await name.pressSequentially(' draft')
  await name.press('Meta+z')
  await expect(name).toHaveValue('fixture post')
  await expect(x).toHaveValue('-1.25')
  await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth + 1)
  await name.press('Meta+Shift+z')
  await expect(name).toHaveValue('fixture post draft')
  await name.press('Escape')
  await x.fill('-8')
  await x.press('Meta+z')
  await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth + 1)
  await x.press('Escape')
  await page.keyboard.press('Meta+z')
  await expect(x).toHaveValue('-0.75')
})

test('project replacement binds shortcuts to the successor exactly once', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page
    .getByLabel('Project name', { exact: true })
    .fill('Shortcut lifecycle')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page.getByTestId('persistence-status')).toHaveText(
    'Saved locally · Shortcut lifecycle'
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Open Shortcut lifecycle', exact: true })
    .click()
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await expect(
    page.getByRole('button', { name: 'Close projects', exact: true })
  ).toHaveCount(0)
  await page.keyboard.press('Meta+z')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 0')
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  const x = page.getByLabel('Mount position (m) X', { exact: true })
  await x.fill('-1')
  await x.press('Enter')
  await x.fill('-1.25')
  await x.press('Enter')
  await page.keyboard.press('Meta+z')
  await expect(x).toHaveValue('-1')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 1')
  await page.keyboard.press('Meta+Shift+z')
  await expect(x).toHaveValue('-1.25')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 2')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})
