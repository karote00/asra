import { expect, test } from '@playwright/test'

const pageDimensions = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))

test('global desktop narrative puts plain outcomes and starting actions first', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build worlds from information.'
    })
  ).toBeVisible()
  await expect(page.locator('#landing-title > span')).toHaveCount(2)
  const desktopTitleLines = await page
    .locator('#landing-title > span')
    .evaluateAll((lines) => lines.map((line) => line.getBoundingClientRect()))
  expect(desktopTitleLines[0].top).toBeLessThan(desktopTitleLines[1].top)
  expect(desktopTitleLines[0].left).toBe(desktopTitleLines[1].left)
  const desktopReferenceFrame = await page.evaluate(() => {
    const title = document.querySelector('#landing-title')
    const play = document.querySelector('.landing-hero__secondary-actions a')
    const core = document.querySelector('.galaxy-map__core')
    if (!title || !play || !core) return null
    const coreBox = core.getBoundingClientRect()
    return {
      coreCenterX: coreBox.left + coreBox.width / 2,
      playTop: play.getBoundingClientRect().top,
      titleTop: title.getBoundingClientRect().top
    }
  })
  expect(desktopReferenceFrame).not.toBeNull()
  expect(desktopReferenceFrame?.titleTop).toBeGreaterThanOrEqual(210)
  expect(desktopReferenceFrame?.titleTop).toBeLessThanOrEqual(245)
  expect(desktopReferenceFrame?.playTop).toBeLessThanOrEqual(790)
  expect(desktopReferenceFrame?.coreCenterX).toBeLessThanOrEqual(970)
  await expect(page.locator('.site-header .brand-logo__letter')).toHaveCount(5)
  const desktopWordmark = page.locator('.site-header .wordmark__logo')
  await expect(desktopWordmark).toHaveCSS('width', '154px')
  await desktopWordmark.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('brand-wordmark-desktop-review.png')
  })
  await expect(page.locator('.landing-galaxy')).toBeVisible()
  await expect(page.locator('.galaxy-map--desktop')).toBeVisible()
  await expect(page.locator('.galaxy-map--mobile')).toBeHidden()
  await expect(
    page.locator('.galaxy-map--desktop .galaxy-map__domain')
  ).toHaveCount(6)
  expect(
    await page.locator('.galaxy-map--desktop .galaxy-map__orbit').count()
  ).toBeGreaterThanOrEqual(14)
  expect(
    await page
      .locator('.galaxy-map--desktop .galaxy-map__dust-particle')
      .count()
  ).toBeGreaterThanOrEqual(760)
  expect(
    await page
      .locator('.galaxy-map--desktop .galaxy-map__cyan-particle')
      .count()
  ).toBeGreaterThanOrEqual(70)
  expect(
    await page.locator('.galaxy-map--desktop .galaxy-map__flare').count()
  ).toBeGreaterThanOrEqual(12)
  await expect(
    page.locator('.galaxy-map--desktop .galaxy-map__hot-core')
  ).toBeVisible()
  await expect(
    page.locator('.galaxy-map--desktop .galaxy-map__occlusion')
  ).toBeVisible()
  await expect(
    page.locator('.galaxy-map--desktop .galaxy-map__core-mark')
  ).toBeVisible()
  await expect(
    page.locator('.landing-hero__instrument figcaption')
  ).toHaveCount(0)
  const desktopGalaxyGeometry = await page.evaluate(() => {
    const centerOf = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }

    return {
      ai: centerOf('.galaxy-map--desktop [data-domain="ai-model"]'),
      bim: centerOf('.galaxy-map--desktop [data-domain="bim"]'),
      core: centerOf('.galaxy-map--desktop .galaxy-map__core'),
      design: centerOf('.galaxy-map--desktop [data-domain="design"]'),
      simulation: centerOf('.galaxy-map--desktop [data-domain="simulation"]'),
      vr: centerOf('.galaxy-map--desktop [data-domain="vr"]'),
      whiteboard: centerOf('.galaxy-map--desktop [data-domain="whiteboard"]')
    }
  })
  const expectNearReference = (
    point: { x: number; y: number } | null,
    x: number,
    y: number,
    tolerance = 38
  ) => {
    expect(point).not.toBeNull()
    if (!point) return
    expect(Math.abs(point.x - x)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(point.y - y)).toBeLessThanOrEqual(tolerance)
  }
  expectNearReference(desktopGalaxyGeometry.design, 914, 198)
  expectNearReference(desktopGalaxyGeometry.whiteboard, 690, 310)
  expectNearReference(desktopGalaxyGeometry.bim, 1185, 350)
  expectNearReference(desktopGalaxyGeometry.core, 940, 475)
  expectNearReference(desktopGalaxyGeometry.vr, 710, 612)
  expectNearReference(desktopGalaxyGeometry.simulation, 1185, 616)
  expectNearReference(desktopGalaxyGeometry.ai, 940, 742)
  await expect(
    page.locator('.landing-capability-flow__runtime li')
  ).toHaveCount(5)
  await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'See Asyra in 90 seconds' })
  ).toBeVisible()

  const order = await page.evaluate(() => {
    const hero = document.querySelector('.landing-hero')
    const topology = document.querySelector('.landing-topology')
    return hero && topology
      ? hero.compareDocumentPosition(topology) &
          Node.DOCUMENT_POSITION_FOLLOWING
      : 0
  })
  expect(order).toBeTruthy()
  await expect(page.locator('.landing-hero__release')).toBeHidden()
  await expect(
    page.locator('.landing-evidence__candidate').getByText('19 public packages')
  ).toBeVisible()

  const dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

  await page.screenshot({
    path: testInfo.outputPath('landing-hero-desktop.png')
  })
  await page.locator('.landing-ownership').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('landing-layers-desktop.png')
  })
  await page.locator('.landing-capability-flow').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('landing-capability-desktop.png')
  })
  await page.locator('.landing-topology').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('landing-runtime-desktop.png')
  })
  await page.screenshot({
    path: testInfo.outputPath('landing-desktop.png'),
    fullPage: true
  })
})

