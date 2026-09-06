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

const assertMinimumFontSize = async (
  page: Page,
  selector: string,
  minimum: number
) => {
  const fontSizes = await page
    .locator(selector)
    .evaluateAll((elements) =>
      elements.map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      )
    )

  expect(
    fontSizes.length,
    `${selector} must match readable copy`
  ).toBeGreaterThan(0)
  expect
    .soft(Math.min(...fontSizes), `${selector} must remain readable`)
    .toBeGreaterThanOrEqual(minimum)
}

const popupRouteSamples = [
  '/',
  '/docs',
  '/docs/start/preset-2d',
  '/atlas',
  '/asyra-design',
  '/releases',
  '/roadmap'
] as const

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

test('mobile documentation navigation scrolls through every guide', async ({
  page
}) => {
  for (const width of [767, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 568 })
    await page.goto('/docs')
    await page.getByRole('button', { name: 'Browse documentation' }).click()

    const dialog = page.getByRole('dialog', { name: 'Documentation' })
    const navigation = dialog.getByRole('navigation', {
      name: 'Documentation sections'
    })
    const initialMetrics = await navigation.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop
    }))

    expect(initialMetrics.scrollHeight).toBeGreaterThan(
      initialMetrics.clientHeight
    )
    expect(initialMetrics.scrollTop).toBe(0)

    await navigation.hover()
    await page.mouse.wheel(0, initialMetrics.scrollHeight)
    await expect
      .poll(() => navigation.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)
    await expect(navigation.getByRole('link').last()).toBeInViewport()

    const close = page.getByRole('button', {
      name: 'Close documentation navigation'
    })
    expect(
      await close.evaluate((element) => getComputedStyle(element).borderWidth)
    ).toBe('0px')
  }
})

test('mobile documentation search uses the shared compact close control', async ({
  page
}) => {
  for (const width of [1440, 1080, 768, 767, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 568 })
    await page.goto('/docs')
    await page.getByRole('button', { name: 'Search 41 guides' }).click()

    const close = page.getByRole('button', { name: 'Close search' })
    const box = await close.boundingBox()

    await expect(close).toHaveText('×')
    expect(box?.width).toBeCloseTo(44, 0)
    expect(box?.height).toBeCloseTo(44, 0)
    expect(
      await close.evaluate((element) => getComputedStyle(element).borderWidth)
    ).toBe('0px')
  }
})

test('the shared mobile menu stays borderless and modal on every page', async ({
  page
}, testInfo) => {
  for (const route of popupRouteSamples) {
    for (const width of [767, 390, 320]) {
      await page.setViewportSize({ width, height: 568 })
      await page.goto(route)

      const trigger = page.getByRole('button', { name: 'Open navigation' })
      await expect(trigger).toBeVisible()
      if (route === '/' && width === 390) {
        await page
          .locator('header')
          .first()
          .screenshot({
            animations: 'disabled',
            path: testInfo.outputPath('site-mobile-header-borderless.png')
          })
      }
      expect(
        await trigger.evaluate(
          (element) => getComputedStyle(element).borderWidth
        )
      ).toBe('0px')
      await trigger.focus()
      expect(
        await trigger.evaluate(
          (element) => getComputedStyle(element).outlineStyle
        )
      ).toBe('none')
      await trigger.click()

      const dialog = page.getByRole('dialog', { name: 'Navigate Asyra' })
      const close = page.getByRole('button', { name: 'Close navigation' })
      await expect(dialog).toBeVisible()
      expect(
        await close.evaluate((element) => getComputedStyle(element).borderWidth)
      ).toBe('0px')
      expect(
        await page.evaluate(() => ({
          body: getComputedStyle(document.body).overflowY,
          root: getComputedStyle(document.documentElement).overflowY
        }))
      ).toEqual({ body: 'hidden', root: 'hidden' })

      await close.click()
      await expect(dialog).not.toBeVisible()
    }
  }
})

