import { expect, test } from '@playwright/test'
import { createRectangle, getElementCount, waitForAppReady } from './test-utils'

test('keeps the App editable with one quiet disconnected transition toast', async ({
  page
}, testInfo) => {
  await page.goto('/?fileId=status-toast-visual')
  await waitForAppReady(page)
  const alerts = page.locator('[role="alert"]')
  await expect(alerts).toHaveCount(1)

  const collaborationToast = page.locator(
    '[data-toast-id^="collaboration-disconnected-"]'
  )
  await expect(collaborationToast).toHaveAttribute('data-state', 'open')

  await createRectangle(page, 0.45, 0.45)
  await expect.poll(() => getElementCount(page)).toBe(1)
  await expect(alerts).toHaveCount(1)

  const screenshotPath = testInfo.outputPath('disconnected-editable-app.png')
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  })
  await testInfo.attach('disconnected-editable-app', {
    path: screenshotPath,
    contentType: 'image/png'
  })

  await collaborationToast.getByRole('button').click()
  await expect(collaborationToast).toHaveAttribute('data-state', 'closing')
  await expect(collaborationToast).toHaveCount(0)
  await expect(alerts).toHaveCount(0)
})