test('global mobile narrative preserves the same promise, boundaries, and paths', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build worlds from information.'
    })
  ).toBeVisible()
  await expect(page.locator('#landing-title > span')).toHaveCount(2)
  await expect(page.locator('.landing-galaxy')).toBeVisible()
  await expect(page.locator('.galaxy-map--desktop')).toBeHidden()
  await expect(page.locator('.galaxy-map--mobile')).toBeVisible()
  await expect(
    page.locator('.galaxy-map--mobile .galaxy-map__domain')
  ).toHaveCount(6)
  const mobileFlow = await page.evaluate(() => {
    const title = document.querySelector('#landing-title')
    const galaxy = document.querySelector('.landing-galaxy')
    const actions = document.querySelector('.landing-hero__actions')
    if (!title || !galaxy || !actions) return false
    const titleBottom = title.getBoundingClientRect().bottom
    const galaxyBox = galaxy.getBoundingClientRect()
    const actionsTop = actions.getBoundingClientRect().top
    return titleBottom < galaxyBox.top && galaxyBox.bottom < actionsTop
  })
  expect(mobileFlow).toBe(true)
  const referenceFrame = await page.evaluate(() => {
    const header = document.querySelector('.site-header')
    const title = document.querySelector('#landing-title')
    const galaxy = document.querySelector('.landing-galaxy')
    const actions = document.querySelector('.landing-hero__actions')
    const design = document.querySelector(
      '.galaxy-map--mobile [data-domain="design"]'
    )
    const ai = document.querySelector(
      '.galaxy-map--mobile [data-domain="ai-model"]'
    )
    if (!header || !title || !galaxy || !actions || !design || !ai) return null
    const designBox = design.getBoundingClientRect()
    const aiBox = ai.getBoundingClientRect()
    return {
      actionsTop: actions.getBoundingClientRect().top,
      domainDistance:
        aiBox.top + aiBox.height / 2 - (designBox.top + designBox.height / 2),
      galaxyWidth: galaxy.getBoundingClientRect().width,
      headerHeight: header.getBoundingClientRect().height,
      titleTop: title.getBoundingClientRect().top
    }
  })
  expect(referenceFrame).not.toBeNull()
  expect(referenceFrame?.headerHeight).toBeGreaterThanOrEqual(76)
  expect(referenceFrame?.titleTop).toBeGreaterThanOrEqual(108)
  expect(referenceFrame?.titleTop).toBeLessThanOrEqual(128)
  expect(referenceFrame?.galaxyWidth).toBeGreaterThanOrEqual(380)
  expect(referenceFrame?.actionsTop).toBeGreaterThanOrEqual(700)
  expect(referenceFrame?.actionsTop).toBeLessThanOrEqual(735)
  expect(referenceFrame?.domainDistance).toBeGreaterThanOrEqual(285)
  expect(referenceFrame?.domainDistance).toBeLessThanOrEqual(330)
  const mobileWordmark = page.locator('.site-header .wordmark__logo')
  await expect(mobileWordmark).toHaveCSS('width', '120px')
  await mobileWordmark.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('brand-wordmark-mobile-review.png')
  })
  await expect(
    page.getByRole('link', { name: 'Start with a product' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Start with a product' })
  ).toHaveCSS('min-height', '62px')
  await expect(
    page.getByText('App-owned possibilities — not built-in features')
  ).toBeVisible()
  await expect(page.getByText('Roadmap / future direction')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Compose a custom product' })
  ).toBeVisible()

  const dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

  await page.screenshot({
    path: testInfo.outputPath('landing-hero-mobile.png')
  })
  await page.screenshot({
    path: testInfo.outputPath('landing-mobile.png'),
    fullPage: true
  })
})