test('every mobile popup uses the shared close control and locks the page', async ({
  page
}, testInfo) => {
  const dialogs = [
    {
      close: 'Close navigation',
      dialog: 'Navigate Asyra',
      key: 'site-navigation',
      open: 'Open navigation',
      title: '#navigation-title'
    },
    {
      close: 'Close documentation navigation',
      dialog: 'Documentation',
      key: 'documentation-navigation',
      open: 'Browse documentation',
      title: '#docs-navigation-title'
    },
    {
      close: 'Close search',
      dialog: 'Find a guide or concept',
      key: 'documentation-search',
      open: 'Search 41 guides',
      title: '.search-dialog__header .support-label'
    }
  ] as const

  for (const entry of dialogs) {
    await page.setViewportSize({ width: 390, height: 568 })
    await page.goto('/docs')
    await page.getByRole('button', { name: entry.open }).click()

    const dialog = page.getByRole('dialog', { name: entry.dialog })
    const close = page.getByRole('button', { name: entry.close })
    const closeMark = close.locator('.dialog-close-button__mark')
    const title = dialog.locator(entry.title)
    const pagePosition = await page.evaluate(() => window.scrollY)

    await expect(dialog).toBeVisible()
    await expect(close).toHaveText('×')
    const [closeMarkBox, titleBox] = await Promise.all([
      closeMark.boundingBox(),
      title.boundingBox()
    ])
    expect
      .soft(
        Math.abs((closeMarkBox?.y ?? 0) + 4 - (titleBox?.y ?? 0)),
        `${entry.key} close mark must optically align with its title`
      )
      .toBeLessThanOrEqual(1)
    expect(
      await close.evaluate((element) => getComputedStyle(element).borderWidth)
    ).toBe('0px')
    expect(
      await page.evaluate(() => ({
        body: getComputedStyle(document.body).overflowY,
        root: getComputedStyle(document.documentElement).overflowY
      }))
    ).toEqual({ body: 'hidden', root: 'hidden' })

    await dialog.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`${entry.key}-popup.png`)
    })

    await page.mouse.move(2, 2)
    await page.mouse.wheel(0, 1200)
    await page.keyboard.press('PageDown')
    expect(await page.evaluate(() => window.scrollY)).toBe(pagePosition)
    expect(
      await close.evaluate((element) => getComputedStyle(element).outlineStyle)
    ).toBe('none')

    await close.click()
    await expect(dialog).not.toBeVisible()
    expect(
      await page.evaluate(() => ({
        body: getComputedStyle(document.body).overflowY,
        root: getComputedStyle(document.documentElement).overflowY
      }))
    ).toEqual({ body: 'visible', root: 'visible' })
  }
})

