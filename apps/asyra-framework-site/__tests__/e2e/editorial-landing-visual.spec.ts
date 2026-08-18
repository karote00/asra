import { expect, test, type Page, type TestInfo } from '@playwright/test'

const loadLanding = async (page: Page) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Build the tool'
  )
  const images = page.locator('img')
  await images.evaluateAll((elements: HTMLImageElement[]) => {
    for (const image of elements) image.loading = 'eager'
  })
  for (let index = 0; index < (await images.count()); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element: HTMLImageElement) => element.decode())
  }
  await expect
    .poll(
      () =>
        page
          .locator('img')
          .evaluateAll((images: HTMLImageElement[]) =>
            images.every((image) => image.complete && image.naturalWidth > 0)
          ),
      { timeout: 10_000 }
    )
    .toBe(true)
  await page.evaluate(() => {
    const root = document.documentElement
    root.style.scrollBehavior = 'auto'
    root.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo(0, 0)
  })
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 1_000 })
    .toBe(0)
}

const assertNoHorizontalOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

const assertLinksAndCtas = async (page: Page) => {
  const links = await page.locator('a').evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const element = anchor as HTMLAnchorElement
      return {
        href: element.getAttribute('href'),
        pointerEvents: getComputedStyle(element).pointerEvents
      }
    })
  )
  expect(links).toHaveLength(14)
  for (const link of links) {
    expect(link.href).not.toBeNull()
    expect(link.href).not.toBe('')
    expect(link.pointerEvents).not.toBe('none')
  }

  const ctas = await page.locator('.button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const element = button as HTMLElement
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: getComputedStyle(element).whiteSpace
      }
    })
  )
  for (const cta of ctas) {
    expect(cta.whiteSpace).toBe('nowrap')
    expect(cta.scrollWidth).toBeLessThanOrEqual(cta.clientWidth + 1)
  }
}

const currentImageSources = (page: Page) =>
  page
    .locator('img')
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => image.currentSrc)
    )

const assertTransparentPhotoroomAssets = async (page: Page) => {
  const sources = await currentImageSources(page)
  expect(sources).toHaveLength(6)
  for (const name of [
    'hero-core-v08-desktop-photoroom-',
    'domain-rail-v08-desktop-photoroom-',
    'grow-photoroom-',
    'same-path-photoroom-',
    'one-source-v08-desktop-photoroom-',
    'closing-core-v09-photoroom-'
  ]) {
    expect(
      sources.some((source) => source.includes(`/${name}`)),
      name
    ).toBe(true)
  }
  const alphaSamples = await page
    .locator('main img')
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Unable to inspect illustration alpha')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data
        let transparent = 0
        let opaque = 0
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] === 0) transparent += 1
          if (pixels[index] === 255) opaque += 1
        }
        return { alt: image.alt, opaque, transparent }
      })
    )
  for (const sample of alphaSamples) {
    expect(sample.transparent, sample.alt).toBeGreaterThan(0)
    expect(sample.opaque, sample.alt).toBeGreaterThan(0)
  }
  return sources
}

