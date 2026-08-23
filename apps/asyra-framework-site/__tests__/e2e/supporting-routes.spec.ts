import { expect, test, type Page } from '@playwright/test'

const assertNoHorizontalOverflow = async (page: Page) => {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1)
}

const assertHeightAtMost = async (
  page: Page,
  selector: string,
  maximum: number
) => {
  const box = await page.locator(selector).boundingBox()
  expect.soft(box, `${selector} must have a measurable box`).not.toBeNull()
  expect
    .soft(box?.height ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(maximum)
}

const assertReadingWidth = async (page: Page, selector: string) => {
  const [box, viewportWidth] = await Promise.all([
    page.locator(selector).boundingBox(),
    page.evaluate(() => document.documentElement.clientWidth)
  ])
  expect.soft(box, `${selector} must have a measurable box`).not.toBeNull()
  expect.soft(box?.width ?? 0).toBeGreaterThanOrEqual(viewportWidth - 72)
}

test('documentation supports search, section navigation, and mobile dialogs', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/docs')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Asyra Framework' })
  ).toBeVisible()
  await expect(page.locator('.docs-article__tools')).toHaveCount(0)
  await expect(page.locator('.docs-source-evidence')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy Markdown' })).toHaveCount(
    0
  )
  await expect(
    page.getByRole('heading', { name: 'Canonical sources' })
  ).toBeVisible()
  await page.locator('.docs-layout').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-reading-without-authoring-tools.png')
  })
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

test('documentation navigation preserves the reader and sidebar positions between guides', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/docs')

  const navigation = page.locator('.docs-navigation')
  await page.locator('.docs-layout').scrollIntoViewIfNeeded()
  await navigation.evaluate((element) => {
    element.scrollTop = Math.min(
      420,
      element.scrollHeight - element.clientHeight
    )
  })

  const targetIndex = await navigation.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return [...element.querySelectorAll('a')].findIndex((link) => {
      const linkBounds = link.getBoundingClientRect()
      return (
        link.getAttribute('aria-current') !== 'page' &&
        linkBounds.top >= bounds.top &&
        linkBounds.bottom <= bounds.bottom
      )
    })
  })
  expect(targetIndex).toBeGreaterThanOrEqual(0)

  const target = navigation.locator('a').nth(targetIndex)
  const targetHref = await target.getAttribute('href')
  expect(targetHref).toBeTruthy()

  const positionBeforeNavigation = await page.evaluate(() => ({
    page: window.scrollY,
    sidebar:
      document.querySelector<HTMLElement>('.docs-navigation')?.scrollTop ?? 0
  }))
  expect(positionBeforeNavigation.page).toBeGreaterThan(0)
  expect(positionBeforeNavigation.sidebar).toBeGreaterThan(0)

  await target.click()
  await expect(page).toHaveURL(new RegExp(`${targetHref}$`))

  const positionAfterNavigation = await page.evaluate(() => ({
    page: window.scrollY,
    sidebar:
      document.querySelector<HTMLElement>('.docs-navigation')?.scrollTop ?? 0
  }))
  expect(positionAfterNavigation.page).toBeCloseTo(
    positionBeforeNavigation.page,
    0
  )
  expect(positionAfterNavigation.sidebar).toBeCloseTo(
    positionBeforeNavigation.sidebar,
    0
  )
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-preserved-navigation-position.png')
  })
})

test('current navigation and selected controls keep their visual state on hover', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const selectedTargets = [
    ['/docs', '.docs-navigation a[aria-current="page"]'],
    ['/docs', '.site-frame-navigation a[aria-current="page"]'],
    ['/docs/build/feature-session', '.docs-navigation a[aria-current="page"]'],
    ['/atlas', '.site-frame-navigation a[aria-current="page"]'],
    ['/atlas', '.atlas-case-picker button[aria-pressed="true"]'],
    ['/asyra-design', '.site-frame-navigation a[aria-current="page"]'],
    ['/releases', '.site-frame-navigation a[aria-current="page"]'],
    ['/roadmap', '.site-frame-navigation a[aria-current="page"]']
  ] as const

  for (const [route, selector] of selectedTargets) {
    await page.goto(route)
    const selected = page.locator(selector).first()
    await expect(selected, `${route} ${selector}`).toBeVisible()
    const beforeHover = await selected.evaluate((element) => {
      const style = getComputedStyle(element)
      const after = getComputedStyle(element, '::after')
      return {
        afterBackgroundColor: after.backgroundColor,
        afterTransform: after.transform,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color
      }
    })

    await selected.hover()
    const afterHover = await selected.evaluate((element) => {
      const style = getComputedStyle(element)
      const after = getComputedStyle(element, '::after')
      return {
        afterBackgroundColor: after.backgroundColor,
        afterTransform: after.transform,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color
      }
    })
    expect(afterHover, `${route} ${selector}`).toEqual(beforeHover)
  }

  await page.goto('/docs')
  await page.locator('.docs-navigation a[aria-current="page"]').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-current-guide-hover.png')
  })
  await page.goto('/atlas')
  await page
    .locator('.atlas-case-picker button[aria-pressed="true"]')
    .screenshot({
      animations: 'disabled',
      path: testInfo.outputPath('atlas-selected-case-hover.png')
    })
})