test('the Documentation Overview alone presents a compact docs-native technical flow after the owner model', async ({
  page
}, testInfo) => {
  for (const profile of [
    { maxHeight: 900, routeColumns: 2, width: 1440 },
    { maxHeight: 900, routeColumns: 2, width: 820 },
    { maxHeight: 1300, routeColumns: 1, width: 390 },
    { maxHeight: 1400, routeColumns: 1, width: 320 }
  ]) {
    await page.setViewportSize({ width: profile.width, height: 1000 })
    await page.goto('/docs')

    const section = page.locator('#framework-flow-technical')
    await expect(section).toBeVisible()
    await expect(
      section.getByRole('heading', {
        level: 2,
        name: 'Two routes. One authority.'
      })
    ).toBeVisible()
    await expect(section.locator('.framework-technical__route')).toHaveCount(2)
    await expect(
      section.locator('.framework-technical__route > header > span')
    ).toHaveCount(0)
    await expect(
      section.locator('.framework-technical__owners li')
    ).toHaveCount(4)
    const outputTags = section.locator('.framework-technical__outputs li')
    await expect.soft(outputTags).toHaveCount(6)
    expect
      .soft(await outputTags.allTextContents())
      .toEqual(['Render', 'UI', 'Search', 'AI context', 'Save', 'Integrations'])
    await expect(
      section.locator('.framework-technical__steps li').filter({
        hasText: 'SafetyValidate - Resolve'
      })
    ).toHaveCount(1)

    const layout = await section.evaluate((element) => {
      const routes = element.querySelector<HTMLElement>(
        '.framework-technical__routes'
      )
      const routeCopy = element.querySelector<HTMLElement>(
        '.framework-technical__route > p'
      )
      const routeCards = Array.from(
        element.querySelectorAll<HTMLElement>('.framework-technical__route')
      )
      const owners = element.querySelector<HTMLElement>(
        '.framework-technical__owners'
      )
      const ownerHeader = owners?.querySelector<HTMLElement>('header')
      const ownerList = owners?.querySelector<HTMLElement>('ul')
      const outputs = element.querySelector<HTMLElement>(
        '.framework-technical__outputs'
      )
      const outputLabel = outputs?.querySelector<HTMLElement>('p')
      const outputList = outputs?.querySelector<HTMLElement>('ul')
      const currentSupport = document.querySelector('#current-support')
      const ownerModel = document.querySelector('#the-owner-model')
      if (
        !routes ||
        !routeCopy ||
        routeCards.length !== 2 ||
        !owners ||
        !ownerHeader ||
        !ownerList ||
        !outputs ||
        !outputLabel ||
        !outputList ||
        !currentSupport ||
        !ownerModel
      ) {
        throw new Error('Missing Documentation Overview flow anchors')
      }
      const routeBounds = routeCards.map((route) =>
        route.getBoundingClientRect()
      )
      const alignedRouteRows = [
        'header',
        ':scope > p',
        '.framework-technical__inputs',
        '.framework-technical__steps'
      ].every((selector) => {
        const rows = routeCards.map((route) =>
          route.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
        )
        return Boolean(
          rows[0] && rows[1] && Math.abs(rows[0].top - rows[1].top) <= 1
        )
      })
      const blocksShareHeights = (selector: string) => {
        const blocks = Array.from(
          element.querySelectorAll<HTMLElement>(selector)
        ).map((block) => block.getBoundingClientRect())
        if (blocks.length < 2) return false
        return (
          Math.max(...blocks.map((block) => block.height)) -
            Math.min(...blocks.map((block) => block.height)) <=
          1
        )
      }
      const background = getComputedStyle(element).backgroundColor
      const rgb = background.match(/[\d.]+/g)?.map(Number) ?? []
      const tagWidthsFitContents = Array.from(
        element.querySelectorAll<HTMLElement>(
          '.framework-technical__inputs li, .framework-technical__owners li, .framework-technical__outputs li'
        )
      ).every((tag) => {
        const textNode = tag.firstChild
        if (!textNode) return false
        const textRange = document.createRange()
        textRange.selectNodeContents(textNode)
        const textWidth = textRange.getBoundingClientRect().width
        const style = getComputedStyle(tag)
        const insetWidth =
          Number.parseFloat(style.paddingLeft) +
          Number.parseFloat(style.paddingRight) +
          Number.parseFloat(style.borderLeftWidth) +
          Number.parseFloat(style.borderRightWidth)
        return tag.getBoundingClientRect().width <= textWidth + insetWidth + 1
      })
      const lowerTagsUseCompactVerticalInsets = Array.from(
        element.querySelectorAll<HTMLElement>(
          '.framework-technical__owners li, .framework-technical__outputs li'
        )
      ).every((tag) => tag.getBoundingClientRect().height <= 34)
      return {
        backgroundIsLight:
          rgb.length >= 3 && (rgb[0] + rgb[1] + rgb[2]) / 3 > 180,
        beforeCurrentSupport: Boolean(
          element.compareDocumentPosition(currentSupport) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        ownerModelBefore: Boolean(
          ownerModel.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        ownerOutputColumnsAligned:
          Math.abs(
            ownerHeader.getBoundingClientRect().left -
              outputLabel.getBoundingClientRect().left
          ) <= 1 &&
          Math.abs(
            ownerList.getBoundingClientRect().left -
              outputList.getBoundingClientRect().left
          ) <= 1,
        routesAttachToOwners:
          Math.abs(
            routes.getBoundingClientRect().bottom -
              owners.getBoundingClientRect().top
          ) <= 1,
        routeGap: Number.parseFloat(getComputedStyle(routes).columnGap),
        routeHeightsAligned:
          Math.abs(routeBounds[0].height - routeBounds[1].height) <= 1,
        routeRowsAligned: alignedRouteRows,
        ownerCardsShareHeights: blocksShareHeights(
          '.framework-technical__owners li'
        ),
        lowerTagsUseCompactVerticalInsets,
        outputCardsShareHeights: blocksShareHeights(
          '.framework-technical__outputs li'
        ),
        routeColumns:
          getComputedStyle(routes).gridTemplateColumns.split(' ').length,
        routeCopySize: Number.parseFloat(getComputedStyle(routeCopy).fontSize),
        sectionHeight: element.getBoundingClientRect().height,
        sectionWidth: element.getBoundingClientRect().width,
        tagWidthsFitContents,
        usesLandingStage: element.classList.contains('framework-flow')
      }
    })

    expect(layout.backgroundIsLight).toBe(true)
    expect(layout.beforeCurrentSupport).toBe(true)
    expect(layout.ownerModelBefore).toBe(true)
    expect(layout.ownerOutputColumnsAligned).toBe(true)
    expect(layout.routesAttachToOwners).toBe(true)
    expect(layout.routeGap).toBeLessThanOrEqual(1)
    expect(layout.routeHeightsAligned).toBe(true)
    expect(layout.ownerCardsShareHeights).toBe(true)
    expect(layout.lowerTagsUseCompactVerticalInsets).toBe(true)
    expect(layout.outputCardsShareHeights).toBe(true)
    if (profile.routeColumns === 2) {
      expect(layout.routeRowsAligned).toBe(true)
    }
    expect(layout.routeColumns).toBe(profile.routeColumns)
    expect(layout.routeCopySize).toBeGreaterThanOrEqual(13)
    expect(layout.sectionHeight).toBeLessThanOrEqual(profile.maxHeight)
    expect(layout.sectionWidth).toBeLessThanOrEqual(profile.width + 1)
    expect.soft(layout.tagWidthsFitContents).toBe(true)
    expect(layout.usesLandingStage).toBe(false)
    await assertNoHorizontalOverflow(page)
    await section.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`docs-framework-flow-${profile.width}.png`)
    })
  }

  await page.goto('/docs/build/feature-session')
  await expect(page.locator('#framework-flow-technical')).toHaveCount(0)
})