const assertAdaptiveGridAndShadows = async (page: Page) => {
  const profileNames = [
    'hero',
    'rail',
    'grow',
    'same-path',
    'one-source',
    'closing'
  ]
  const stages = await page.locator('.illustration-stage').evaluateAll(
    (elements: HTMLElement[], profiles: string[]) =>
      elements.map((element) => {
        const image = element.querySelector(':scope > img')
        if (!(image instanceof HTMLImageElement)) {
          throw new Error('Illustration stage is missing its direct image')
        }
        const grid = getComputedStyle(element, '::before')
        const filter = getComputedStyle(image).filter
        const bounds = element.getBoundingClientRect()
        const shadowLayers = Array.from(
          filter.matchAll(
            /drop-shadow\(rgba?\([^)]+\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\)/g
          ),
          (match) => ({
            blur: Number(match[3]),
            x: Number(match[1]),
            y: Number(match[2])
          })
        )
        const shadowAlphas = Array.from(
          filter.matchAll(
            /drop-shadow\(rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\)/g
          ),
          (match) => Number(match[1])
        )
        const profile = profiles.find((name) =>
          element.classList.contains(`illustration-stage--${name}`)
        )
        return {
          backgroundImage: grid.backgroundImage,
          dark: element.classList.contains('illustration-stage--dark'),
          filter,
          height: bounds.height,
          opacity: Number(grid.opacity),
          profile,
          shadowAlphas,
          shadowLayers,
          width: bounds.width
        }
      }),
    profileNames
  )

  expect(stages).toHaveLength(6)
  const castVectors = new Set<string>()
  const profiles = new Set<string>()
  for (const stage of stages) {
    expect(stage.backgroundImage).toContain('repeating-linear-gradient')
    expect(stage.backgroundImage).toContain('radial-gradient')
    expect(stage.filter).toContain('drop-shadow')
    expect(stage.height).toBeGreaterThan(0)
    expect(stage.opacity).toBeGreaterThan(0)
    expect(stage.profile).toBeTruthy()
    expect(stage.shadowLayers).toHaveLength(3)
    expect(stage.shadowAlphas).toHaveLength(3)
    expect(stage.width).toBeGreaterThan(0)

    const [contact, cast, ambient] = stage.shadowLayers
    expect(contact.x).toBeGreaterThan(0)
    expect(contact.y).toBeGreaterThan(0)
    expect(cast.x).toBeGreaterThan(contact.x)
    expect(cast.y).toBeGreaterThan(contact.y)
    expect(cast.blur).toBeGreaterThan(contact.blur)
    expect(stage.shadowAlphas[0]).toBeGreaterThanOrEqual(0.24)
    expect(stage.shadowAlphas[1]).toBeGreaterThanOrEqual(0.32)
    if (stage.dark) {
      expect(ambient.blur).toBeGreaterThan(0)
      expect(stage.shadowAlphas[2]).toBeGreaterThanOrEqual(0.18)
    }
    castVectors.add(`${cast.x}|${cast.y}`)
    profiles.add(stage.profile ?? '')
  }
  expect(castVectors.size).toBe(6)
  expect(profiles).toEqual(new Set(profileNames))
}

const assertSourceImageDensity = async (page: Page) => {
  const assets = await page
    .locator('main img')
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => {
        const renderedWidth = image.getBoundingClientRect().width
        const filename =
          new URL(image.currentSrc).pathname.split('/').at(-1) ?? ''
        const sourceWidth = Number(filename.match(/-(\d+)\.webp$/)?.[1])
        return {
          alt: image.alt,
          density: sourceWidth / renderedWidth,
          filename
        }
      })
    )
  expect(assets).toHaveLength(6)
  for (const asset of assets) {
    const minimumDensity = asset.filename.includes('domain-rail') ? 1.1 : 2
    expect(
      asset.density,
      `${asset.filename}: ${asset.alt}`
    ).toBeGreaterThanOrEqual(minimumDensity)
  }
}

const assertModernSansTypography = async (page: Page) => {
  const fontFamilies = await page
    .locator('h1, h2')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).fontFamily)
    )
  for (const fontFamily of fontFamilies) {
    expect(fontFamily).toContain('system-ui')
    expect(fontFamily).toContain('sans-serif')
    expect(fontFamily).not.toMatch(/Baskerville|Iowan|Times/i)
  }
}

const assertAiryHeadingTypography = async (page: Page) => {
  const headings = await page
    .locator('.hero h1, .domains h2, .proof h2, .closing h2')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element)
        const fontSize = Number.parseFloat(style.fontSize)
        return {
          lineHeightRatio: Number.parseFloat(style.lineHeight) / fontSize,
          selector: element.id,
          weight: Number(style.fontWeight)
        }
      })
    )
  for (const heading of headings) {
    expect(heading.weight, heading.selector).toBeLessThanOrEqual(500)
    expect(heading.lineHeightRatio, heading.selector).toBeGreaterThanOrEqual(1)
  }
  for (const heading of headings.filter(({ selector }) =>
    /grow|path|source|change|closing/.test(selector)
  )) {
    expect(heading.lineHeightRatio, heading.selector).toBeGreaterThanOrEqual(
      1.04
    )
  }
}

