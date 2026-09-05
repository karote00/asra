import { expect, test } from '@playwright/test'

test('theme icon retains an explicit choice without editing the experiment or losing light mode', async ({
  page
}, info) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const history = await page.getByTestId('history-depth').textContent()
  await page
    .getByRole('button', { name: 'Switch to dark mode', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
  await page.getByLabel('Proxies', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.screenshot({ path: info.outputPath('dark-workbench.png') })
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.screenshot({ path: info.outputPath('dark-projects.png') })
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page
    .getByRole('button', { name: 'Switch to light mode', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: info.outputPath('light-workbench.png') })
})

test('system dark preference and blocked preference storage still allow switching', async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage denied')
    }
    Storage.prototype.setItem = () => {
      throw new Error('Storage denied')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page
    .getByRole('button', { name: 'Switch to light mode', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