test('documentation navigation resets the reader and preserves the sidebar position between guides', async ({
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

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(1)
  const positionAfterNavigation = await page.evaluate(() => ({
    sidebar:
      document.querySelector<HTMLElement>('.docs-navigation')?.scrollTop ?? 0
  }))
  expect(positionAfterNavigation.sidebar).toBeCloseTo(
    positionBeforeNavigation.sidebar,
    0
  )
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('docs-reset-reader-preserved-navigation.png')
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
      const expectedOuterEdge = 0
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
          right: footerRect.right - rect.right,
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
    { width: 3600, height: 1800 },
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
    expect(supportingFooter.identity).toBeNull()
    expect(supportingFooter.text).not.toMatch(/2026|MIT License/)
    expect(supportingFooter.text).not.toContain(
      'Composable infrastructure for tools built around your domain.'
    )
    if (viewport.width > 900) {
      expect(
        Math.abs(
          (supportingFooter.navigation?.right ?? Number.POSITIVE_INFINITY) -
            (supportingFooter.wordmark?.left ?? Number.NEGATIVE_INFINITY)
        )
      ).toBeLessThanOrEqual(1)
    } else {
      expect(
        Math.abs(
          (supportingFooter.navigation?.left ?? Number.POSITIVE_INFINITY) -
            (supportingFooter.wordmark?.left ?? Number.NEGATIVE_INFINITY)
        )
      ).toBeLessThanOrEqual(1)
    }
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
  const desktopHistory = await page
    .locator('.release-history__list')
    .boundingBox()
  expect(desktopHistory?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(990)

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
  const mobileHistory = await page
    .locator('.release-history__list')
    .boundingBox()
  expect(mobileHistory?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(960)

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

test('roadmap keeps current support in the summary and internal detail out of the guide', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/roadmap')

  const statusCards = page.locator('.roadmap-status-grid .status-surface')
  await expect(statusCards).toHaveCount(3)
  await expect(
    page
      .locator('.roadmap-status-grid')
      .getByText('What is current', { exact: true })
  ).toBeVisible()
  await expect(
    page
      .locator('.support-section--split .support-label')
      .getByText('What you can build now', { exact: true })
  ).toBeVisible()
  await expect(
    page
      .locator('.roadmap-status-grid')
      .getByText('What is future', { exact: true })
  ).toBeVisible()
  await expect(
    page
      .locator('.roadmap-status-grid')
      .getByText('Do not claim yet', { exact: true })
  ).toBeVisible()

  const desktopColumns = await page
    .locator('.roadmap-status-grid')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(desktopColumns.split(' ')).toHaveLength(3)
  await expect(
    page.locator('.support-document article').getByRole('heading', {
      level: 2,
      name: 'What is current'
    })
  ).toHaveCount(0)
  await page.locator('.roadmap-status-grid').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('roadmap-future-boundaries-1440.png')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileColumns = await page
    .locator('.roadmap-status-grid')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(mobileColumns.split(' ')).toHaveLength(1)
  await assertNoHorizontalOverflow(page)
  await page.locator('.roadmap-status-grid').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('roadmap-future-boundaries-390.png')
  })
})

test('releases presents user-facing package and support facts at every width', async ({
  page
}, testInfo) => {
  const expectedEvidence = [
    ['Current release', 'v0.5.0'],
    ['Inventory', '19 public packages'],
    ['License', 'MIT'],
    ['Supported composition', '2D + CUSTOM']
  ]

  for (const viewport of [
    { width: 3600, height: 1800 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 1000 },
    { width: 820, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 720 }
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/releases')

    await expect(
      page.getByText('Releases - Framework milestones', { exact: true })
    ).toBeVisible()
    const evidence = page.locator('.evidence-strip > div')
    await expect(evidence).toHaveCount(4)
    const evidenceTopBorderWidth = await page
      .locator('.evidence-strip')
      .evaluate((element) => getComputedStyle(element).borderTopWidth)
    expect(evidenceTopBorderWidth).toBe('0px')
    for (const [index, [label, value]] of expectedEvidence.entries()) {
      await expect(evidence.nth(index).locator('dt')).toHaveText(label)
      await expect(evidence.nth(index).locator('dd')).toHaveText(value)
    }
    await expect(page.getByText('Release truth', { exact: true })).toHaveCount(
      0
    )
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Important Framework milestones.'
      })
    ).toBeVisible()
    await expect(
      page.locator('.release-history').getByText('v0.5.0', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Build product features, not infrastructure.'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Read the complete v0.5.0 release' })
    ).toHaveAttribute('target', '_blank')
    await expect(
      page.getByRole('link', { name: 'Read the complete v0.5.0 release' })
    ).toHaveAttribute('rel', 'noopener noreferrer')
    const inventoryGap = await page.evaluate(() => {
      const history = document.querySelector('.release-history')
      const inventoryHeading = document.querySelector(
        '.package-inventory .support-section__heading'
      )
      if (!history || !inventoryHeading) {
        throw new Error('Missing Releases history or package inventory')
      }
      return (
        inventoryHeading.getBoundingClientRect().top -
        history.getBoundingClientRect().bottom
      )
    })
    expect(inventoryGap).toBeGreaterThanOrEqual(56)
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Environment, security, migration, and compatibility.'
      })
    ).toBeVisible()
    await assertNoHorizontalOverflow(page)

    if (viewport.width <= 390) {
      const columns = await page
        .locator('.evidence-strip')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
      expect(columns.split(' ')).toHaveLength(2)
    }

    await page.locator('.page-hero').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`releases-hero-${viewport.width}.png`)
    })
    await page.locator('.evidence-strip').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`releases-evidence-${viewport.width}.png`)
    })
    await page.locator('.release-history').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`releases-history-${viewport.width}.png`)
    })
    await page
      .locator('.package-inventory .support-section__heading')
      .screenshot({
        animations: 'disabled',
        path: testInfo.outputPath(
          `releases-inventory-intro-${viewport.width}.png`
        )
      })
    await page.locator('.support-document > header').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`releases-support-intro-${viewport.width}.png`)
    })
  }
})