const assertDomainLabelPosition = async (page: Page) => {
  const ink = await page
    .locator('.domain-rail')
    .evaluate((image: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Unable to inspect domain label position')
      context.drawImage(image, 0, 0)

      const darkRows = (top: number, bottom: number) => {
        const left = Math.round(canvas.width * 0.073)
        const width = Math.round(canvas.width * 0.058)
        const firstRow = Math.round(canvas.height * top)
        const lastRow = Math.round(canvas.height * bottom)
        const rows: number[] = []
        for (let y = firstRow; y <= lastRow; y += 1) {
          const pixels = context.getImageData(left, y, width, 1).data
          let darkPixels = 0
          for (let index = 0; index < pixels.length; index += 4) {
            if (
              pixels[index] < 90 &&
              pixels[index + 1] < 90 &&
              pixels[index + 2] < 90 &&
              pixels[index + 3] > 128
            ) {
              darkPixels += 1
            }
          }
          if (darkPixels >= 3) rows.push(y)
        }
        return rows
      }

      const iconRows = darkRows(0.34, 0.62)
      const labelRows = darkRows(0.6, 0.82)
      const iconBottom = iconRows.at(-1)
      const labelTop = labelRows.at(0)
      if (iconBottom === undefined || labelTop === undefined) {
        throw new Error('Unable to resolve domain icon-to-label gap')
      }

      return {
        gapRatio: (labelTop - iconBottom - 1) / canvas.height
      }
    })

  expect(ink.gapRatio).toBeGreaterThanOrEqual(0.09)
  expect(ink.gapRatio).toBeLessThanOrEqual(0.11)
}

const assertPerceptualImageSharpness = async (
  page: Page,
  minimums: Record<string, number>
) => {
  const assets = await page
    .locator('main img')
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => {
        const bounds = image.getBoundingClientRect()
        const width = Math.max(1, Math.round(bounds.width))
        const height = Math.max(1, Math.round(bounds.height))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context)
          throw new Error('Unable to measure illustration sharpness')
        context.drawImage(image, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data
        const luminance = (index: number) =>
          pixels[index] * 0.2126 +
          pixels[index + 1] * 0.7152 +
          pixels[index + 2] * 0.0722
        let edgeGradient = 0
        let edgeSamples = 0
        let samples = 0
        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = (y * width + x) * 4
            const center = luminance(index)
            const gradient =
              (Math.abs(center - luminance(index + 4)) +
                Math.abs(center - luminance(index + width * 4))) /
              2
            if (gradient >= 12) {
              edgeGradient += gradient
              edgeSamples += 1
            }
            samples += 1
          }
        }
        const filename =
          new URL(image.currentSrc).pathname.split('/').at(-1) ?? ''
        return {
          key: filename.replace(/-\d+\.webp$/, ''),
          coverage: edgeSamples / samples,
          score: edgeGradient / edgeSamples
        }
      })
    )
  for (const asset of assets) {
    const minimum = minimums[asset.key]
    expect(minimum, `Missing sharpness contract for ${asset.key}`).toBeDefined()
    expect.soft(asset.score, asset.key).toBeGreaterThanOrEqual(minimum)
    expect
      .soft(asset.coverage, `${asset.key} edge coverage`)
      .toBeGreaterThanOrEqual(0.07)
  }
}

const desktopSharpness = {
  'hero-core-v08-desktop-photoroom': 30,
  'domain-rail-v08-desktop-photoroom': 32,
  'grow-photoroom': 27,
  'same-path-photoroom': 28,
  'one-source-v08-desktop-photoroom': 24,
  'closing-core-v09-photoroom': 18
}

const mobileSharpness = {
  'hero-core-v08-desktop-photoroom': 27,
  'domain-rail-v08-desktop-photoroom': 30,
  'grow-photoroom': 30,
  'same-path-photoroom': 29,
  'one-source-v08-desktop-photoroom': 26,
  'closing-core-v09-photoroom': 18
}

const retinaMobileSharpness = {
  ...mobileSharpness,
  'grow-photoroom': 27,
  'one-source-v08-desktop-photoroom': 24
}

const assertTwoColumnProofs = async (page: Page) => {
  const sections = await page.locator('.proof').evaluateAll((proofs) =>
    proofs.map((proof) => {
      const style = getComputedStyle(proof)
      return {
        borderBottomWidth: Number.parseFloat(style.borderBottomWidth),
        borderTopWidth: Number.parseFloat(style.borderTopWidth),
        columns: style.gridTemplateColumns.split(' ').length
      }
    })
  )
  expect(sections).toHaveLength(3)
  for (const section of sections) {
    expect(section.columns).toBe(2)
    expect(section.borderTopWidth).toBe(0)
    expect(section.borderBottomWidth).toBe(0)
  }
}

