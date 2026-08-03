import { expect, test } from '@playwright/test'

test('dismisses the top status toast while the lower toast transitions upward', async ({
  page
}, testInfo) => {
  await page.goto('/?fileId=status-toast-visual')
  const alerts = page.locator('[role="alert"]')
  await expect(alerts).toHaveCount(2)

  const databaseToast = page.locator(
    '[data-toast-id="document-database-unavailable"]'
  )
  const collaborationToast = page.locator(
    '[data-toast-id="collaboration-unavailable"]'
  )
  await expect(databaseToast).toHaveAttribute('data-state', 'open')
  await expect(collaborationToast).toHaveAttribute('data-state', 'open')

  const initialLowerBox = await collaborationToast.boundingBox()
  expect(initialLowerBox).not.toBeNull()
  const screenshotPath = testInfo.outputPath('status-toast-stack.png')
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  })
  await testInfo.attach('status-toast-stack', {
    path: screenshotPath,
    contentType: 'image/png'
  })

  await databaseToast.getByRole('button').click()
  await expect(databaseToast).toHaveAttribute('data-state', 'closing')
  expect(
    await databaseToast.evaluate(
      (element) => (element as HTMLElement).style.transitionProperty
    )
  ).toContain('grid-template-rows')

  await page.waitForTimeout(100)
  const transitioningLowerBox = await collaborationToast.boundingBox()
  expect(transitioningLowerBox).not.toBeNull()
  if (!initialLowerBox || !transitioningLowerBox) {
    throw new Error('Both status toasts must have measurable layout boxes')
  }
  expect(transitioningLowerBox.y).toBeLessThan(initialLowerBox.y)

  await expect(databaseToast).toHaveCount(0)
  await expect(collaborationToast).toHaveAttribute('data-state', 'open')
})
