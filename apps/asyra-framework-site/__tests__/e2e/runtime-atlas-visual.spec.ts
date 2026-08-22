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

const assertAtlasHeroKeepsTheRuntimeInView = async (
  page: Page,
  maximum: number
) => {
  const box = await page.locator('.atlas-hero').boundingBox()
  expect
    .soft(box, 'Runtime Atlas hero must have a measurable box')
    .not.toBeNull()
  expect
    .soft(box?.height ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(maximum)
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
  const skipLink = page.locator('.skip-link')
  await expect(skipLink).toHaveCSS('clip-path', 'inset(50%)')
  await page.keyboard.press('Tab')
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toHaveCSS('clip-path', 'none')
  await page.keyboard.press('Tab')
  await expect(skipLink).toHaveCSS('clip-path', 'inset(50%)')
  await assertAtlasHeroKeepsTheRuntimeInView(page, 460)
  await expect(page.locator('.atlas-route-map')).toHaveCSS(
    'list-style-type',
    'none'
  )
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
  await expect(skipLink).toHaveCSS('clip-path', 'inset(50%)')

  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('runtime-atlas-desktop-1440.png')
  })
})

test('Runtime Atlas case changes ease the studio to its new height', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/atlas')
  await waitForReady(page)
  await page.waitForTimeout(500)

  const shell = page.locator('.atlas-shell')
  const studioFrame = page.locator('.atlas-studio-frame')
  const initialHeight = (await shell.boundingBox())?.height ?? 0
  expect(initialHeight).toBeGreaterThan(0)
  const transitionContract = await studioFrame.evaluate((frame) => {
    const style = getComputedStyle(frame)
    document.body.dataset.atlasHeightTransition = ''
    const record = (phase: string) => (event: Event) => {
      if (event instanceof TransitionEvent && event.propertyName === 'height') {
        document.body.dataset.atlasHeightTransition += `${phase} `
      }
    }
    frame.addEventListener('transitionrun', record('run'), { once: true })
    frame.addEventListener('transitionend', record('end'), { once: true })
    return {
      duration: Number.parseFloat(style.transitionDuration),
      property: style.transitionProperty
    }
  })
  expect(transitionContract.property).toContain('height')
  expect(transitionContract.duration).toBeGreaterThanOrEqual(0.3)

  const target = page.getByRole('button', {
    name: /Failure is evidence too\./
  })
  await target.evaluate((button: HTMLButtonElement) => button.click())
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  await waitForReady(page)
  await expect
    .poll(() =>
      page.locator('body').getAttribute('data-atlas-height-transition')
    )
    .toContain('run')
  await expect
    .poll(() =>
      page.locator('body').getAttribute('data-atlas-height-transition')
    )
    .toContain('end')

  const finalHeight = (await shell.boundingBox())?.height ?? 0
  expect(Math.abs(initialHeight - finalHeight)).toBeGreaterThan(120)
  await shell.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('runtime-atlas-case-transition.png')
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await waitForReady(page)
  const reducedDuration = await page
    .locator('.atlas-studio-frame')
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration)
    )
  expect(reducedDuration).toBeLessThanOrEqual(0.001)
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

test('Runtime Atlas guide links use public titles and resolve to their guide', async ({
  page
}) => {
  await page.goto('/atlas')

  const guide = page.getByRole('link', {
    name: 'Build a transaction-safe Feature session'
  })
  await expect(guide).toHaveAttribute('href', '/docs/build/feature-session')
  await guide.click()

  await expect(page).toHaveURL(/\/docs\/build\/feature-session$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Build a transaction-safe Feature session'
    })
  ).toBeVisible()
})

test('Runtime Atlas remains readable and operable at compact mobile widths', async ({
  page
}, testInfo) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/atlas')
    await waitForReady(page)
    await assertNoHorizontalOverflow(page)
    await assertAtlasHeroKeepsTheRuntimeInView(page, 520)

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
