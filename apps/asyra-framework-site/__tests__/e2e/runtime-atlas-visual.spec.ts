import { expect, test, type Page } from '@playwright/test'

const waitForReady = async (page: Page) => {
  await expect(page.locator('.atlas-controls')).toContainText('Status: ready')
}

const waitForTerminal = async (
  page: Page,
  status: 'rejected' | 'succeeded',
  count: number
) => {
  await expect(page.locator('.atlas-controls')).toContainText(
    `Status: ${status} · ${count}/${count}`,
    { timeout: 15_000 }
  )
}

const assertNoHorizontalOverflow = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1)
}

test('Runtime Atlas executes, resets, pauses, rejects, and compares real runs', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/atlas')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Don’t take the architecture on faith. Run it.'
    })
  ).toBeVisible()
  await waitForReady(page)

  await page.getByRole('button', { name: 'Run remaining' }).click()
  await waitForTerminal(page, 'succeeded', 8)
  await expect(page.getByText('canonical Value', { exact: true })).toBeVisible()
  await expect(page.locator('.atlas-projection')).toContainText('5')
  await expect(page.locator('.atlas-evidence li')).toHaveCount(8)

  await page.getByRole('button', { name: 'Replay' }).click()
  await waitForTerminal(page, 'succeeded', 8)
  await expect(
    page.getByRole('heading', { level: 3, name: 'Compare outcomes' })
  ).toBeVisible()
  await expect(page.locator('.atlas-comparison article')).toHaveCount(2)

  await page.getByRole('button', { name: 'Reset' }).click()
  await waitForReady(page)
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('.atlas-controls')).toContainText(
    'Status: running · 1/8'
  )

  await page.getByRole('button', { name: 'Replay' }).click()
  await expect(page.locator('.atlas-controls')).toContainText('Status: running')
  await page.getByRole('button', { name: 'Pause' }).click()
  const pausedProgress = await page.locator('.atlas-controls').textContent()
  await page.waitForTimeout(650)
  await expect(page.locator('.atlas-controls')).toHaveText(pausedProgress ?? '')

  await page.getByRole('button', { name: /Failure is evidence too\./ }).click()
  await waitForReady(page)
  await page.getByRole('button', { name: 'Run remaining' }).click()
  await waitForTerminal(page, 'rejected', 4)
  await expect(page.locator('.atlas-projection')).toContainText(
    'Value must be greater than or equal to zero'
  )
  await expect(page.locator('.atlas-projection')).toContainText('5')
  await expect(page.locator('.atlas-evidence li')).toHaveCount(4)
  await assertNoHorizontalOverflow(page)

  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('runtime-atlas-desktop-1440.png')
  })
})

test('all six Runtime Atlas cases complete through fresh isolated workers', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/atlas')

  const cases = [
    ['One continuous gesture. One Undo unit.', 'succeeded', 8],
    ['One canonical change. Every view agrees.', 'succeeded', 4],
    ['Failure is evidence too.', 'rejected', 4],
    ['Two actors. One completed publication.', 'succeeded', 5],
    ['AI uses the same door as people.', 'succeeded', 4],
    ['Search context. Act through an owner.', 'succeeded', 5]
  ] as const

  for (const [title, status, count] of cases) {
    await page.getByRole('button', { name: new RegExp(title) }).click()
    await waitForReady(page)
    await page.getByRole('button', { name: 'Run remaining' }).click()
    await waitForTerminal(page, status, count)
    await expect(page.locator('.atlas-evidence li')).toHaveCount(count)
  }
})

test('Runtime Atlas remains readable and operable at compact mobile widths', async ({
  page
}, testInfo) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/atlas')
    await waitForReady(page)
    await assertNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Run remaining' }).click()
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
    await expect(page.locator('.atlas-case-picker__list button')).toHaveCount(6)

    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: testInfo.outputPath(`runtime-atlas-mobile-${width}.png`)
    })
  }
})

test('Runtime Atlas keeps all six explanations readable without JavaScript', async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/atlas')
  await expect(page.locator('.atlas-case-picker__list button')).toHaveCount(6)
  await expect(
    page.getByRole('button', {
      name: /One continuous gesture\. One Undo unit\./
    })
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /Search context\. Act through an owner\./
    })
  ).toBeVisible()
  await context.close()
})
