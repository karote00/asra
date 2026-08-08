import { expect, test } from '@playwright/test'
import { createRectangle, getElementCount, waitForAppReady } from './test-utils'

test('keeps the App editable without reporting initial socket unavailability as connection loss', async ({
  page
}, testInfo) => {
  await page.goto('/?fileId=status-toast-visual')
  await waitForAppReady(page)
  const alerts = page.locator('[role="alert"]')
  await expect(alerts).toHaveCount(0)

  await createRectangle(page, 0.45, 0.45)
  await expect.poll(() => getElementCount(page)).toBe(1)
  await expect(alerts).toHaveCount(0)

  const reload = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('reset-button').click()
  await reload
  await waitForAppReady(page)
  await expect.poll(() => getElementCount(page)).toBe(0)
  await expect(page.locator('[role="alert"]')).toHaveCount(0)

  const screenshotPath = testInfo.outputPath(
    'quiet-provisional-offline-reset.png'
  )
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  })
  await testInfo.attach('quiet-provisional-offline-reset', {
    path: screenshotPath,
    contentType: 'image/png'
  })
})