const assertUnbrokenReferenceLines = async (page: Page) => {
  const lines = await page
    .locator('.hero h1 .reference-line, .proof h2 .reference-line')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return {
          lineCount: range.getClientRects().length,
          text: element.textContent?.trim() ?? ''
        }
      })
    )
  for (const line of lines) {
    expect(line.lineCount, line.text).toBe(1)
  }
}

const assertSingleColumnProofs = async (page: Page) => {
  const sections = await page.locator('.proof').evaluateAll((proofs) =>
    proofs.map((proof) => {
      const style = getComputedStyle(proof)
      return {
        columns: style.gridTemplateColumns.split(' ').length,
        paddingBottom: Number.parseFloat(style.paddingBottom),
        paddingTop: Number.parseFloat(style.paddingTop)
      }
    })
  )
  for (const section of sections) {
    expect(section.columns).toBe(1)
    expect(section.paddingTop).toBeGreaterThanOrEqual(70)
    expect(section.paddingBottom).toBeGreaterThanOrEqual(70)
  }
}

const captureSection = async (
  page: Page,
  selector: string,
  filename: string,
  testInfo: TestInfo
) => {
  const target = page.locator(selector)
  const viewport = page.viewportSize()
  await target.scrollIntoViewIfNeeded()
  const geometry = await target.boundingBox()
  if (!viewport) throw new Error(`Unable to capture ${selector}`)
  if (!geometry) throw new Error(`Unable to resolve ${selector}`)
  const y = Math.max(0, geometry.y)
  const height = Math.min(geometry.height, viewport.height - y)
  if (height <= 0) throw new Error(`Unable to frame ${selector}`)
  await page.screenshot({
    animations: 'disabled',
    clip: {
      height,
      width: viewport.width,
      x: 0,
      y
    },
    path: testInfo.outputPath(filename)
  })
}

const captureLandingSections = async (
  page: Page,
  suffix: string,
  testInfo: TestInfo
) => {
  for (const [selector, name] of [
    ['.hero', 'hero'],
    ['.domains', 'domains'],
    ['.proof:nth-child(1)', 'grow'],
    ['.proof:nth-child(2)', 'same-path'],
    ['.proof:nth-child(3)', 'one-source'],
    ['.closing', 'closing']
  ]) {
    await captureSection(page, selector, `${name}-${suffix}.png`, testInfo)
  }
}

const parseRgbBrightness = (rgb: string) => {
  const channels = rgb
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number)
  if (!channels || channels.length !== 3) {
    throw new Error(`Unable to parse color: ${rgb}`)
  }
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

test('1440px captures the complete landing page after every illustration renders', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loadLanding(page)

  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded()
  }
  await page.evaluate(() => window.scrollTo(0, 0))

  await expect
    .poll(() =>
      page.locator('img').evaluateAll(
        (images) =>
          images.filter((image) => {
            const resolved = image as HTMLImageElement
            return !resolved.complete || resolved.naturalWidth === 0
          }).length
      )
    )
    .toBe(0)
  await expect(page.locator('img')).toHaveCount(6)
  await expect(page.locator('#change-title')).toHaveCount(0)
  await expect(page.locator('#impact-preview')).toHaveCount(0)
  const domainRailCurrentSource = await page
    .locator('.domain-rail')
    .evaluate((image: HTMLImageElement) => image.currentSrc)
  expect(domainRailCurrentSource).toMatch(
    /domain-rail-v08-desktop-photoroom-1600\.webp$/
  )
  await assertNoHorizontalOverflow(page)

  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-complete-1440.png')
  })
})

