import { expect, test, type Page } from '@playwright/test'

const assertNoHorizontalOverflow = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1)
}

test('documentation supports search, section navigation, and mobile dialogs', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/docs')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Asyra Framework' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Search 41 guides' }).click()
  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('transaction')
  await expect(page.locator('.search-results a')).not.toHaveCount(0)
  await expect(page.locator('.search-dialog__count')).not.toContainText(
    '0 results'
  )
  await page.getByRole('button', { name: 'Close search' }).click()
  await expect(
    page.getByRole('button', { name: 'Search 41 guides' })
  ).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  await assertNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Navigate Asyra' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close navigation' }).click()
  await expect(
    page.getByRole('button', { name: 'Open navigation' })
  ).toBeFocused()

  await page.getByRole('button', { name: 'Browse documentation' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Documentation' })
  ).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Close documentation navigation'
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Browse documentation' })
  ).toBeFocused()
})

test('complete public product routes remain balanced across wide and mobile widths', async ({
  page
}, testInfo) => {
  const routes = [
    ['docs', '/docs', 'Asyra Framework'],
    [
      'asyra-design',
      '/asyra-design',
      'A complete design tool. Built with Asyra.'
    ],
    ['releases', '/releases', 'Know exactly what your product composes.'],
    [
      'roadmap',
      '/roadmap',
      'Build from today’s contracts. See tomorrow clearly.'
    ]
  ] as const

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 900, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 720 }
  ]) {
    await page.setViewportSize(viewport)
    for (const [name, route, heading] of routes) {
      await page.goto(route)
      await expect(
        page.getByRole('heading', { level: 1, name: heading })
      ).toBeVisible()
      await assertNoHorizontalOverflow(page)

      if (
        (viewport.width === 1440 || viewport.width === 390) &&
        (name === 'docs' || name === 'asyra-design')
      ) {
        await page.screenshot({
          animations: 'disabled',
          fullPage: true,
          path: testInfo.outputPath(`${name}-${viewport.width}.png`)
        })
      }
    }
  }
})
