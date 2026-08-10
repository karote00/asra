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
      name: 'Build what your world needs.'
    })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Start with a working product' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'See how Asyra works' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Read documentation' })
  ).toBeVisible()
  const actionsBottom = await page
    .locator('.landing-hero__actions')
    .evaluate((element) => element.getBoundingClientRect().bottom)
  expect(actionsBottom).toBeLessThanOrEqual(1000)

  const order = await page.evaluate(() => {
    const hero = document.querySelector('.landing-hero')
    const topology = document.querySelector('.landing-topology')
    return hero && topology
      ? hero.compareDocumentPosition(topology) &
          Node.DOCUMENT_POSITION_FOLLOWING
      : 0
  })
  expect(order).toBeTruthy()
  await expect(page.getByText('19 public packages').first()).toBeVisible()

  const dimensions = await pageDimensions(page)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

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
      name: 'Build what your world needs.'
    })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Start with a working product' })
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
      name: 'Build what your world needs.'
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
    .locator('.landing-hero__axis')
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
      name: 'Build what your world needs.'
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
  await expect(
    page.getByRole('link', { name: 'Start with a working product' })
  ).toBeVisible()

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
