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
    `Status: ${status} - ${count}/${count}`,
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
    'Status: running - 1/8'
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

test('Runtime Atlas hero starts both columns together', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/atlas')

  const copy = await page.locator('.atlas-hero .page-hero__copy').boundingBox()
  const aside = await page
    .locator('.atlas-hero .page-hero__aside')
    .boundingBox()
  expect(copy).not.toBeNull()
  expect(aside).not.toBeNull()
  expect(Math.abs((copy?.y ?? 0) - (aside?.y ?? 0))).toBeLessThanOrEqual(4)

  await page.locator('.atlas-hero').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('runtime-atlas-aligned-hero.png')
  })
})

test('Runtime Atlas closing block uses the hero gutters at every width', async ({
  page
}, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 820, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 720 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/atlas')

    const gutters = await page.evaluate(() => {
      const hero = document.querySelector('.atlas-hero')
      const boundary = document.querySelector('.atlas-boundary')
      if (!hero || !boundary) {
        throw new Error('Missing Runtime Atlas hero or closing block')
      }
      const heroStyle = getComputedStyle(hero)
      const boundaryStyle = getComputedStyle(boundary)
      return {
        boundaryLeft: boundaryStyle.paddingLeft,
        boundaryRight: boundaryStyle.paddingRight,
        heroLeft: heroStyle.paddingLeft,
        heroRight: heroStyle.paddingRight
      }
    })

    expect(gutters.boundaryLeft).toBe(gutters.heroLeft)
    expect(gutters.boundaryRight).toBe(gutters.heroRight)

    await page.locator('.atlas-boundary').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(
        `runtime-atlas-aligned-closing-block-${viewport.width}.png`
      )
    })
  }
})

test('Runtime Atlas wide layout bookends the focused studio', async ({
  page
}) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3600, height: 1800 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/atlas')

    const widths = await page.evaluate(() => {
      const hero = document.querySelector('.atlas-hero')
      const shell = document.querySelector('.atlas-shell')
      const boundary = document.querySelector('.atlas-boundary')
      if (!hero || !shell || !boundary) {
        throw new Error('Missing Runtime Atlas layout region')
      }

      return {
        boundary: boundary.getBoundingClientRect().width,
        hero: hero.getBoundingClientRect().width,
        shell: shell.getBoundingClientRect().width
      }
    })

    expect(widths.hero).toBeCloseTo(widths.boundary, 0)
    expect(widths.hero).toBeLessThanOrEqual(1720)
    expect(widths.shell).toBeLessThanOrEqual(1320)
    expect(widths.hero).toBeGreaterThan(widths.shell)
    await assertNoHorizontalOverflow(page)
  }
})

test('Runtime Atlas distinguishes package facts from guide actions', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/atlas')
  await waitForReady(page)

  const packages = page.locator('.atlas-case-footer__packages')
  const guides = page.locator('.atlas-case-footer__guides')
  await expect(packages.getByRole('link')).toHaveCount(0)
  await expect(guides.getByRole('link')).not.toHaveCount(0)

  const packageItem = await packages
    .locator('li')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        cursor: style.cursor
      }
    })
  const guideLink = await guides
    .getByRole('link')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        cursor: style.cursor
      }
    })
  expect(packageItem).not.toEqual(guideLink)
  expect(packageItem.cursor).not.toBe('pointer')
  expect(guideLink.cursor).toBe('pointer')

  await page.locator('.atlas-case-footer').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('runtime-atlas-distinct-footer-actions.png')
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
    await assertAtlasHeroKeepsTheRuntimeInView(page, width === 390 ? 440 : 480)

    const mobileRhythm = await page.evaluate(() => {
      const metrics = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) {
          throw new Error(`Missing mobile rhythm target: ${selector}`)
        }
        const style = getComputedStyle(element)
        return {
          fontSize: Number.parseFloat(style.fontSize),
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight)
        }
      }

      return {
        boundary: metrics('.atlas-boundary'),
        boundaryBody: metrics('.atlas-boundary > p'),
        boundaryTitle: metrics('.atlas-boundary h2'),
        caseTitle: metrics('.atlas-case-intro h2'),
        heroAside: metrics('.atlas-hero .page-hero__aside'),
        heroTitle: metrics('.atlas-hero h1'),
        menuTrigger: metrics('.navigation-trigger'),
        picker: metrics('.atlas-case-picker'),
        route: metrics('.atlas-route-map'),
        routeItem: metrics('.atlas-route-map li')
      }
    })
    const majorTitleSizes = [
      mobileRhythm.heroTitle.fontSize,
      mobileRhythm.caseTitle.fontSize,
      mobileRhythm.boundaryTitle.fontSize
    ]

    expect(Math.max(...majorTitleSizes)).toBeLessThanOrEqual(32)
    expect(
      Math.max(...majorTitleSizes) - Math.min(...majorTitleSizes)
    ).toBeLessThanOrEqual(2)
    expect(mobileRhythm.menuTrigger.fontSize).toBeGreaterThanOrEqual(12.5)
    expect(
      mobileRhythm.heroTitle.fontSize / mobileRhythm.heroAside.fontSize
    ).toBeLessThanOrEqual(2.3)
    expect(
      mobileRhythm.boundaryTitle.fontSize / mobileRhythm.boundaryBody.fontSize
    ).toBeLessThanOrEqual(2.3)
    expect(
      mobileRhythm.boundaryBody.lineHeight / mobileRhythm.boundaryBody.fontSize
    ).toBeLessThanOrEqual(1.65)

    if (width === 390) {
      expect(mobileRhythm.picker.height).toBeLessThanOrEqual(420)
      expect(mobileRhythm.route.height).toBeLessThanOrEqual(430)
      expect(mobileRhythm.routeItem.height).toBeLessThanOrEqual(90)
      expect(mobileRhythm.boundary.height).toBeLessThanOrEqual(420)
    }

    await page.getByRole('button', { name: 'Open navigation' }).click()
    const mobileNavigationFontSize = await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link')
      .first()
      .evaluate((link) => Number.parseFloat(getComputedStyle(link).fontSize))
    expect(mobileNavigationFontSize).toBeGreaterThanOrEqual(16)
    expect(mobileNavigationFontSize).toBeLessThanOrEqual(21)
    await page.getByRole('button', { name: 'Close navigation' }).click()

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
