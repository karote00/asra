import { expect, test } from '@playwright/test'

const openAtlas = async (page: import('@playwright/test').Page) => {
  await page.goto('/atlas')
  await page.evaluate(() => document.fonts.ready)
}

const status = (page: import('@playwright/test').Page) =>
  page.locator('[data-atlas-status]')

const scrollTo = async (
  page: import('@playwright/test').Page,
  selector?: string
) => {
  await page.evaluate((target) => {
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const top = target
      ? (document.querySelector(target)?.getBoundingClientRect().top ?? 72) +
        window.scrollY -
        72
      : 0
    root.scrollTop = Math.max(0, top)
    document.body.scrollTop = Math.max(0, top)
    root.style.scrollBehavior = previous
  }, selector)
  await page.waitForTimeout(120)
}

const runCase = async (
  page: import('@playwright/test').Page,
  caseId: string,
  expectedStatus: 'accepted' | 'rejected' = 'accepted'
) => {
  await page.locator(`[data-atlas-case="${caseId}"]`).click()
  await page.locator('[data-atlas-action="run"]').click()
  await expect(status(page)).toHaveAttribute(
    'data-atlas-status',
    expectedStatus,
    { timeout: 10_000 }
  )
}

test('step, pause, resume, replay, and reset operate real worker evidence', async ({
  page
}, testInfo) => {
  await openAtlas(page)

  await page.locator('[data-atlas-action="step"]').click()
  await expect(page.locator('.atlas-ledger tbody tr')).toHaveCount(1)
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'active')

  await page.locator('[data-atlas-action="run"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 10_000
  })
  await expect(page.locator('.atlas-ledger tbody tr')).toHaveCount(7)
  await expect(page.locator('.atlas-ledger tbody tr').last()).toContainText(
    '"value":6'
  )

  await page.locator('[data-atlas-action="replay"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'active')
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 10_000
  })
  await expect(page.locator('.atlas-ledger tbody tr')).toHaveCount(7)

  await page.locator('[data-atlas-action="reset"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'resting')
  await expect(page.locator('.atlas-ledger tbody tr')).toHaveCount(0)
  await expect(page.getByText('No events yet.')).toBeVisible()

  const run = page.locator('[data-atlas-action="run"]')
  await run.focus()
  await expect(run).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'active')
  await page.keyboard.press('Escape')
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'resting')
  await expect(page.locator('.atlas-ledger tbody tr')).toHaveCount(0)

  await run.click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'active')
  await page.locator('[data-atlas-action="pause"]').click()
  await expect(page.locator('[data-atlas-action="run"]')).toBeEnabled({
    timeout: 2_000
  })
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'paused')
  const pausedCount = await page.locator('.atlas-ledger tbody tr').count()
  expect(pausedCount).toBeGreaterThan(0)
  expect(pausedCount).toBeLessThan(7)
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-paused.png')
  })

  await page.locator('[data-atlas-action="run"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 10_000
  })
})

test('all six declared cases complete with their canonical terminal status', async ({
  page
}, testInfo) => {
  await openAtlas(page)

  const cases = [
    ['continuous-pointer-undo', 'accepted'],
    ['canonical-projection-fanout', 'accepted'],
    ['invalid-input-rollback', 'rejected'],
    ['collaboration-two-actors', 'accepted'],
    ['ai-registered-action', 'accepted'],
    ['machine-retrieval-action', 'accepted']
  ] as const

  for (const [caseId, expectedStatus] of cases) {
    await runCase(page, caseId, expectedStatus)
    await expect(page.locator('.atlas-ledger tbody tr').last()).toBeVisible()
    await expect(page.locator('.atlas-runtime-error')).toHaveCount(0)
    if (caseId === 'invalid-input-rollback') {
      await page.screenshot({
        path: testInfo.outputPath('runtime-atlas-rejected.png')
      })
    }
  }

  await expect(page.locator('.atlas-ledger tbody tr').last()).toContainText(
    '"headlessSupport":"roadmap"'
  )
})