test('support document headings remain readable inside their narrower column', async ({
  page
}) => {
  for (const viewportWidth of [1440, 2048]) {
    await page.setViewportSize({ width: viewportWidth, height: 1000 })

    for (const route of ['/asyra-design', '/releases', '/roadmap']) {
      await page.goto(route)
      const metrics = await page
        .locator('.support-document')
        .evaluate((root) => {
          const header = root.querySelector('header')
          const title = header?.querySelector('h2')
          const article = root.querySelector('article')
          if (!header || !title || !article) {
            throw new Error('Support document is missing its heading')
          }
          const headerRect = header.getBoundingClientRect()
          const articleRect = article.getBoundingClientRect()
          const titleStyle = getComputedStyle(title)
          return {
            fontSize: Number.parseFloat(titleStyle.fontSize),
            headerWidthRatio:
              headerRect.width / (headerRect.width + articleRect.width)
          }
        })

      expect(metrics.fontSize).toBeLessThanOrEqual(40)
      expect(metrics.headerWidthRatio).toBeGreaterThanOrEqual(0.28)
    }
  }
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

test('mobile supporting copy keeps a readable minimum size', async ({
  page
}, testInfo) => {
  for (const width of [520, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })

    await page.goto('/')
    await assertMinimumFontSize(page, '.poc-story__governance', 14)
    await page.locator('.poc-story__inner').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`home-workflow-supporting-copy-${width}.png`)
    })

    await page.goto('/atlas')
    await assertMinimumFontSize(page, '.atlas-projection__empty', 14)
    await page.locator('.atlas-projection').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`atlas-empty-supporting-copy-${width}.png`)
    })

    await page.goto('/releases')
    await assertMinimumFontSize(page, '.package-ledger article p', 14)
    const metadataLabelSizes = await page
      .locator('.package-ledger article p')
      .evaluateAll((elements) =>
        elements.map((element) =>
          Number.parseFloat(getComputedStyle(element, '::before').fontSize)
        )
      )
    expect
      .soft(
        Math.min(...metadataLabelSizes),
        'package metadata labels must remain readable'
      )
      .toBeGreaterThanOrEqual(12)
    await page
      .locator('.package-ledger article')
      .first()
      .screenshot({
        animations: 'disabled',
        path: testInfo.outputPath(
          `releases-ledger-supporting-copy-${width}.png`
        )
      })
  }
})