test('864px preserves the approved domain rail proportions and original closing composition', async ({
  page
}) => {
  await page.setViewportSize({ width: 864, height: 1000 })
  await loadLanding(page)

  const domainGeometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('.domains')
    const rail = document.querySelector<HTMLImageElement>('.domain-rail')
    const note = document.querySelector<HTMLElement>('.domains__heading span')
    if (!section || !rail || !note) {
      throw new Error('Missing approved domain composition target')
    }
    const sectionBounds = section.getBoundingClientRect()
    const railBounds = rail.getBoundingClientRect()
    return {
      bottomClearance: sectionBounds.bottom - railBounds.bottom,
      railHeight: railBounds.height,
      railWidth: railBounds.width,
      noteTransform: getComputedStyle(note).textTransform
    }
  })

  expect.soft(domainGeometry.railWidth).toBeGreaterThanOrEqual(863)
  expect.soft(domainGeometry.railWidth).toBeLessThanOrEqual(865)
  expect.soft(domainGeometry.railHeight).toBeGreaterThanOrEqual(110)
  expect.soft(domainGeometry.railHeight).toBeLessThanOrEqual(125)
  expect.soft(domainGeometry.bottomClearance).toBeGreaterThanOrEqual(26)
  expect.soft(domainGeometry.bottomClearance).toBeLessThanOrEqual(38)
  expect.soft(domainGeometry.noteTransform).toBe('none')
  await assertDomainLabelPosition(page)

  const closingGeometry = await page
    .locator('.closing img')
    .evaluate((image: HTMLImageElement) => {
      const bounds = image.getBoundingClientRect()
      return {
        aspectRatio: image.naturalWidth / image.naturalHeight,
        renderedWidth: bounds.width,
        sourceWidth: image.naturalWidth
      }
    })
  expect.soft(closingGeometry.aspectRatio).toBeGreaterThan(1.49)
  expect.soft(closingGeometry.aspectRatio).toBeLessThan(1.51)
  expect
    .soft(closingGeometry.sourceWidth)
    .toBeGreaterThanOrEqual(closingGeometry.renderedWidth * 2)
})