test('documentation pages use one compact, high-contrast header before the guide', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1026 })
  await page.goto('/docs')
  await expect(page.locator('.docs-hero')).toHaveClass(/page-hero--compact/)
  await expect(
    page.locator('.docs-hero .page-hero__copy > p:last-child')
  ).toHaveCSS('color', 'rgba(21, 22, 20, 0.82)')
  const overviewHero = await page.locator('.docs-hero').boundingBox()
  expect(overviewHero).not.toBeNull()
  expect(overviewHero?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    320
  )
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-overview-2560.png')
  })

  await page.goto('/docs/build/feature-session')
  await expect(page.locator('.docs-hero')).toHaveClass(/page-hero--compact/)
  const detailHero = await page.locator('.docs-hero').boundingBox()
  const desktopGuide = await page
    .locator('.docs-article .markdown-content')
    .boundingBox()

  expect(detailHero).not.toBeNull()
  expect(detailHero?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    320
  )
  expect(desktopGuide?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(620)
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-detail-2560.png')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs/build/feature-session')
  await assertHeightAtMost(page, '.docs-hero', 350)
  const mobileGuide = await page
    .locator('.docs-article .markdown-content')
    .boundingBox()
  expect(mobileGuide?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(640)
  await assertNoHorizontalOverflow(page)
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-detail-390.png')
  })
})

test('public subpages use one shared hero layout contract', async ({
  page
}) => {
  const routes = [
    ['/docs', 'compact'],
    ['/docs/build/feature-session', 'compact'],
    ['/atlas', 'compact'],
    ['/releases', 'compact'],
    ['/roadmap', 'compact'],
    ['/asyra-design', 'feature']
  ] as const

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport)

    for (const [route, density] of routes) {
      await page.goto(route)

      const hero = page.locator('.page-hero')
      await expect(hero).toHaveClass(new RegExp(`page-hero--${density}`))
      await expect(hero.locator('.page-hero__copy')).toHaveCount(1)

      const layout = await hero.evaluate((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()

        return {
          display: style.display,
          left: rect.left,
          paddingLeft: Number.parseFloat(style.paddingLeft),
          paddingRight: Number.parseFloat(style.paddingRight),
          right: rect.right,
          templateColumns: style.gridTemplateColumns
        }
      })

      expect(layout.display).toBe('grid')
      const expectedOuterEdge = viewport.width === 1440 ? 60 : 0
      expect(layout.left).toBeCloseTo(expectedOuterEdge, 0)
      expect(layout.right).toBeCloseTo(viewport.width - expectedOuterEdge, 0)
      expect(layout.paddingLeft).toBeCloseTo(layout.paddingRight, 5)

      if (viewport.width === 390) {
        expect(layout.templateColumns.split(' ')).toHaveLength(1)
      }
    }
  }
})

test('Asyra Design ownership rows do not add a disconnected timeline stroke', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/asyra-design')

  const rows = page.locator('.ownership-map > div')
  await expect(rows).toHaveCount(4)
  const connectorContent = await rows.evaluateAll((elements) =>
    elements
      .slice(0, -1)
      .map((element) => getComputedStyle(element, '::after').content)
  )
  expect(connectorContent).toEqual(['none', 'none', 'none'])

  await page.locator('.ownership-map').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('asyra-design-ownership-map.png')
  })
})

