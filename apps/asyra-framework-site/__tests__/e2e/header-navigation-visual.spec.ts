import { expect, test } from '@playwright/test'

test('every public hero shares the landing page content edge', async ({
  page
}, testInfo) => {
  const routes = [
    ['landing', '/', '.site-header .wordmark', '.hero__copy'],
    [
      'docs',
      '/docs',
      '.site-frame-header .site-frame-wordmark',
      '.page-hero__copy'
    ],
    [
      'atlas',
      '/atlas',
      '.site-frame-header .site-frame-wordmark',
      '.page-hero__copy'
    ],
    [
      'asyra-design',
      '/asyra-design',
      '.site-frame-header .site-frame-wordmark',
      '.page-hero__copy'
    ],
    [
      'releases',
      '/releases',
      '.site-frame-header .site-frame-wordmark',
      '.page-hero__copy'
    ],
    [
      'roadmap',
      '/roadmap',
      '.site-frame-header .site-frame-wordmark',
      '.page-hero__copy'
    ]
  ] as const

  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 820, height: 1000 },
    { width: 1440, height: 1000 },
    { width: 2560, height: 1200 }
  ]) {
    await page.setViewportSize(viewport)

    for (const [name, route, wordmarkSelector, heroCopySelector] of routes) {
      await page.goto(route)

      const [wordmark, heroCopy] = await Promise.all([
        page.locator(wordmarkSelector).boundingBox(),
        page.locator(heroCopySelector).boundingBox()
      ])

      expect
        .soft(wordmark, `${name} wordmark must be measurable`)
        .not.toBeNull()
      expect
        .soft(heroCopy, `${name} hero copy must be measurable`)
        .not.toBeNull()
      expect
        .soft(
          heroCopy?.x,
          `${name} hero copy must align with its wordmark at ${viewport.width}px`
        )
        .toBeCloseTo(wordmark?.x ?? 0, 0)
    }

    await page.goto('/docs')
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(
        `docs-header-hero-alignment-${viewport.width}.png`
      )
    })
  }
})

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
    { width: 1024, height: 900 },
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
    if (viewport.width > 900) {
      expect(
        Number.parseFloat(supportingGap) /
          Number.parseFloat(supportingMetrics.fontSize)
      ).toBeGreaterThanOrEqual(2.8)
    }
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

    expect(mobileLinkMetrics).toHaveLength(6)
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

test('mobile menu top row aligns with the header controls it replaces', async ({
  page
}) => {
  for (const width of [520, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/atlas')

    const wordmark = await page.locator('.site-frame-wordmark').boundingBox()
    const wordmarkTypography = await page
      .locator('.site-frame-wordmark')
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight
        }
      })
    const trigger = await page.locator('.navigation-trigger').boundingBox()
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const title = await page.locator('#navigation-title').boundingBox()
    const titleTypography = await page
      .locator('#navigation-title')
      .evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight
        }
      })
    const close = await page
      .getByRole('button', { name: 'Close navigation' })
      .boundingBox()

    expect(title?.x).toBeCloseTo(wordmark?.x ?? 0, 0)
    expect((title?.y ?? 0) + (title?.height ?? 0) / 2).toBeCloseTo(
      (wordmark?.y ?? 0) + (wordmark?.height ?? 0) / 2,
      0
    )
    expect((close?.x ?? 0) + (close?.width ?? 0)).toBeCloseTo(
      (trigger?.x ?? 0) + (trigger?.width ?? 0),
      0
    )
    expect(close?.y).toBeCloseTo(trigger?.y ?? 0, 0)
    expect(titleTypography.fontSize).toBe(wordmarkTypography.fontSize)
    expect(
      (close?.x ?? 0) - ((title?.x ?? 0) + (title?.width ?? 0))
    ).toBeGreaterThanOrEqual(12)
  }
})

test('mobile menu presents every destination as one uniform full-height list', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/roadmap')

  const triggerStyle = await page
    .getByRole('button', { name: 'Open navigation' })
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderRightWidth: style.borderRightWidth,
        borderTopStyle: style.borderTopStyle,
        borderTopWidth: style.borderTopWidth,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        outlineWidth: style.outlineWidth,
        textTransform: style.textTransform
      }
    })

  await page.getByRole('button', { name: 'Open navigation' }).click()

  const dialog = page.locator('.navigation-dialog')
  const dialogBox = await dialog.boundingBox()
  const mobileNavigation = page.getByRole('navigation', {
    name: 'Mobile navigation'
  })
  const links = mobileNavigation.getByRole('link')

  expect(await links.allTextContents()).toEqual([
    'Docs',
    'Runtime Atlas',
    'Asyra Design',
    'Releases',
    'Roadmap',
    'GitHub'
  ])
  expect(page.locator('.navigation-dialog__source')).toHaveCount(0)
  expect(dialogBox?.x).toBeCloseTo(0, 0)
  expect(dialogBox?.y).toBeCloseTo(0, 0)
  expect(dialogBox?.width).toBeCloseTo(390, 0)
  expect(dialogBox?.height).toBeCloseTo(844, 0)
  expect(
    await links
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopWidth)
  ).toBe('0px')

  const linkStyles = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        borderBottomStyle: style.borderBottomStyle,
        borderBottomWidth: style.borderBottomWidth,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
        minHeight: style.minHeight,
        paddingBottom: style.paddingBottom,
        paddingTop: style.paddingTop
      }
    })
  )

  for (const style of linkStyles.slice(1)) {
    expect(style).toEqual(linkStyles[0])
  }

  const closeStyle = await page
    .getByRole('button', { name: 'Close navigation' })
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderRightWidth: style.borderRightWidth,
        borderTopStyle: style.borderTopStyle,
        borderTopWidth: style.borderTopWidth,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        outlineWidth: style.outlineWidth,
        textTransform: style.textTransform
      }
    })

  expect(closeStyle).toEqual(triggerStyle)
  expect(triggerStyle.borderTopWidth).toBe('0px')
  expect(triggerStyle.borderRightWidth).toBe('0px')
  expect(closeStyle.outlineWidth).toBe('0px')
})