test('864px matches the V04 composition, assets, line breaks, and CTA states', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 864, height: 1000 })
  await loadLanding(page)

  await expect(page.locator('.hero h1 .reference-line')).toHaveCount(2)
  await expect(page.locator('.proof')).toHaveCount(3)
  await expect(page.locator('.domain-names')).toHaveCount(0)
  await expect(page.locator('.impact-key')).toHaveCount(0)
  await expect(page.locator('.closing img')).toHaveAttribute(
    'src',
    /closing-core-v09-photoroom-1536\.webp$/
  )
  await assertLinksAndCtas(page)
  await assertTwoColumnProofs(page)
  await assertUnbrokenReferenceLines(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertPerceptualImageSharpness(page, mobileSharpness)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)

  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)

  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing geometry target: ${selector}`)
      const rect = element.getBoundingClientRect()
      return { bottom: Math.round(rect.bottom), top: Math.round(rect.top) }
    }
    return {
      closing: bounds('.closing'),
      domains: bounds('.domains'),
      footer: bounds('.site-footer'),
      hero: bounds('.hero'),
      proofs: Array.from(document.querySelectorAll<HTMLElement>('.proof')).map(
        (proof) => Math.round(proof.getBoundingClientRect().height)
      )
    }
  })
  expect(geometry.hero.bottom).toBeGreaterThanOrEqual(455)
  expect(geometry.hero.bottom).toBeLessThanOrEqual(480)
  expect(geometry.domains.bottom - geometry.domains.top).toBeGreaterThanOrEqual(
    295
  )
  for (const height of geometry.proofs) {
    expect(height).toBeGreaterThanOrEqual(215)
    expect(height).toBeLessThanOrEqual(250)
  }
  expect(geometry.footer.bottom).toBeGreaterThanOrEqual(1640)
  expect(geometry.footer.bottom).toBeLessThanOrEqual(1750)

  const proofImageBounds = await page
    .locator('.proof img')
    .evaluateAll((images) =>
      images.map((image) => {
        const bounds = image.getBoundingClientRect()
        return { left: bounds.left, right: bounds.right }
      })
    )
  for (const bounds of proofImageBounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(-1)
    expect(bounds.right).toBeLessThanOrEqual(865)
  }

  const heroCta = page.locator('.button-row .button--red')
  const defaultColor = await heroCta.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  await captureSection(page, '.button-row', 'cta-default-864.png', testInfo)
  await heroCta.hover()
  await expect
    .poll(
      async () =>
        parseRgbBrightness(
          await heroCta.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
        ),
      { timeout: 1_000 }
    )
    .toBeGreaterThan(parseRgbBrightness(defaultColor))
  await captureSection(page, '.button-row', 'cta-hover-864.png', testInfo)
  await heroCta.focus()
  await expect
    .poll(
      async () =>
        parseRgbBrightness(
          await heroCta.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
        ),
      { timeout: 1_000 }
    )
    .toBeGreaterThan(parseRgbBrightness(defaultColor))
  await captureSection(page, '.button-row', 'cta-focus-864.png', testInfo)
  await heroCta.evaluate((element) => element.blur())
  await page.mouse.move(0, 0)

  await captureLandingSections(page, 'reference-864', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-reference-864.png')
  })
})

test('1440px scales the same V04 composition without changing its visual language', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loadLanding(page)
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertLinksAndCtas(page)
  await assertTwoColumnProofs(page)
  await assertUnbrokenReferenceLines(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)

  const height = await page.evaluate(
    () => document.documentElement.scrollHeight
  )
  expect(height).toBeGreaterThanOrEqual(2560)
  expect(height).toBeLessThanOrEqual(2680)
  await captureLandingSections(page, 'desktop-1440', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-desktop-1440.png')
  })
})

test('2048px uses the supplied 2400px domain rail without losing detail', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1200 })
  await loadLanding(page)
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertSourceImageDensity(page)
  await assertPerceptualImageSharpness(page, desktopSharpness)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)
  const domainRailCurrentSource = await page
    .locator('.domain-rail')
    .evaluate((image: HTMLImageElement) => image.currentSrc)
  expect(domainRailCurrentSource).toMatch(
    /domain-rail-v08-desktop-photoroom-2400\.webp$/
  )
  await captureLandingSections(page, 'wide-2048', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-wide-2048.png')
  })
  const growImage = page.locator('.proof-image--grow')
  const priorStyle = await growImage.getAttribute('style')
  await growImage.evaluate((image: HTMLImageElement) => {
    image.style.maxWidth = 'none'
    image.style.width = `${image.getBoundingClientRect().width * 2}px`
  })
  await growImage.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('grow-microscope-2048-200-percent.png')
  })
  await growImage.evaluate((image: HTMLImageElement, style) => {
    if (style === null) image.removeAttribute('style')
    else image.setAttribute('style', style)
  }, priorStyle)
})

test('820px retains the reference two-column composition', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await loadLanding(page)

  await expect(page.locator('.primary-nav')).toBeVisible()
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertTwoColumnProofs(page)
  await assertUnbrokenReferenceLines(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)
  await captureLandingSections(page, 'tablet-820', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-tablet-820.png')
  })
})

test('390px uses mobile crops without document overflow', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loadLanding(page)

  await expect(page.locator('.primary-nav')).toBeHidden()
  await assertLinksAndCtas(page)
  await assertSingleColumnProofs(page)
  await assertNoHorizontalOverflow(page)
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertPerceptualImageSharpness(page, mobileSharpness)
  const rail = await page.locator('.domains__rail').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }))
  expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth)

  await captureLandingSections(page, 'mobile-390', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-mobile-390.png')
  })
})

test('320px keeps every section readable within the viewport', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await loadLanding(page)

  await expect(page.locator('footer')).toBeVisible()
  await assertLinksAndCtas(page)
  await assertSingleColumnProofs(page)
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)
  await captureLandingSections(page, 'mobile-320', testInfo)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-mobile-320.png')
  })
})

test('Retina rendering keeps at least two source pixels per CSS pixel', async ({
  browser
}, testInfo) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 864, height: 1000 }
  })
  const page = await context.newPage()
  await loadLanding(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertPerceptualImageSharpness(page, retinaMobileSharpness)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-retina-864.png')
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await loadLanding(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertPerceptualImageSharpness(page, mobileSharpness)
  await captureSection(page, '.hero', 'hero-retina-390.png', testInfo)
  await context.close()
})

test('the complete landing narrative works without client JavaScript', async ({
  browser
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 }
  })
  const page = await context.newPage()
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('One foundation. Any field.')).toBeVisible()
  await expect(page.getByText('Bring your domain.')).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await context.close()
})

test('reduced motion removes smooth scrolling and transitions', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await loadLanding(page)

  const motion = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('.button')
    if (!button) throw new Error('Missing CTA for reduced-motion verification')
    return {
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: getComputedStyle(button).transitionDuration
    }
  })
  expect(motion.scrollBehavior).toBe('auto')
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(
    0.001
  )
})
