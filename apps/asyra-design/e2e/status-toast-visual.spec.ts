import { expect, test } from '@playwright/test'
import { createRectangle, getElementCount, waitForAppReady } from './test-utils'

test('reports initial socket unavailability once while keeping the App editable', async ({
  page
}, testInfo) => {
  await page.goto('/?fileId=status-toast-visual')
  await waitForAppReady(page)
  const alerts = page.locator('[role="alert"]')
  await expect(alerts).toHaveCount(1)
  await expect(alerts).toHaveText(
    'The document session is offline. Local editing remains available and changes will sync after reconnection.'
  )

  await createRectangle(page, 0.45, 0.45)
  await expect.poll(() => getElementCount(page)).toBe(1)
  await expect(alerts).toHaveCount(1)

  const reload = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('reset-button').click()
  await reload
  await waitForAppReady(page)
  await expect.poll(() => getElementCount(page)).toBe(0)
  await expect(page.locator('[role="alert"]')).toHaveCount(1)
  await expect(page.locator('[role="alert"]')).toHaveText(
    'The document session is offline. Local editing remains available and changes will sync after reconnection.'
  )

  const screenshotPath = testInfo.outputPath('initial-offline-reset.png')
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  })
  await testInfo.attach('initial-offline-reset', {
    path: screenshotPath,
    contentType: 'image/png'
  })
})