test('landing and supporting routes share the landing footer at every responsive mode', async ({
  page
}, testInfo) => {
  const readFooter = async () =>
    page.locator('.site-footer').evaluate((footer) => {
      const style = getComputedStyle(footer)
      const footerRect = footer.getBoundingClientRect()
      const relativeBounds = (selector: string) => {
        const target = footer.querySelector(selector)
        if (!(target instanceof HTMLElement)) return null
        const rect = target.getBoundingClientRect()
        return {
          height: rect.height,
          left: rect.left - footerRect.left,
          top: rect.top - footerRect.top,
          width: rect.width
        }
      }

      return {
        alignItems: style.alignItems,
        className: footer.className,
        gap: style.gap,
        gridTemplateColumns: style.gridTemplateColumns,
        hasHorizontalOverflow: footer.scrollWidth > footer.clientWidth + 1,
        identity: relativeBounds('.project-identity'),
        links: Array.from(footer.querySelectorAll('nav a')).map((link) => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim()
        })),
        navigation: relativeBounds('nav'),
        padding: style.padding,
        text: footer.textContent?.replace(/\s+/g, ' ').trim(),
        wordmark: relativeBounds('.wordmark')
      }
    })

  for (const viewport of [
    { width: 2520, height: 1000 },
    { width: 1229, height: 900 },
    { width: 800, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const landingFooter = await readFooter()

    await page.goto('/roadmap')
    const supportingFooter = await readFooter()

    expect(supportingFooter).toEqual(landingFooter)
    expect(supportingFooter.hasHorizontalOverflow).toBe(false)
    expect(supportingFooter.text).not.toContain(
      'Composable infrastructure for tools built around your domain.'
    )
    await page.locator('.site-footer').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`shared-footer-${viewport.width}.png`)
    })
  }
})

test('factual support routes lead with their evidence instead of oversized presentation', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/releases')
  await assertHeightAtMost(page, '.page-hero', 440)
  const desktopLedger = await page.locator('.package-ledger').boundingBox()
  expect(desktopLedger?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(990)

  await page.goto('/roadmap')
  await assertHeightAtMost(page, '.page-hero', 440)
  const desktopRoadmapHero = await page.locator('.page-hero').boundingBox()
  const desktopStatus = await page
    .locator('.status-grid .status-surface')
    .first()
    .boundingBox()
  expect(desktopStatus?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(596)
  expect(
    (desktopStatus?.y ?? 0) -
      ((desktopRoadmapHero?.y ?? 0) + (desktopRoadmapHero?.height ?? 0))
  ).toBeGreaterThanOrEqual(40)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/releases')
  await assertHeightAtMost(page, '.page-hero', 370)
  const mobileLedger = await page.locator('.package-ledger').boundingBox()
  expect(mobileLedger?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(960)

  await page.goto('/roadmap')
  await assertHeightAtMost(page, '.page-hero', 370)
  const mobileRoadmapHero = await page.locator('.page-hero').boundingBox()
  const mobileStatus = await page
    .locator('.status-grid .status-surface')
    .first()
    .boundingBox()
  expect(mobileStatus?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(492)
  expect(
    (mobileStatus?.y ?? 0) -
      ((mobileRoadmapHero?.y ?? 0) + (mobileRoadmapHero?.height ?? 0))
  ).toBeGreaterThanOrEqual(24)
  await assertNoHorizontalOverflow(page)
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
    ['atlas', '/atlas', 'Don’t take the architecture on faith. Run it.'],
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

      if (viewport.width === 1440 && name !== 'docs') {
        await assertHeightAtMost(page, '.page-hero', 640)
      }

      if (viewport.width <= 390 && name === 'docs') {
        await assertReadingWidth(page, '.docs-article .markdown-content')
      }

      if (viewport.width <= 390 && name === 'asyra-design') {
        await assertReadingWidth(page, '.support-document .markdown-content')
      }

      if (viewport.width === 1440 || viewport.width <= 390) {
        await page.screenshot({
          animations: 'disabled',
          fullPage: true,
          path: testInfo.outputPath(`${name}-${viewport.width}.png`)
        })
      }
    }
  }
})

test('every public mobile hero keeps a compact reading hierarchy', async ({
  page
}, testInfo) => {
  const routes = [
    ['landing', '/', '.hero', '.hero__lead'],
    ['docs', '/docs', '.page-hero', '.page-hero__copy > p:last-of-type'],
    [
      'docs-detail',
      '/docs/build/feature-session',
      '.page-hero',
      '.page-hero__copy > p:last-of-type'
    ],
    [
      'asyra-design',
      '/asyra-design',
      '.page-hero',
      '.page-hero__copy > p:last-of-type'
    ],
    ['atlas', '/atlas', '.page-hero', '.page-hero__aside'],
    [
      'releases',
      '/releases',
      '.page-hero',
      '.page-hero__copy > p:last-of-type'
    ],
    ['roadmap', '/roadmap', '.page-hero', '.page-hero__copy > p:last-of-type']
  ] as const

  for (const width of [520, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })

    for (const [name, route, heroSelector, bodySelector] of routes) {
      await page.goto(route)
      const hero = page.locator(heroSelector)
      const body = hero.locator(bodySelector)
      const metrics = await hero.evaluate((element) => {
        const title = element.querySelector('h1')
        if (!(title instanceof HTMLElement)) {
          throw new Error('Mobile hero is missing its title')
        }
        const titleStyle = getComputedStyle(title)
        return {
          height: element.getBoundingClientRect().height,
          titleFontSize: Number.parseFloat(titleStyle.fontSize),
          titleLineHeight: Number.parseFloat(titleStyle.lineHeight)
        }
      })
      const bodyFontSize = await body
        .first()
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)
        )

      expect(metrics.titleFontSize).toBeLessThanOrEqual(
        name === 'landing' ? 34 : 32
      )
      expect(
        metrics.titleLineHeight / metrics.titleFontSize
      ).toBeGreaterThanOrEqual(0.98)
      expect(metrics.titleFontSize / bodyFontSize).toBeLessThanOrEqual(2.15)
      let maximumHeroHeight = 430
      if (name === 'landing') maximumHeroHeight = 760
      if (name === 'asyra-design') maximumHeroHeight = 1100
      if (name === 'atlas') maximumHeroHeight = 480
      expect(metrics.height).toBeLessThanOrEqual(maximumHeroHeight)

      const sectionTitleSizes = await page
        .locator('.support-section h2, .support-document > header h2')
        .evaluateAll((headings) =>
          headings.map((heading) =>
            Number.parseFloat(getComputedStyle(heading).fontSize)
          )
        )
      for (const fontSize of sectionTitleSizes) {
        expect(fontSize).toBeLessThanOrEqual(32)
      }
      await assertNoHorizontalOverflow(page)

      if (width === 390) {
        await hero.screenshot({
          animations: 'disabled',
          path: testInfo.outputPath(`${name}-mobile-hero-390.png`)
        })
      }
    }
  }
})

