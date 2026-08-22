import { expect, test } from '@playwright/test'

test('landing and supporting headers share one navigation type scale', async ({
  page
}, testInfo) => {
  for (const viewport of [
    { width: 900, height: 900 },
    { width: 1920, height: 1000 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const landingFontSize = await page
      .locator('.primary-nav a')
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize)

    await page.goto('/docs')
    const supportingFontSize = await page
      .locator('.site-frame-navigation a')
      .first()
      .evaluate((element) => getComputedStyle(element).fontSize)

    expect(supportingFontSize).toBe(landingFontSize)
  }

  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/')
  await page.locator('.site-header').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('landing-header-navigation.png')
  })
  await page.goto('/docs')
  await page.locator('.site-frame-header').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('supporting-header-navigation.png')
  })
})
