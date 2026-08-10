import { expect, test } from '@playwright/test'

test('desktop documentation keeps reading, navigation, search, and evidence visible', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/docs')
  await page.evaluate(() => document.fonts.ready)

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Asyra Framework'
  )
  await expect(
    page.getByRole('navigation', { name: 'Documentation', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'On this page' })
  ).toBeVisible()
  await expect(page.getByText('RELEASE CANDIDATE · 0.5 FAMILY')).toBeVisible()

  const articleBox = await page.locator('.docs-article').boundingBox()
  expect(articleBox).not.toBeNull()
  expect(articleBox?.width).toBeLessThanOrEqual(860)

  await page.keyboard.press('Control+k')
  const search = page.getByRole('dialog', { name: 'Search documentation' })
  await expect(search).toBeVisible()
  await search.getByRole('searchbox').fill('transaction')
  await expect(search.locator('.search-results a').first()).toBeVisible()
  const searchBox = await search.boundingBox()
  expect(searchBox).not.toBeNull()
  const searchOwnsItsPixels = await page.evaluate(
    ({ x, y }) => {
      const dialog = document.querySelector(
        '[role="dialog"][aria-label="Search documentation"]'
      )
      return [32, 296].every((offset) =>
        dialog?.contains(document.elementFromPoint(x, y + offset) ?? null)
      )
    },
    {
      x: (searchBox?.x ?? 0) + (searchBox?.width ?? 0) / 2,
      y: searchBox?.y ?? 0
    }
  )
  expect(searchOwnsItsPixels).toBe(true)
  await page.keyboard.press('Escape')
  await expect(search).toBeHidden()
  await expect(page.locator('.docs-left-rail .search-trigger')).toBeFocused()

  await page.screenshot({
    path: testInfo.outputPath('docs-desktop.png'),
    fullPage: true
  })
})

test('mobile documentation navigation is modal, focus-safe, and reflows without overflow', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs/learn/canonical-state')
  await page.evaluate(() => document.fonts.ready)

  const trigger = page.getByRole('button', { name: 'Browse documentation' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Documentation navigation' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Close documentation navigation' })
  ).toBeFocused()
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  const dialogOwnsItsHeader = await page.evaluate(
    ({ x, y }) => {
      const navigation = document.querySelector(
        '[role="dialog"][aria-label="Documentation navigation"]'
      )
      return navigation?.contains(document.elementFromPoint(x, y) ?? null)
    },
    {
      x: (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) - 36,
      y: (dialogBox?.y ?? 0) + 36
    }
  )
  expect(dialogOwnsItsHeader).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

  await page.screenshot({
    path: testInfo.outputPath('docs-mobile.png'),
    fullPage: true
  })
})

test('reduced motion replaces navigation travel with an equivalent instant state', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const sheet = page.getByRole('dialog', { name: 'Primary navigation' })
  await expect(sheet).toBeVisible()
  const duration = await sheet.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).animationDuration)
  )
  expect(duration).toBeLessThanOrEqual(0.001)
  await expect(sheet.getByRole('link', { name: 'Docs' })).toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('docs-reduced-motion.png'),
    fullPage: true
  })
})

test('supporting routes expose exact status boundaries', async ({ page }) => {
  await page.goto('/examples')
  await expect(page.locator('.example-ledger > li')).toHaveCount(11)
  await page.goto('/releases')
  await expect(page.locator('.package-row')).toHaveCount(19)
  await expect(page.getByText('publication not authorized')).toBeVisible()
  await page.goto('/asyra-design')
  await expect(
    page.getByText('Reference product, not Framework owner')
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open Asyra Design' })
  ).toHaveAttribute('href', 'https://asra.vercel.app')
  const actions = page.locator('.case-study-actions a')
  await expect(actions).toHaveCount(2)
  const actionWidths = await actions.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().width)
  )
  expect(new Set(actionWidths.map(Math.round)).size).toBe(1)
  await page.goto('/roadmap')
  await expect(
    page.getByText(
      /not a current public Headless Core or Core Kernel contract/i
    )
  ).toBeVisible()
})
