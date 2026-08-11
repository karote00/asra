import { expect, test } from '@playwright/test'

const shouldComparePixelBaselines = process.platform === 'darwin'

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
  expect(desktopReferenceFrame?.titleTop).toBeGreaterThanOrEqual(230)
  expect(desktopReferenceFrame?.titleTop).toBeLessThanOrEqual(285)
  expect(desktopReferenceFrame?.playTop).toBeLessThanOrEqual(790)
  expect(desktopReferenceFrame?.coreCenterX).toBeLessThanOrEqual(970)
  await expect(page.locator('.site-header .brand-logo__letter')).toHaveCount(5)
  const desktopWordmark = page.locator('.site-header .wordmark__logo')
  await expect(desktopWordmark).toHaveCSS('width', '154px')
  if (shouldComparePixelBaselines) {
    await expect(desktopWordmark).toHaveScreenshot(
      'brand-wordmark-desktop.png',
      { animations: 'disabled', maxDiffPixels: 0 }
    )
  }
  await desktopWordmark.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('brand-wordmark-desktop-review.png')
  })
  await expect(page.locator('.landing-galaxy')).toBeVisible()
  await expect(page.locator('.galaxy-map__orbit')).toHaveCount(7)
  await expect(page.locator('.galaxy-map__domain')).toHaveCount(6)
  expect(
    await page.locator('.galaxy-map__star').count()
  ).toBeGreaterThanOrEqual(480)
  await expect(page.locator('.galaxy-map__aurora path')).toHaveCount(8)
  await expect(page.locator('.galaxy-map__dust ellipse')).toHaveCount(5)
  expect(
    await page.locator('.galaxy-map__stream-star').count()
  ).toBeGreaterThanOrEqual(300)
  expect(
    await page.locator('.galaxy-map__cluster-star').count()
  ).toBeGreaterThanOrEqual(240)
  expect(
    await page.locator('.galaxy-map__bright-stars circle').count()
  ).toBeGreaterThanOrEqual(18)
  await expect(page.locator('.galaxy-map__core-mark')).toBeVisible()
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

  if (shouldComparePixelBaselines) {
    await expect(page.locator('.landing-hero')).toHaveScreenshot(
      'landing-hero-desktop-pixel.png',
      { animations: 'disabled', maxDiffPixels: 0 }
    )
  }
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
  await page.setViewportSize({ width: 390, height: 844 })
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
  await expect(page.locator('.galaxy-map__domain')).toHaveCount(6)
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
    if (!header || !title || !galaxy || !actions) return null
    return {
      actionsTop: actions.getBoundingClientRect().top,
      galaxyWidth: galaxy.getBoundingClientRect().width,
      headerHeight: header.getBoundingClientRect().height,
      titleTop: title.getBoundingClientRect().top
    }
  })
  expect(referenceFrame).not.toBeNull()
  expect(referenceFrame?.headerHeight).toBeGreaterThanOrEqual(76)
  expect(referenceFrame?.titleTop).toBeGreaterThanOrEqual(132)
  expect(referenceFrame?.galaxyWidth).toBeGreaterThanOrEqual(380)
  expect(referenceFrame?.actionsTop).toBeGreaterThanOrEqual(620)
  const mobileWordmark = page.locator('.site-header .wordmark__logo')
  await expect(mobileWordmark).toHaveCSS('width', '120px')
  if (shouldComparePixelBaselines) {
    await expect(mobileWordmark).toHaveScreenshot(
      'brand-wordmark-mobile.png',
      {
        animations: 'disabled',
        maxDiffPixels: 0
      }
    )
  }
  await mobileWordmark.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('brand-wordmark-mobile-review.png')
  })
  await expect(
    page.getByRole('link', { name: 'Start with a product' })
  ).toBeVisible()
  await expect(
    page.getByText('App-owned possibilities — not built-in features')
  ).toBeVisible()
  await expect(page.getByText('Roadmap / future direction')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Compose a custom product' })
  ).toBeVisible()

  const dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

  if (shouldComparePixelBaselines) {
    await expect(page.locator('.landing-hero')).toHaveScreenshot(
      'landing-hero-mobile-pixel.png',
      { animations: 'disabled', maxDiffPixels: 0 }
    )
  }
  await page.screenshot({
    path: testInfo.outputPath('landing-hero-mobile.png')
  })
  await page.screenshot({
    path: testInfo.outputPath('landing-mobile.png'),
    fullPage: true
  })
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

  const axisDuration = await page
    .locator('.galaxy-map__spirals')
    .first()
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).animationDuration)
    )
  expect(axisDuration).toBeLessThanOrEqual(0.001)
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