test('canonical state creates four explicitly App-owned projections', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openAtlas(page)
  await expect(page.locator('.site-header .wordmark__logo')).toBeVisible()
  await expect(page.locator('.atlas-network')).toBeVisible()
  expect(
    await page
      .locator('#atlas-title')
      .evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize))
  ).toBeLessThanOrEqual(48)
  await expect(page.locator('.atlas-intro__copy > p:last-child')).toHaveText(
    'Explore the causal map of executable information.'
  )
  await expect(page.locator('.atlas-network__major-node')).toHaveCount(6)
  expect(
    await page.locator('.atlas-network__node').count()
  ).toBeGreaterThanOrEqual(34)
  expect(
    await page.locator('.atlas-network__edge').count()
  ).toBeGreaterThanOrEqual(40)
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-overview.png')
  })
  await runCase(page, 'canonical-projection-fanout')

  await expect(
    page.getByRole('heading', { name: 'One accepted state, four views.' })
  ).toBeVisible()
  await expect(page.locator('.atlas-projection-panel')).toHaveCount(4)
  await expect(page.getByText('App-owned', { exact: true })).toHaveCount(4)
  await expect(
    page.getByLabel(
      'Safety review visual projection at x 72, y 54, width 168, height 104'
    )
  ).toBeVisible()
  await expect(page.getByText('approved', { exact: true })).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await scrollTo(page)

  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-desktop.png')
  })
  await scrollTo(page, '.atlas-workbench')
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-workbench.png')
  })
  await scrollTo(page, '.atlas-projections')
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-projections.png')
  })
})

test('mobile and reduced-motion modes preserve controls and evidence', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 760 })
  await openAtlas(page)
  await expect(page.locator('.atlas-network')).toBeVisible()
  await expect(page.locator('.atlas-network__major-node')).toHaveCount(6)

  const controls = page.locator('.atlas-control')
  const targets = await controls.evaluateAll((elements) =>
    elements.map((element) => ({
      height: element.getBoundingClientRect().height,
      width: element.getBoundingClientRect().width
    }))
  )
  targets.forEach(({ height, width }) => {
    expect(height).toBeGreaterThanOrEqual(44)
    expect(width).toBeGreaterThanOrEqual(44)
  })

  await page.locator('[data-atlas-action="run"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 5_000
  })
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await scrollTo(page)

  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-mobile-reduced-motion.png')
  })
  await scrollTo(page, '.atlas-control-bar')
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-mobile-controls.png')
  })
  await scrollTo(page, '.atlas-closure')
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-mobile-roadmap.png')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Runtime Atlas' })
  ).toBeVisible()
  expect(
    await page
      .locator('#atlas-title')
      .evaluate((title) => Number.parseFloat(getComputedStyle(title).fontSize))
  ).toBeLessThanOrEqual(34)
  await scrollTo(page)
  await page.screenshot({
    path: testInfo.outputPath('runtime-atlas-mobile.png')
  })
  const phoneDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(phoneDimensions.scrollWidth).toBeLessThanOrEqual(
    phoneDimensions.clientWidth
  )

  await page.setViewportSize({ width: 720, height: 500 })
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Runtime Atlas' })
  ).toBeVisible()
  const zoomedDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(zoomedDimensions.scrollWidth).toBeLessThanOrEqual(
    zoomedDimensions.clientWidth
  )
})

test('the plain Atlas contract remains readable without client JavaScript', async ({
  browser
}) => {
  const context = await browser.newContext({
    baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:3020',
    javaScriptEnabled: false
  })
  const page = await context.newPage()
  await page.goto('/atlas')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Runtime Atlas' })
  ).toBeVisible()
  await expect(page.getByText('Six real cases')).toBeVisible()
  await expect(
    page.getByText('You do not need to read code first.')
  ).toBeVisible()
  await expect(page.getByText('CURRENT SUPPORT', { exact: true })).toBeVisible()
  await expect(
    page.getByText('FUTURE DIRECTION', { exact: true })
  ).toBeVisible()

  await context.close()
})

test('the production route stays inside bounded resource and runtime budgets', async ({
  page
}) => {
  await openAtlas(page)
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[]
    const bytesFor = (type: string) =>
      resources
        .filter(({ initiatorType }) => initiatorType === type)
        .reduce(
          (total, resource) =>
            total + (resource.encodedBodySize || resource.transferSize),
          0
        )
    return {
      cssBytes: bytesFor('link'),
      domContentLoadedMs:
        navigation.domContentLoadedEventEnd - navigation.startTime,
      externalResources: resources
        .map(({ name }) => new URL(name))
        .filter(({ origin }) => origin !== window.location.origin).length,
      loadMs: navigation.loadEventEnd - navigation.startTime,
      scriptBytes: bytesFor('script')
    }
  })

  expect(metrics.externalResources).toBe(0)
  expect(metrics.domContentLoadedMs).toBeLessThan(3_000)
  expect(metrics.loadMs).toBeLessThan(4_000)
  expect(metrics.scriptBytes).toBeLessThan(3_000_000)
  expect(metrics.cssBytes).toBeLessThan(250_000)

  const startedAt = Date.now()
  await page.locator('[data-atlas-action="run"]').click()
  await expect(status(page)).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 4_000
  })
  expect(Date.now() - startedAt).toBeLessThan(4_000)
})