test('galaxy motion preserves its wide reference silhouette at every quarter', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  const widths: number[] = []
  const heights: number[] = []
  for (const fraction of [0, 0.25, 0.5, 0.75]) {
    await page.evaluate((motionFraction) => {
      document.querySelectorAll('.galaxy-map--desktop *').forEach((element) => {
        element.getAnimations().forEach((animation) => {
          const timing = animation.effect?.getComputedTiming()
          const duration = Number(timing?.duration ?? 0)
          animation.pause()
          animation.currentTime = duration * motionFraction
        })
      })
    }, fraction)

    const silhouette = await page
      .locator('.galaxy-map--desktop .galaxy-map__motion-field')
      .boundingBox()
    const svg = await page.locator('.galaxy-map--desktop').boundingBox()
    expect(silhouette).not.toBeNull()
    expect(svg).not.toBeNull()
    if (!silhouette || !svg) continue
    expect(silhouette.width).toBeGreaterThanOrEqual(svg.width * 0.9)
    expect(silhouette.height).toBeGreaterThanOrEqual(svg.height * 0.9)
    await expect(page.locator('.galaxy-map--desktop')).toHaveCSS(
      'overflow',
      'visible'
    )
    widths.push(silhouette.width)
    heights.push(silhouette.height)

    await page.locator('.landing-hero__instrument').screenshot({
      animations: 'allow',
      path: testInfo.outputPath(`galaxy-motion-${fraction * 100}.png`)
    })
  }

  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(12)
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(12)
})

test('320px and desktop 200 percent reflow preserve actions without horizontal overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.landing-hero__actions a').first()).toBeVisible()
  let dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

  const targets = await page
    .locator('.landing-hero__actions a')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width
      }))
    )
  targets.forEach(({ height, width }) => {
    expect(height).toBeGreaterThanOrEqual(44)
    expect(width).toBeGreaterThanOrEqual(44)
  })

  await page.setViewportSize({ width: 720, height: 500 })
  await page.reload()
  dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build worlds from information.'
    })
  ).toBeVisible()
})

test('ownership explorer follows keyboard tab semantics', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto('/')
  const tabs = page.getByRole('tab')
  await tabs.first().focus()
  await expect(tabs.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'App' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('tab', { name: 'App' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Preset' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(
    page.getByRole('tabpanel').getByRole('heading', { name: 'Owns' })
  ).toBeVisible()
})

test('reduced motion exposes the complete equivalent Landing state instantly', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const animationNames = await page
    .locator('.galaxy-map--mobile [class*="galaxy-map__"]')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).animationName)
    )
  expect(animationNames.every((name) => name === 'none')).toBe(true)
  await expect(
    page.getByText('Framework owns reusable infrastructure.')
  ).toBeVisible()
  await expect(
    page.getByText('App owns domain knowledge and product policy.')
  ).toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('landing-reduced-motion.png'),
    fullPage: true
  })
})

test('basic narrative and ownership route remain readable without client JavaScript', async ({
  browser
}) => {
  const context = await browser.newContext({
    baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:3020',
    javaScriptEnabled: false
  })
  const page = await context.newPage()
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build worlds from information.'
    })
  ).toBeVisible()
  await expect(
    page.getByText('Framework owns reusable infrastructure.')
  ).toBeVisible()
  await expect(
    page.getByText('Preset offers optional official defaults.')
  ).toBeVisible()
  await expect(
    page.getByText('App owns domain knowledge and product policy.')
  ).toBeVisible()
  await expect(
    page.getByText('Factory transaction', { exact: true })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore' })).toBeVisible()

  await context.close()
})

test('Landing uses only same-origin code-native visual resources', async ({
  page
}) => {
  await page.goto('/')
  const resourceBoundary = await page.evaluate(() => {
    const resources = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[]
    return {
      external: resources
        .map(({ name }) => new URL(name))
        .filter(({ origin }) => origin !== window.location.origin)
        .map(({ href }) => href),
      visualMedia: resources
        .filter(({ initiatorType }) =>
          ['img', 'css-image', 'video'].includes(initiatorType)
        )
        .map(({ name }) => name)
    }
  })
  expect(resourceBoundary.external).toEqual([])
  expect(resourceBoundary.visualMedia).toEqual([])
  await expect(page.locator('img, canvas, video')).toHaveCount(0)
})
