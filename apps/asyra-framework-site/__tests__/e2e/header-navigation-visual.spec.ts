import { expect, test } from '@playwright/test'

test('landing and supporting headers share the docs navigation treatment', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/')
  const landingDestinations = await page
    .locator('.primary-nav a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))

  await page.goto('/docs')
  const supportingDestinations = await page
    .locator('.site-frame-navigation a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))

  expect(landingDestinations).toEqual(supportingDestinations)

  for (const viewport of [
    { width: 800, height: 900 },
    { width: 900, height: 900 },
    { width: 1920, height: 1000 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const landingHeader = await page.locator('.site-header').boundingBox()
    const landingBrand = await page
      .locator('.site-header .wordmark')
      .boundingBox()
    const landingNavigation = page.locator('.primary-nav')
    const landingNavigationBox = await landingNavigation.boundingBox()
    const landingLink = landingNavigation.getByRole('link', {
      exact: true,
      name: 'Docs'
    })
    const landingMetrics = await landingLink.evaluate((element) => {
      const link = getComputedStyle(element)
      const underline = getComputedStyle(element, '::after')

      return {
        fontSize: link.fontSize,
        fontWeight: link.fontWeight,
        letterSpacing: link.letterSpacing,
        underlineBackground: underline.backgroundColor,
        underlineBottom: underline.bottom,
        underlineHeight: underline.height,
        underlineTransitionDuration: underline.transitionDuration
      }
    })
    const landingGap = await landingNavigation.evaluate(
      (element) => getComputedStyle(element).columnGap
    )

    await page.goto('/docs')
    const supportingHeader = await page
      .locator('.site-frame-header')
      .boundingBox()
    const supportingBrand = await page
      .locator('.site-frame-header .site-frame-wordmark')
      .boundingBox()
    const supportingNavigation = page.locator('.site-frame-navigation')
    const supportingNavigationBox = await supportingNavigation.boundingBox()
    const supportingLink = supportingNavigation.getByRole('link', {
      exact: true,
      name: 'Docs'
    })
    const supportingMetrics = await supportingLink.evaluate((element) => {
      const link = getComputedStyle(element)
      const underline = getComputedStyle(element, '::after')

      return {
        fontSize: link.fontSize,
        fontWeight: link.fontWeight,
        letterSpacing: link.letterSpacing,
        underlineBackground: underline.backgroundColor,
        underlineBottom: underline.bottom,
        underlineHeight: underline.height,
        underlineTransitionDuration: underline.transitionDuration
      }
    })
    const supportingGap = await supportingNavigation.evaluate(
      (element) => getComputedStyle(element).columnGap
    )

    expect(landingMetrics).toEqual(supportingMetrics)
    expect(landingGap).toBe(supportingGap)
    expect(supportingHeader?.height).toBeCloseTo(landingHeader?.height ?? 0, 0)
    expect(supportingBrand?.x).toBeCloseTo(landingBrand?.x ?? 0, 0)
    expect(supportingBrand?.y).toBeCloseTo(landingBrand?.y ?? 0, 0)
    expect(
      (supportingNavigationBox?.x ?? 0) + (supportingNavigationBox?.width ?? 0)
    ).toBeCloseTo(
      (landingNavigationBox?.x ?? 0) + (landingNavigationBox?.width ?? 0),
      0
    )
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const navigationTrigger = page.getByRole('button', {
    name: 'Open navigation'
  })
  await expect(navigationTrigger).toBeVisible()
  await navigationTrigger.click()
  await expect(
    page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { exact: true, name: 'Asyra Design' })
  ).toBeVisible()
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('landing-mobile-navigation.png')
  })

  for (const width of [520, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/atlas')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const mobileLinks = page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link')
    const mobileLinkMetrics = await mobileLinks.evaluateAll((links) =>
      links.map((link) => {
        const style = getComputedStyle(link)
        return {
          fontSize: Number.parseFloat(style.fontSize),
          height: link.getBoundingClientRect().height
        }
      })
    )

    expect(mobileLinkMetrics).toHaveLength(5)
    for (const metrics of mobileLinkMetrics) {
      expect(metrics.fontSize).toBeLessThanOrEqual(21)
      expect(metrics.height).toBeLessThanOrEqual(54)
    }

    await page.getByRole('button', { name: 'Close navigation' }).click()
  }

  await page.setViewportSize({ width: 800, height: 900 })
  await page.goto('/')
  await page.locator('.site-header').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('landing-header-navigation-800.png')
  })

  await page.setViewportSize({ width: 1920, height: 1000 })
  await page.goto('/')
  await page
    .locator('.primary-nav')
    .getByRole('link', { exact: true, name: 'Asyra Design' })
    .hover()
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