test('public mobile pages use quiet reading surfaces and one text hierarchy', async ({
  page
}, testInfo) => {
  const routes = [
    ['docs', '/docs'],
    ['docs-detail', '/docs/build/feature-session'],
    ['asyra-design', '/asyra-design'],
    ['atlas', '/atlas'],
    ['releases', '/releases'],
    ['roadmap', '/roadmap']
  ] as const

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })

    for (const [name, route] of routes) {
      await page.goto(route)
      const hero = page.locator('.page-hero')
      const surface = await hero.evaluate((element) => {
        const style = getComputedStyle(element)
        const label = element.querySelector<HTMLElement>('.support-label')
        const title = element.querySelector<HTMLElement>('h1')
        const body = element.querySelector<HTMLElement>(
          '.page-hero__copy > h1 + p, .page-hero__aside p'
        )
        if (!label || !title || !body) {
          throw new Error('Mobile Hero is missing its reading hierarchy')
        }

        return {
          backgroundImage: style.backgroundImage,
          bodyColor: getComputedStyle(body).color,
          borderBottomWidth: style.borderBottomWidth,
          labelColor: getComputedStyle(label).color,
          titleColor: getComputedStyle(title).color
        }
      })

      expect(surface.backgroundImage).toBe('none')
      expect(surface.borderBottomWidth).toBe('0px')
      expect(surface.labelColor).toBe('rgb(213, 31, 23)')
      if (name === 'asyra-design') {
        expect(surface.bodyColor).toBe('rgb(248, 244, 237)')
        expect(surface.titleColor).toBe('rgb(248, 244, 237)')
      } else {
        expect(surface.bodyColor).toBe('rgb(98, 97, 93)')
        expect(surface.titleColor).toBe('rgb(21, 22, 20)')
      }

      if (name === 'atlas') {
        await expect(hero.locator('.page-hero__aside p + p')).toHaveCSS(
          'border-top-width',
          '0px'
        )
      }

      if (width === 390) {
        await hero.screenshot({
          animations: 'disabled',
          path: testInfo.outputPath(`${name}-quiet-mobile-hero.png`)
        })
      }
    }
  }
})
