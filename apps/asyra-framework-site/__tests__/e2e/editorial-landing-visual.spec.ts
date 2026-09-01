import { expect, test, type Page, type TestInfo } from '@playwright/test'

const loadLanding = async (page: Page) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Build product features'
  )
  const images = page.locator('img')
  await images.evaluateAll((elements: HTMLImageElement[]) => {
    for (const image of elements) image.loading = 'eager'
  })
  for (let index = 0; index < (await images.count()); index += 1) {
    const image = images.nth(index)
    if (await image.isVisible()) await image.scrollIntoViewIfNeeded()
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

const assertVisibleImagesStayInsideViewport = async (page: Page) => {
  const overflow = await page.locator('img').evaluateAll((images) => {
    const viewportWidth = document.documentElement.clientWidth

    return images.flatMap((image) => {
      const bounds = image.getBoundingClientRect()
      const style = getComputedStyle(image)
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        bounds.width > 0 &&
        bounds.height > 0

      if (
        !visible ||
        (bounds.left >= -1 && bounds.right <= viewportWidth + 1)
      ) {
        return []
      }

      return [
        {
          className: image.className,
          left: bounds.left,
          right: bounds.right,
          viewportWidth
        }
      ]
    })
  })

  expect(overflow).toEqual([])
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
  expect(links.length).toBeGreaterThanOrEqual(13)
  for (const link of links) {
    expect(link.href).not.toBeNull()
    expect(link.href).not.toBe('')
    expect(link.href).not.toBe('#')
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
  expect(ctas).toHaveLength(3)
  await expect(page.locator('.site-header .button')).toHaveCount(0)
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
  expect(sources).toHaveLength(16)
  expect(
    sources.some((source) =>
      source.endsWith(
        '/product-evidence/asyra-design-7076-product-evidence.webp'
      )
    )
  ).toBe(true)
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
  expect(
    sources.filter((source) =>
      /\/illustrations\/poc-storyboard-stage-\d{2}-(?:traditional|asyra)\.png$/.test(
        source
      )
    )
  ).toHaveLength(8)
  const alphaSamples = await page
    .locator('.illustration-stage img')
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
      images.flatMap((image) => {
        const renderedWidth = image.getBoundingClientRect().width
        if (renderedWidth === 0) return []
        const filename =
          new URL(image.currentSrc).pathname.split('/').at(-1) ?? ''
        const sourceWidthMatch = filename.match(/-(\d+)\.webp$/)
        if (!sourceWidthMatch) return []
        const sourceWidth = Number(sourceWidthMatch[1])
        return [
          {
            alt: image.alt,
            density: sourceWidth / renderedWidth,
            filename
          }
        ]
      })
    )
  expect(assets.length).toBeGreaterThanOrEqual(6)
  expect(assets.length).toBeLessThanOrEqual(7)
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
    .locator(
      '.hero h1, .domains h2, .poc-story h2, .product-evidence h2, .feature-evidence h2, .landing-ownership h2, .proof h2, .readiness h2, .closing h2'
    )
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
      images.flatMap((image) => {
        const bounds = image.getBoundingClientRect()
        if (bounds.width === 0 || bounds.height === 0) return []
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
        return [
          {
            key: filename.replace(/-\d+\.webp$/, ''),
            coverage: edgeSamples / samples,
            score: edgeGradient / edgeSamples
          }
        ]
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
  'asyra-design-7076-product-evidence.webp': 20,
  'hero-core-v08-desktop-photoroom': 30,
  'domain-rail-v08-desktop-photoroom': 32,
  'grow-photoroom': 27,
  'same-path-photoroom': 28,
  'one-source-v08-desktop-photoroom': 24,
  'closing-core-v09-photoroom': 18,
  'poc-storyboard-stage-01-asyra.png': 20,
  'poc-storyboard-stage-01-traditional.png': 20,
  'poc-storyboard-stage-02-asyra.png': 20,
  'poc-storyboard-stage-02-traditional.png': 20,
  'poc-storyboard-stage-03-asyra.png': 20,
  'poc-storyboard-stage-03-traditional.png': 20,
  'poc-storyboard-stage-04-asyra.png': 20,
  'poc-storyboard-stage-04-traditional.png': 20
}

const mobileSharpness = {
  'asyra-design-7076-product-evidence.webp': 20,
  'hero-core-v08-desktop-photoroom': 27,
  'domain-rail-v08-desktop-photoroom': 30,
  'domain-rail-v08-desktop-photoroom-row-1': 30,
  'domain-rail-v08-desktop-photoroom-row-2': 30,
  'grow-photoroom': 30,
  'same-path-photoroom': 29,
  'one-source-v08-desktop-photoroom': 26,
  'closing-core-v09-photoroom': 18,
  'poc-storyboard-stage-01-asyra.png': 20,
  'poc-storyboard-stage-01-traditional.png': 20,
  'poc-storyboard-stage-02-asyra.png': 20,
  'poc-storyboard-stage-02-traditional.png': 20,
  'poc-storyboard-stage-03-asyra.png': 20,
  'poc-storyboard-stage-03-traditional.png': 20,
  'poc-storyboard-stage-04-asyra.png': 20,
  'poc-storyboard-stage-04-traditional.png': 20
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
  expect(sections).toHaveLength(2)
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
        columns: style.gridTemplateColumns.split(' ').length
      }
    })
  )
  for (const section of sections) {
    expect(section.columns).toBe(1)
  }
}

interface ResponsiveFlowContract {
  maxHeroImageWidthRatio: number
  maxImageWidthRatio: number
  maxInlineInset: number
  maxSectionPadding: number
  minCopyWidthRatio: number
  minHeroImageWidthRatio: number
  minImageWidthRatio: number
}

const assertResponsiveSingleColumnFlow = async (
  page: Page,
  contract: ResponsiveFlowContract
) => {
  const layout = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('.hero')
    const heroCopy = document.querySelector<HTMLElement>('.hero__copy')
    const heroVisual = document.querySelector<HTMLElement>('.hero__visual')
    if (!hero || !heroCopy || !heroVisual) {
      throw new Error('Missing responsive Hero targets')
    }
    const heroCopyBounds = heroCopy.getBoundingClientRect()
    const heroVisualBounds = heroVisual.getBoundingClientRect()
    const heroImage = heroVisual.querySelector<HTMLImageElement>('img')
    if (!heroImage) throw new Error('Missing responsive Hero image')
    const heroImageBounds = heroImage.getBoundingClientRect()
    return {
      hero: {
        columns: getComputedStyle(hero).gridTemplateColumns.split(' ').length,
        imageWidthRatio: heroImageBounds.width / window.innerWidth,
        verticalGap: heroVisualBounds.top - heroCopyBounds.bottom
      },
      proofs: Array.from(document.querySelectorAll<HTMLElement>('.proof')).map(
        (proof) => {
          const copy = proof.querySelector<HTMLElement>('.proof__copy')
          const visual = proof.querySelector<HTMLElement>('.proof__visual')
          const image = proof.querySelector<HTMLImageElement>('img')
          if (!copy || !visual || !image) {
            throw new Error('Missing responsive proof targets')
          }
          const copyBounds = copy.getBoundingClientRect()
          const imageBounds = image.getBoundingClientRect()
          const proofBounds = proof.getBoundingClientRect()
          const style = getComputedStyle(proof)
          const visualBounds = visual.getBoundingClientRect()
          return {
            columns: style.gridTemplateColumns.split(' ').length,
            copyWidthRatio: copyBounds.width / window.innerWidth,
            imageWidthRatio: imageBounds.width / window.innerWidth,
            inlineInset: Math.max(
              proofBounds.left,
              window.innerWidth - proofBounds.right
            ),
            paddingBottom: Number.parseFloat(style.paddingBottom),
            paddingTop: Number.parseFloat(style.paddingTop),
            verticalGap: visualBounds.top - copyBounds.bottom
          }
        }
      )
    }
  })

  expect(layout.hero.columns).toBe(1)
  expect(layout.hero.imageWidthRatio).toBeGreaterThanOrEqual(
    contract.minHeroImageWidthRatio
  )
  expect(layout.hero.imageWidthRatio).toBeLessThanOrEqual(
    contract.maxHeroImageWidthRatio
  )
  expect(layout.hero.verticalGap).toBeGreaterThanOrEqual(28)
  for (const proof of layout.proofs) {
    expect(proof.columns).toBe(1)
    expect(proof.copyWidthRatio).toBeGreaterThanOrEqual(
      contract.minCopyWidthRatio
    )
    expect(proof.inlineInset).toBeLessThanOrEqual(contract.maxInlineInset)
    expect(proof.imageWidthRatio).toBeGreaterThanOrEqual(
      contract.minImageWidthRatio
    )
    expect(proof.imageWidthRatio).toBeLessThanOrEqual(
      contract.maxImageWidthRatio
    )
    expect(proof.paddingTop).toBeLessThanOrEqual(contract.maxSectionPadding)
    expect(proof.paddingBottom).toBeLessThanOrEqual(contract.maxSectionPadding)
    expect(proof.verticalGap).toBeGreaterThanOrEqual(24)
  }
}

const assertCompactTwoColumnFlow = async (page: Page) => {
  const layout = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('.hero')
    const heroCopy = document.querySelector<HTMLElement>('.hero__copy')
    const heroVisual = document.querySelector<HTMLElement>('.hero__visual')
    const heroImage = document.querySelector<HTMLImageElement>('.hero-core')
    if (!hero || !heroCopy || !heroVisual || !heroImage) {
      throw new Error('Missing compact Hero targets')
    }
    const horizontalGap = (first: DOMRect, second: DOMRect) => {
      const [left, right] = [first, second].sort((a, b) => a.left - b.left)
      return right.left - left.right
    }
    return {
      hero: {
        columns: getComputedStyle(hero).gridTemplateColumns.split(' ').length,
        horizontalGap: horizontalGap(
          heroCopy.getBoundingClientRect(),
          heroVisual.getBoundingClientRect()
        ),
        imageWidthRatio:
          heroImage.getBoundingClientRect().width / window.innerWidth
      },
      proofs: Array.from(document.querySelectorAll<HTMLElement>('.proof')).map(
        (proof) => {
          const copy = proof.querySelector<HTMLElement>('.proof__copy')
          const visual = proof.querySelector<HTMLElement>('.proof__visual')
          const image = proof.querySelector<HTMLImageElement>('img')
          if (!copy || !visual || !image) {
            throw new Error('Missing compact Proof targets')
          }
          const style = getComputedStyle(proof)
          return {
            columns: style.gridTemplateColumns.split(' ').length,
            height: proof.getBoundingClientRect().height,
            horizontalGap: horizontalGap(
              copy.getBoundingClientRect(),
              visual.getBoundingClientRect()
            ),
            imageWidthRatio:
              image.getBoundingClientRect().width / window.innerWidth,
            minHeight: Number.parseFloat(style.minHeight),
            paddingBottom: Number.parseFloat(style.paddingBottom),
            paddingTop: Number.parseFloat(style.paddingTop)
          }
        }
      )
    }
  })

  expect(layout.hero.columns).toBe(2)
  expect(layout.hero.horizontalGap).toBeGreaterThanOrEqual(18)
  expect(layout.hero.imageWidthRatio).toBeGreaterThanOrEqual(0.34)
  expect(layout.hero.imageWidthRatio).toBeLessThanOrEqual(0.44)
  for (const proof of layout.proofs) {
    expect(proof.columns).toBe(2)
    expect(proof.height).toBeLessThanOrEqual(315)
    expect(proof.horizontalGap).toBeGreaterThanOrEqual(18)
    expect(proof.imageWidthRatio).toBeGreaterThanOrEqual(0.38)
    expect(proof.imageWidthRatio).toBeLessThanOrEqual(0.55)
    expect(proof.minHeight).toBeLessThanOrEqual(1)
    expect(proof.paddingTop).toBeLessThanOrEqual(28)
    expect(proof.paddingBottom).toBeLessThanOrEqual(28)
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
    ['.framework-value', 'framework-value'],
    ['.poc-story', 'poc-story'],
    ['.product-evidence', 'product-evidence'],
    ['.feature-evidence', 'feature-evidence'],
    ['.landing-ownership', 'ownership-map'],
    ['.proof:nth-child(1)', 'grow'],
    ['.proof:nth-child(2)', 'one-source'],
    ['.readiness', 'readiness'],
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
    if (await image.isVisible()) await image.scrollIntoViewIfNeeded()
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
  await expect(page.locator('img')).toHaveCount(16)
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

test('the PoC storyboard preserves one implementation path across review widths', async ({
  page
}, testInfo) => {
  const profiles = [
    {
      flowLabelsVisible: false,
      flowStepColumns: 4,
      headingColumns: 2,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 250,
      width: 1440
    },
    {
      flowLabelsVisible: true,
      flowStepColumns: 2,
      headingColumns: 1,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 330,
      width: 820
    },
    {
      flowLabelsVisible: true,
      flowStepColumns: 1,
      headingColumns: 1,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 350,
      width: 680
    },
    {
      flowLabelsVisible: true,
      flowStepColumns: 1,
      headingColumns: 1,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 270,
      width: 520
    },
    {
      flowLabelsVisible: true,
      flowStepColumns: 1,
      headingColumns: 1,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 270,
      width: 390
    },
    {
      flowLabelsVisible: true,
      flowStepColumns: 1,
      headingColumns: 1,
      maximumHeadlineLines: 2,
      minimumPanelWidth: 230,
      width: 320
    }
  ]

  for (const profile of profiles) {
    await page.setViewportSize({ width: profile.width, height: 1000 })
    await loadLanding(page)

    const story = page.locator('.poc-story')
    await expect(
      story.getByText('Prove it once. Keep what works.')
    ).toBeVisible()
    await expect(story.getByText('Keep validated work moving.')).toBeVisible()
    await expect(
      story.getByText(
        'What proves the idea becomes the starting point for the product.'
      )
    ).toBeVisible()
    await expect(story.locator('.poc-story__legend')).toHaveCount(1)
    await expect(
      story.locator('.poc-story__legend-item--traditional')
    ).toHaveText('Traditional')
    await expect(story.locator('.poc-story__legend-item--asyra')).toHaveText(
      'With Asyra'
    )
    await expect(story.getByText('Workflow', { exact: true })).toHaveCount(0)
    await expect(story.getByText('Workflow comparison')).toHaveCount(0)
    await expect(story.getByText('Same PoC. Two paths.')).toHaveCount(0)
    await expect(story.getByText('Handoff. Rebuild.')).toHaveCount(0)
    await expect(story.getByText('Review. Keep building.')).toHaveCount(0)
    await expect(
      story.getByText('Same implementation', { exact: true })
    ).toHaveCount(0)
    await expect(story.locator('.story-flow')).toHaveCount(2)
    await expect(story.locator('.story-flow__steps')).toHaveCount(2)
    await expect(story.locator('.story-flow__label')).toHaveCount(2)
    await expect(story.locator('.story-panel')).toHaveCount(8)
    await expect(story.locator('.story-panel__scene')).toHaveCount(8)
    await expect(story.locator('.story-panel__artwork-frame')).toHaveCount(8)
    await expect(story.locator('.story-panel__artwork')).toHaveCount(8)
    await expect(story.locator('.story-panel__path')).toHaveCount(0)
    await expect(story.locator('.story-vignette')).toHaveCount(0)

    const layout = await story.evaluate((section) => {
      const columns = (selector: string) => {
        const element = section.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing PoC layout target: ${selector}`)
        return getComputedStyle(element).gridTemplateColumns.split(' ').length
      }
      const labels = Array.from(
        section.querySelectorAll<HTMLElement>('.story-panel__title')
      ).map((element) => element.textContent?.trim())
      const flows = Array.from(
        section.querySelectorAll<HTMLElement>('.story-flow')
      )
      const flowData = flows.map((flow) => {
        const label = flow.querySelector<HTMLElement>('.story-flow__label')
        const steps = flow.querySelector<HTMLElement>('.story-flow__steps')
        if (!label || !steps) throw new Error('Missing storyboard flow targets')
        const labelBounds = label.getBoundingClientRect()
        const labelStyle = getComputedStyle(label)
        return {
          columns:
            getComputedStyle(steps).gridTemplateColumns.split(' ').length,
          label: label.textContent?.trim(),
          labelVisible:
            labelBounds.width > 1 &&
            labelBounds.height > 1 &&
            labelStyle.visibility !== 'hidden',
          stepCount: flow.querySelectorAll('.story-panel').length,
          titles: Array.from(
            flow.querySelectorAll<HTMLElement>('.story-panel__title')
          ).map((element) => element.textContent?.trim())
        }
      })
      const smallestPanelWidth = Math.min(
        ...Array.from(
          section.querySelectorAll<HTMLElement>('.story-panel')
        ).map((element) => element.getBoundingClientRect().width)
      )
      const proofImageWidths = Array.from(
        document.querySelectorAll<HTMLElement>('.proof-image')
      )
        .map((element) => element.getBoundingClientRect().width)
        .sort((first, second) => first - second)
      const medianProofImageWidth =
        proofImageWidths[Math.floor(proofImageWidths.length / 2)]
      if (!medianProofImageWidth) {
        throw new Error('Missing proof image scale reference')
      }
      const everyFlowOwnsFourSteps = flowData.every(
        (flow) => flow.stepCount === 4
      )
      const everyPathTitleIsAboveOwnArtwork = Array.from(
        section.querySelectorAll<HTMLElement>('.story-panel')
      ).every((panel) => {
        const title = panel.querySelector<HTMLElement>('.story-panel__title')
        const scene = panel.querySelector<HTMLElement>('.story-panel__scene')
        const stage = panel.querySelector<HTMLElement>('.story-panel__stage')
        const image = scene?.querySelector<HTMLElement>('.story-panel__artwork')
        const stageHeader = stage?.closest<HTMLElement>('.story-panel__header')
        const stageIsVisible = Boolean(
          stageHeader && getComputedStyle(stageHeader).display !== 'none'
        )
        return Boolean(
          title &&
          scene &&
          stage &&
          image &&
          scene.tagName === 'FIGURE' &&
          title.closest('figcaption') &&
          (!stageIsVisible ||
            stage.getBoundingClientRect().bottom <=
              title.getBoundingClientRect().top) &&
          title.getBoundingClientRect().bottom <=
            image.getBoundingClientRect().top
        )
      })
      const everyStageNumberIsLeftAligned = Array.from(
        section.querySelectorAll<HTMLElement>('.story-panel')
      ).every((panel) => {
        const stage = panel.querySelector<HTMLElement>('.story-panel__stage')
        const header = stage?.closest<HTMLElement>('.story-panel__header')
        return Boolean(
          stage &&
          header &&
          (getComputedStyle(header).display === 'none' ||
            Math.abs(
              stage.getBoundingClientRect().left -
                panel.getBoundingClientRect().left
            ) <= 5)
        )
      })
      const artwork = Array.from(
        section.querySelectorAll<HTMLImageElement>('.story-panel__artwork')
      )
      const everyArtworkLoaded = artwork.every(
        (image) => image.complete && image.naturalWidth >= 350
      )
      const everyArtworkUsesApprovedCrops = artwork.every((image) => {
        const path = new URL(image.currentSrc || image.src).pathname
        const isApprovedSplitCrop =
          /\/illustrations\/poc-storyboard-stage-\d{2}-(?:traditional|asyra)\.png$/.test(
            path
          )
        const expectedHeight = path.endsWith('-traditional.png') ? 225 : 217
        const expectedWidth = path.includes('stage-02') ? 376 : 374
        return (
          isApprovedSplitCrop &&
          image.naturalHeight === expectedHeight &&
          image.naturalWidth === expectedWidth
        )
      })
      const everyArtworkUsesUniformCssBorder = artwork.every((image) => {
        const frame = image.closest<HTMLElement>('.story-panel__artwork-frame')
        if (!frame) return false
        const style = getComputedStyle(frame)
        const widths = [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth
        ]
        const styles = [
          style.borderTopStyle,
          style.borderRightStyle,
          style.borderBottomStyle,
          style.borderLeftStyle
        ]
        const colors = [
          style.borderTopColor,
          style.borderRightColor,
          style.borderBottomColor,
          style.borderLeftColor
        ]
        return (
          style.boxSizing === 'border-box' &&
          widths.every((width) => width === '2px') &&
          styles.every((borderStyle) => borderStyle === 'solid') &&
          new Set(colors).size === 1
        )
      })
      const everyArtworkFitsCssFrame = artwork.every((image) => {
        const frame = image.closest<HTMLElement>('.story-panel__artwork-frame')
        if (!frame || getComputedStyle(frame).overflow !== 'hidden') {
          return false
        }
        const frameBounds = frame.getBoundingClientRect()
        const imageBounds = image.getBoundingClientRect()
        return (
          imageBounds.top >= frameBounds.top &&
          imageBounds.right <= frameBounds.right &&
          imageBounds.bottom <= frameBounds.bottom &&
          imageBounds.left >= frameBounds.left &&
          imageBounds.top - frameBounds.top <= 2 &&
          frameBounds.right - imageBounds.right <= 2 &&
          frameBounds.bottom - imageBounds.bottom <= 2 &&
          imageBounds.left - frameBounds.left <= 2
        )
      })
      const headline = section.querySelector<HTMLElement>('h2')
      const summaryLead = section.querySelector<HTMLElement>(
        '.poc-story__summary strong'
      )
      if (!headline || !summaryLead) {
        throw new Error('Missing PoC story heading targets')
      }
      const headlineRange = document.createRange()
      headlineRange.selectNodeContents(headline)
      const headlineLines = Array.from(headlineRange.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0
      ).length
      const sectionBounds = section.getBoundingClientRect()
      const inner = section.querySelector<HTMLElement>('.poc-story__inner')
      const panels = section.querySelector<HTMLElement>('.story-panels')
      const governance = section.querySelector<HTMLElement>(
        '.poc-story__governance'
      )
      const firstScene = section.querySelector<HTMLElement>(
        '.story-panel__scene'
      )
      if (!inner || !panels || !governance || !firstScene) {
        throw new Error('Missing ordered storyboard composition targets')
      }
      const innerBounds = inner.getBoundingClientRect()
      const innerContentLeft =
        innerBounds.left +
        Number.parseFloat(getComputedStyle(inner).paddingLeft)
      const innerContentRight =
        innerBounds.right -
        Number.parseFloat(getComputedStyle(inner).paddingRight)
      const innerContentCenter = (innerContentLeft + innerContentRight) / 2
      const panelsBounds = panels.getBoundingClientRect()
      const governanceBounds = governance.getBoundingClientRect()
      const flowBounds = flows.map((flow) => flow.getBoundingClientRect())
      const legend = section.querySelector<HTMLElement>('.poc-story__legend')
      const traditionalLegend = section.querySelector<HTMLElement>(
        '.poc-story__legend-item--traditional'
      )
      const asyraLegend = section.querySelector<HTMLElement>(
        '.poc-story__legend-item--asyra'
      )
      const traditionalSwatch = section.querySelector<HTMLElement>(
        '.poc-story__legend-swatch--traditional'
      )
      if (!legend || !traditionalLegend || !asyraLegend || !traditionalSwatch) {
        throw new Error('Missing PoC path legend targets')
      }
      const legendBounds = legend.getBoundingClientRect()
      const legendVisible =
        legendBounds.width > 0 &&
        legendBounds.height > 0 &&
        getComputedStyle(legend).display !== 'none'
      const traditionalSignalColor =
        getComputedStyle(traditionalSwatch).backgroundColor
      const stageNumbersUseNeutralColor = Array.from(
        section.querySelectorAll<HTMLElement>('.story-panel__stage')
      ).every(
        (stage) => getComputedStyle(stage).color !== traditionalSignalColor
      )
      const wordCount = (section.textContent ?? '').trim().split(/\s+/).length
      return {
        headingColumns: columns('.poc-story__heading'),
        headlineSummaryTopDifference: Math.abs(
          headline.getBoundingClientRect().top -
            summaryLead.getBoundingClientRect().top
        ),
        headlineLines,
        labels,
        flowColumns: flowData.map((flow) => flow.columns),
        flowLabels: flowData.map((flow) => flow.label),
        flowLabelsVisible: flowData.every((flow) => flow.labelVisible),
        flowLeftDifference: Math.max(
          ...flowBounds.map((flow) => Math.abs(flow.left - innerContentLeft))
        ),
        flowOrderIsTraditionalThenAsyra:
          flowData[0]?.label === 'Traditional' &&
          flowData[1]?.label === 'With Asyra',
        flowTitles: flowData.map((flow) => flow.titles),
        flowsAreVerticallyOrdered:
          flowBounds.length === 2 && flowBounds[0].bottom <= flowBounds[1].top,
        sectionWidth: sectionBounds.width,
        everyArtworkLoaded,
        everyArtworkFitsCssFrame,
        everyArtworkUsesApprovedCrops,
        everyArtworkUsesUniformCssBorder,
        everyFlowOwnsFourSteps,
        everyPathTitleIsAboveOwnArtwork,
        everyStageNumberIsLeftAligned,
        governanceLeftDifference: Math.abs(
          panelsBounds.left - governanceBounds.left
        ),
        governanceTopGap: governanceBounds.top - panelsBounds.bottom,
        governanceInsidePanels: panels.contains(governance),
        legendBeforePanels: legendBounds.bottom <= panelsBounds.top,
        legendOrderIsTraditionalThenAsyra: Boolean(
          traditionalLegend.compareDocumentPosition(asyraLegend) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        legendVisible,
        panelToProofImageWidthRatio: smallestPanelWidth / medianProofImageWidth,
        panelLeftDifference: Math.max(
          ...flows.map((flow) => {
            const firstPanel = flow.querySelector<HTMLElement>('.story-panel')
            if (!firstPanel) throw new Error('Missing first storyboard panel')
            return Math.abs(
              firstPanel.getBoundingClientRect().left - innerContentLeft
            )
          })
        ),
        panelCenterDifference: Math.max(
          ...flows.map((flow) => {
            const firstPanel = flow.querySelector<HTMLElement>('.story-panel')
            if (!firstPanel) throw new Error('Missing first storyboard panel')
            const panelBounds = firstPanel.getBoundingClientRect()
            return Math.abs(
              panelBounds.left + panelBounds.width / 2 - innerContentCenter
            )
          })
        ),
        smallestPanelWidth,
        sceneBackground: getComputedStyle(firstScene).backgroundColor,
        stageNumbersUseNeutralColor,
        wordCount
      }
    })

    expect(layout.headingColumns).toBe(profile.headingColumns)
    if (profile.headingColumns === 2) {
      expect(layout.headlineSummaryTopDifference).toBeLessThanOrEqual(1)
    }
    expect(layout.headlineLines).toBeLessThanOrEqual(
      profile.maximumHeadlineLines
    )
    expect(layout.flowColumns).toEqual([
      profile.flowStepColumns,
      profile.flowStepColumns
    ])
    expect(layout.sectionWidth).toBeLessThanOrEqual(profile.width + 1)
    expect(layout.everyFlowOwnsFourSteps).toBe(true)
    expect(layout.everyArtworkLoaded).toBe(true)
    expect(layout.everyArtworkFitsCssFrame).toBe(true)
    expect(layout.everyArtworkUsesApprovedCrops).toBe(true)
    expect(layout.everyArtworkUsesUniformCssBorder).toBe(true)
    expect(layout.everyPathTitleIsAboveOwnArtwork).toBe(true)
    expect(layout.everyStageNumberIsLeftAligned).toBe(true)
    expect(layout.governanceLeftDifference).toBeLessThanOrEqual(1)
    expect(layout.governanceTopGap).toBeGreaterThanOrEqual(8)
    expect(layout.governanceInsidePanels).toBe(false)
    expect(layout.legendBeforePanels).toBe(true)
    expect(layout.legendOrderIsTraditionalThenAsyra).toBe(true)
    expect(layout.legendVisible).toBe(!profile.flowLabelsVisible)
    expect(layout.flowLabels).toEqual(['Traditional', 'With Asyra'])
    expect(layout.flowLabelsVisible).toBe(profile.flowLabelsVisible)
    expect(layout.flowOrderIsTraditionalThenAsyra).toBe(true)
    expect(layout.flowsAreVerticallyOrdered).toBe(true)
    expect(layout.flowLeftDifference).toBeLessThanOrEqual(1)
    if (profile.width <= 680) {
      expect(layout.panelCenterDifference).toBeLessThanOrEqual(1)
    } else {
      expect(layout.panelLeftDifference).toBeLessThanOrEqual(1)
    }
    expect(layout.flowTitles).toEqual([
      ['Domain idea', 'Disposable PoC', 'Handoff', 'Rebuild'],
      ['Domain + AI', 'Real Feature', 'Engineer review', 'Product']
    ])
    expect(layout.stageNumbersUseNeutralColor).toBe(true)
    expect(layout.sceneBackground).not.toBe('rgb(0, 0, 0)')
    expect(layout.wordCount).toBeLessThanOrEqual(80)
    expect(layout.smallestPanelWidth).toBeGreaterThanOrEqual(
      profile.minimumPanelWidth
    )
    if (profile.width <= 680) {
      expect(layout.panelToProofImageWidthRatio).toBeGreaterThanOrEqual(0.9)
      expect(layout.panelToProofImageWidthRatio).toBeLessThanOrEqual(1.1)
    }
    expect(layout.labels).toEqual([
      'Domain idea',
      'Disposable PoC',
      'Handoff',
      'Rebuild',
      'Domain + AI',
      'Real Feature',
      'Engineer review',
      'Product'
    ])
    await assertNoHorizontalOverflow(page)
    await story.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`poc-story-${profile.width}.png`)
    })
  }
})

test('the Landing Framework value story isolates change cost from the proof sections below it', async ({
  page
}, testInfo) => {
  const profiles = [
    { comparisonColumns: 2, headingColumns: 2, width: 2520 },
    { comparisonColumns: 2, headingColumns: 2, width: 1920 },
    { comparisonColumns: 2, headingColumns: 2, width: 1440 },
    { comparisonColumns: 2, headingColumns: 2, width: 1024 },
    { comparisonColumns: 2, headingColumns: 2, width: 901 },
    { comparisonColumns: 2, headingColumns: 1, width: 900 },
    { comparisonColumns: 2, headingColumns: 1, width: 820 },
    { comparisonColumns: 2, headingColumns: 1, width: 681 },
    { comparisonColumns: 1, headingColumns: 1, width: 680 },
    { comparisonColumns: 1, headingColumns: 1, width: 520 },
    { comparisonColumns: 1, headingColumns: 1, width: 390 },
    { comparisonColumns: 1, headingColumns: 1, width: 320 }
  ]

  for (const profile of profiles) {
    await page.setViewportSize({ width: profile.width, height: 1000 })
    await loadLanding(page)

    const section = page.locator('#framework-value')
    await expect(section).toBeVisible()
    await expect(
      section.getByRole('heading', {
        level: 2,
        name: 'One feature request. One place to change.'
      })
    ).toBeVisible()
    await expect(
      section.getByRole('heading', {
        level: 3,
        name: 'One request, many edits'
      })
    ).toBeVisible()
    await expect(
      section.getByRole('heading', {
        level: 3,
        name: 'One request, one bounded change'
      })
    ).toBeVisible()
    await expect(
      section.locator('.framework-value__repeat-list li')
    ).toHaveCount(5)
    await expect(
      section.locator('.framework-value__shared-list li')
    ).toHaveCount(5)
    await expect(section.locator('.framework-value__outcome')).toHaveCount(0)

    const layout = await section.evaluate((element) => {
      const comparison = element.querySelector<HTMLElement>(
        '.framework-value__comparison'
      )
      const accents = Array.from(
        element.querySelectorAll<HTMLElement>('.framework-value__accent')
      )
      const traditional = element.querySelector<HTMLElement>(
        '.framework-value__path--traditional'
      )
      const asyra = element.querySelector<HTMLElement>(
        '.framework-value__path--asyra'
      )
      const lead = element.querySelector<HTMLElement>(
        '.framework-value__heading > p'
      )
      const heading = element.querySelector<HTMLElement>(
        '.framework-value__heading'
      )
      const headingTitle = element.querySelector<HTMLElement>(
        '.framework-value__heading h2'
      )
      const traditionalTitle = traditional?.querySelector<HTMLElement>('h3')
      const asyraTitle = asyra?.querySelector<HTMLElement>('h3')
      const traditionalDescription =
        traditional?.querySelector<HTMLElement>('header > span')
      const asyraDescription =
        asyra?.querySelector<HTMLElement>('header > span')
      const traditionalFlow = traditional?.querySelector<HTMLElement>(
        '.framework-value__flow'
      )
      const asyraFlow = asyra?.querySelector<HTMLElement>(
        '.framework-value__flow'
      )
      const firstItem = element.querySelector<HTMLElement>(
        '.framework-value__repeat-list li'
      )
      if (
        !comparison ||
        accents.length !== 2 ||
        !traditional ||
        !asyra ||
        !heading ||
        !headingTitle ||
        !lead ||
        !traditionalTitle ||
        !asyraTitle ||
        !traditionalDescription ||
        !asyraDescription ||
        !traditionalFlow ||
        !asyraFlow ||
        !firstItem
      ) {
        throw new Error('Missing Framework value story targets')
      }
      const headingTitleRect = headingTitle.getBoundingClientRect()
      const leadRect = lead.getBoundingClientRect()
      const accentRects = accents.map((accent) => {
        const accentRect = accent.getBoundingClientRect()
        const pathRect = accent.parentElement?.getBoundingClientRect()
        if (!pathRect) {
          throw new Error('Missing Framework value story accent owner')
        }
        return {
          bottomInset: pathRect.bottom - accentRect.bottom,
          display: getComputedStyle(accent).display,
          height: accentRect.height,
          leftInset: accentRect.left - pathRect.left,
          rightInset: pathRect.right - accentRect.right,
          topInset: accentRect.top - pathRect.top,
          width: accentRect.width
        }
      })
      return {
        accentRects,
        asyraFollowsTraditional: Boolean(
          traditional.compareDocumentPosition(asyra) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
        bodyFontSize: Number.parseFloat(getComputedStyle(lead).fontSize),
        comparisonColumns:
          getComputedStyle(comparison).gridTemplateColumns.split(' ').length,
        descriptionTopDelta: Math.abs(
          traditionalDescription.getBoundingClientRect().top -
            asyraDescription.getBoundingClientRect().top
        ),
        flowTopDelta: Math.abs(
          traditionalFlow.getBoundingClientRect().top -
            asyraFlow.getBoundingClientRect().top
        ),
        headingColumns:
          getComputedStyle(heading).gridTemplateColumns.split(' ').length,
        headingLeadBottomDelta: Math.abs(
          headingTitleRect.bottom - leadRect.bottom
        ),
        headingLeadLeftDelta: Math.abs(
          asyra.getBoundingClientRect().left - leadRect.left
        ),
        headingLeadFollowsTitle: leadRect.top >= headingTitleRect.bottom,
        itemFontSize: Number.parseFloat(getComputedStyle(firstItem).fontSize),
        sectionWidth: element.getBoundingClientRect().width,
        titleTopDelta: Math.abs(
          traditionalTitle.getBoundingClientRect().top -
            asyraTitle.getBoundingClientRect().top
        ),
        wordCount: (element.textContent ?? '').trim().split(/\s+/).length
      }
    })

    expect(layout.comparisonColumns).toBe(profile.comparisonColumns)
    expect(layout.headingColumns).toBe(profile.headingColumns)
    expect(layout.asyraFollowsTraditional).toBe(true)
    expect(layout.bodyFontSize).toBeGreaterThanOrEqual(15)
    expect(layout.itemFontSize).toBeGreaterThanOrEqual(12)
    expect(layout.sectionWidth).toBeLessThanOrEqual(profile.width + 1)
    expect(layout.wordCount).toBeLessThanOrEqual(105)
    expect(layout.accentRects).toHaveLength(2)
    for (const accent of layout.accentRects) {
      expect(accent.display).not.toBe('none')
      expect(accent.width).toBe(3)
      expect(accent.topInset).toBeGreaterThanOrEqual(10)
      expect(accent.bottomInset).toBeGreaterThanOrEqual(10)
      expect(
        Math.abs(accent.topInset - accent.bottomInset)
      ).toBeLessThanOrEqual(1)
    }
    expect(layout.accentRects[0]?.leftInset).toBeLessThanOrEqual(20)
    expect(layout.accentRects[0]?.rightInset).toBeGreaterThan(
      layout.accentRects[0]?.leftInset ?? 0
    )
    if (profile.headingColumns === 2) {
      expect(layout.headingLeadBottomDelta).toBeLessThanOrEqual(2)
      expect(layout.headingLeadLeftDelta).toBeLessThanOrEqual(2)
    } else {
      expect(layout.headingLeadFollowsTitle).toBe(true)
    }
    if (profile.comparisonColumns === 2) {
      expect(layout.accentRects[1]?.rightInset).toBeLessThanOrEqual(20)
      expect(layout.accentRects[1]?.leftInset).toBeGreaterThan(
        layout.accentRects[1]?.rightInset ?? 0
      )
      expect(
        Math.abs(
          (layout.accentRects[0]?.leftInset ?? 0) -
            (layout.accentRects[1]?.rightInset ?? 0)
        )
      ).toBeLessThanOrEqual(0.5)
      expect(
        Math.abs(
          (layout.accentRects[0]?.height ?? 0) -
            (layout.accentRects[1]?.height ?? 0)
        )
      ).toBeLessThanOrEqual(0.01)
      expect(layout.titleTopDelta).toBeLessThanOrEqual(2)
      expect(layout.descriptionTopDelta).toBeLessThanOrEqual(2)
      expect(layout.flowTopDelta).toBeLessThanOrEqual(2)
    } else {
      expect(layout.accentRects[1]?.leftInset).toBeLessThanOrEqual(20)
      expect(layout.accentRects[1]?.rightInset).toBeGreaterThan(
        layout.accentRects[1]?.leftInset ?? 0
      )
      expect(
        Math.abs(
          (layout.accentRects[0]?.leftInset ?? 0) -
            (layout.accentRects[1]?.leftInset ?? 0)
        )
      ).toBeLessThanOrEqual(0.5)
    }
    await assertNoHorizontalOverflow(page)
    await section.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`framework-value-${profile.width}.png`)
    })
  }
})

test('product, code, ownership, and readiness evidence reflow without drift', async ({
  page
}, testInfo) => {
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)
    await assertNoHorizontalOverflow(page)

    const layout = await page.evaluate(() => {
      const columns = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing evidence target: ${selector}`)
        return getComputedStyle(element).gridTemplateColumns.split(' ').length
      }
      const sections = [
        '.product-evidence',
        '.feature-evidence',
        '.landing-ownership',
        '.readiness'
      ].map((selector) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing evidence section: ${selector}`)
        const bounds = element.getBoundingClientRect()
        return { bottom: bounds.bottom, selector, top: bounds.top }
      })
      const productImage = document.querySelector<HTMLImageElement>(
        '.product-evidence__frame img'
      )
      if (!productImage) throw new Error('Missing product evidence image')
      return {
        featureColumns: columns('.feature-evidence__body'),
        ownershipColumns: columns('.landing-ownership__grid'),
        productColumns: columns('.product-evidence'),
        productImageWidth: productImage.getBoundingClientRect().width,
        readinessColumns: columns('.readiness__paths'),
        sections
      }
    })

    for (let index = 1; index < layout.sections.length; index += 1) {
      expect(layout.sections[index].top).toBeGreaterThanOrEqual(
        layout.sections[index - 1].bottom - 1
      )
    }
    expect(layout.productImageWidth).toBeGreaterThan(width <= 390 ? 260 : 420)
    if (width <= 680) {
      expect(layout.productColumns).toBe(1)
      expect(layout.featureColumns).toBe(1)
      expect(layout.ownershipColumns).toBe(1)
      expect(layout.readinessColumns).toBe(1)
    } else if (width <= 900) {
      expect(layout.productColumns).toBe(1)
      expect(layout.featureColumns).toBe(1)
      expect(layout.ownershipColumns).toBe(2)
      expect(layout.readinessColumns).toBe(3)
    } else {
      expect(layout.productColumns).toBe(2)
      expect(layout.featureColumns).toBe(2)
      expect(layout.ownershipColumns).toBe(4)
      expect(layout.readinessColumns).toBe(3)
    }

    await page.locator('.product-evidence').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`product-evidence-${width}.png`)
    })
  }
})

test('constrained Landing sections share one content geometry while the centered Domain copy and full-width rail keep their own composition', async ({
  page
}) => {
  for (const width of [
    4200, 3440, 2560, 1920, 1720, 1719, 1440, 1200, 864, 820, 800, 680, 520,
    390, 320
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)

    const geometry = await page.evaluate(() => {
      const contentEdges = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing geometry target: ${selector}`)
        const bounds = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          left: bounds.left + Number.parseFloat(style.paddingLeft),
          right: bounds.right - Number.parseFloat(style.paddingRight)
        }
      }
      const constrained = [
        '.site-header',
        '.hero',
        '.poc-story__inner',
        '.proof-stack',
        '.closing',
        '.site-footer'
      ].map((selector) => ({ selector, ...contentEdges(selector) }))
      const reference = constrained.find(
        ({ selector }) => selector === '.poc-story__inner'
      )
      if (!reference) throw new Error('Missing shared geometry reference')
      const domainSection = document.querySelector<HTMLElement>('.domains')
      const domainHeading =
        document.querySelector<HTMLElement>('.domains__heading')
      const domainRail = document.querySelector<HTMLElement>('.domains__rail')
      if (!domainSection || !domainHeading || !domainRail) {
        throw new Error('Missing Domain composition target')
      }
      const domainBounds = domainSection.getBoundingClientRect()
      const domainHeadingBounds = domainHeading.getBoundingClientRect()
      const domainRailBounds = domainRail.getBoundingClientRect()
      const railRows = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.domain-rail, .domain-rail__second'
        )
      )
        .filter((element) => {
          const bounds = element.getBoundingClientRect()
          return (
            getComputedStyle(element).display !== 'none' && bounds.height > 0
          )
        })
        .map((element) => {
          const bounds = element.getBoundingClientRect()
          const expectedLeft = window.innerWidth >= 1720 ? reference.left : 0
          const expectedRight =
            window.innerWidth >= 1720 ? reference.right : window.innerWidth
          return {
            leftDifference: Math.abs(bounds.left - expectedLeft),
            rightDifference: Math.abs(bounds.right - expectedRight)
          }
        })
      return {
        constrained: constrained.map(({ selector, left, right }) => ({
          leftDifference: Math.abs(left - reference.left),
          rightDifference: Math.abs(right - reference.right),
          selector
        })),
        pageMinWidth: Number.parseFloat(
          getComputedStyle(document.body).minWidth
        ),
        pageMaxWidth: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--page-max-width'
          )
        ),
        domainWidth: domainBounds.width,
        domainHeadingCenterDifference: Math.abs(
          domainHeadingBounds.left +
            domainHeadingBounds.width / 2 -
            (domainBounds.left + domainBounds.width / 2)
        ),
        domainHeadingWidth: domainHeadingBounds.width,
        domainRailGap: domainRailBounds.top - domainHeadingBounds.bottom,
        referenceContainerWidth: document
          .querySelector<HTMLElement>('.poc-story__inner')
          ?.getBoundingClientRect().width,
        railRows
      }
    })

    expect(geometry.pageMinWidth).toBe(320)
    expect(geometry.pageMaxWidth).toBe(1720)
    expect(geometry.domainWidth).toBeCloseTo(
      Math.min(width, geometry.pageMaxWidth),
      0
    )
    expect(
      geometry.domainHeadingCenterDifference,
      `${width}px centered Domain copy`
    ).toBeLessThanOrEqual(1)
    expect(
      geometry.domainHeadingWidth,
      `${width}px Domain copy width`
    ).toBeCloseTo(width <= 800 ? width : Math.min(width, 720), 0)
    expect(
      geometry.domainRailGap,
      `${width}px Domain copy-to-rail gap`
    ).toBeGreaterThanOrEqual(7)
    expect(
      geometry.domainRailGap,
      `${width}px Domain copy-to-rail gap`
    ).toBeLessThanOrEqual(17)
    expect(geometry.referenceContainerWidth).toBeLessThanOrEqual(1720)
    if (width >= 1720) {
      expect(geometry.referenceContainerWidth).toBe(1720)
    }
    for (const section of geometry.constrained) {
      expect(
        section.leftDifference,
        `${width}px ${section.selector} left edge`
      ).toBeLessThanOrEqual(1)
      expect(
        section.rightDifference,
        `${width}px ${section.selector} right edge`
      ).toBeLessThanOrEqual(1)
    }
    expect(geometry.railRows).toHaveLength(width <= 680 ? 2 : 1)
    for (const rail of geometry.railRows) {
      expect(
        rail.leftDifference,
        `${width}px Domain Rail left edge`
      ).toBeLessThanOrEqual(1)
      expect(
        rail.rightDifference,
        `${width}px Domain Rail right edge`
      ).toBeLessThanOrEqual(1)
    }
    await assertNoHorizontalOverflow(page)
  }
})

test('864px preserves the approved domain rail proportions and original closing composition', async ({
  page
}) => {
  await page.setViewportSize({ width: 864, height: 1000 })
  await loadLanding(page)

  const domainGeometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('.domains')
    const rail = document.querySelector<HTMLImageElement>('.domain-rail')
    if (!section || !rail) {
      throw new Error('Missing approved domain composition target')
    }
    const sectionBounds = section.getBoundingClientRect()
    const railBounds = rail.getBoundingClientRect()
    return {
      bottomClearance: sectionBounds.bottom - railBounds.bottom,
      railHeight: railBounds.height,
      railWidth: railBounds.width
    }
  })

  expect.soft(domainGeometry.railWidth).toBeGreaterThanOrEqual(863)
  expect.soft(domainGeometry.railWidth).toBeLessThanOrEqual(865)
  expect.soft(domainGeometry.railHeight).toBeGreaterThanOrEqual(110)
  expect.soft(domainGeometry.railHeight).toBeLessThanOrEqual(125)
  expect.soft(domainGeometry.bottomClearance).toBeGreaterThanOrEqual(26)
  expect.soft(domainGeometry.bottomClearance).toBeLessThanOrEqual(38)
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

test('864px preserves the accepted visual language across the evidence sequence', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 864, height: 1000 })
  await loadLanding(page)

  await expect(page.locator('.hero h1 .reference-line')).toHaveCount(2)
  await expect(page.locator('.proof')).toHaveCount(2)
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
      frameworkValue: bounds('.framework-value'),
      hero: bounds('.hero'),
      pocStory: bounds('.poc-story'),
      proofs: Array.from(document.querySelectorAll<HTMLElement>('.proof')).map(
        (proof) => Math.round(proof.getBoundingClientRect().height)
      )
    }
  })
  expect(geometry.hero.bottom).toBeGreaterThanOrEqual(455)
  expect(geometry.domains.bottom - geometry.domains.top).toBeGreaterThanOrEqual(
    275
  )
  for (const height of geometry.proofs) {
    expect(height).toBeGreaterThanOrEqual(215)
    expect(height).toBeLessThanOrEqual(250)
  }
  expect(geometry.frameworkValue.top).toBeGreaterThanOrEqual(
    geometry.domains.bottom - 1
  )
  expect(geometry.pocStory.top).toBeGreaterThanOrEqual(
    geometry.frameworkValue.bottom - 1
  )
  expect(geometry.footer.top).toBeGreaterThan(geometry.pocStory.bottom)

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

test('1440px extends the V04 visual language with product and technical evidence', async ({
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

  const heights = await page.evaluate(() => {
    const story = document.querySelector<HTMLElement>('.poc-story')
    const frameworkValue =
      document.querySelector<HTMLElement>('.framework-value')
    if (!story || !frameworkValue) {
      throw new Error('Missing landing height target')
    }
    return {
      document: document.documentElement.scrollHeight,
      frameworkValue: frameworkValue.getBoundingClientRect().height,
      pocStory: story.getBoundingClientRect().height
    }
  })
  expect(heights.pocStory).toBeGreaterThanOrEqual(800)
  expect(heights.pocStory).toBeLessThanOrEqual(860)
  expect(heights.document).toBeGreaterThanOrEqual(6500)
  expect(heights.document).toBeLessThanOrEqual(8000)
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

test('wide screens grow the proof copy area with its display typography', async ({
  page
}, testInfo) => {
  const copyWidths: number[] = []

  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 1200 })
    await loadLanding(page)
    copyWidths.push(
      await page
        .locator('.proof__copy')
        .first()
        .evaluate((element) => element.getBoundingClientRect().width)
    )
  }

  expect(copyWidths[1]).toBeGreaterThan(copyWidths[0] + 120)
  await assertUnbrokenReferenceLines(page)
  await assertNoHorizontalOverflow(page)
  await page.locator('.proof-stack').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('proof-copy-wide-1920.png')
  })
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

test('every landing image stays inside the viewport across breakpoints and interval midpoints', async ({
  page
}) => {
  for (const width of [
    1440, 1270, 1100, 1099, 1030, 960, 959, 930, 900, 899, 850, 800, 799, 783,
    767, 766, 724, 680, 679, 600, 520, 519, 455, 390, 389, 375, 360, 359, 320
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)
    await assertVisibleImagesStayInsideViewport(page)
  }
})

test('tablet single-column evidence images fill the composition without leaving the viewport', async ({
  page
}) => {
  for (const width of [680, 600, 521]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)

    const ratios = await page
      .locator(
        '.runtime-proof .proof-image--same-path, .proof-image--grow, .proof-image--one-source'
      )
      .evaluateAll((images) =>
        images.map((image) => {
          const bounds = image.getBoundingClientRect()
          return bounds.width / document.documentElement.clientWidth
        })
      )

    expect(ratios).toHaveLength(3)
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(0.72)
      expect(ratio).toBeLessThanOrEqual(0.9)
    }
    await assertVisibleImagesStayInsideViewport(page)
  }
})

test('every top-level eyebrow stays above and aligned with its section heading', async ({
  page
}) => {
  for (const width of [1440, 1100, 900, 820, 680, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)

    const headingPairs = await page
      .locator(
        '.product-evidence__copy, .poc-story__heading > div:first-child, .feature-evidence__heading, .landing-ownership > header, .proof__copy, .readiness > header'
      )
      .evaluateAll((groups) =>
        groups.map((group) => {
          const eyebrow = group.querySelector<HTMLElement>(':scope > .eyebrow')
          const heading = group.querySelector<HTMLElement>(':scope > h2')
          if (!eyebrow || !heading) {
            throw new Error('Missing top-level eyebrow or section heading')
          }
          const eyebrowBounds = eyebrow.getBoundingClientRect()
          const headingBounds = heading.getBoundingClientRect()
          return {
            eyebrowBottom: eyebrowBounds.bottom,
            eyebrowLeft: eyebrowBounds.left,
            headingLeft: headingBounds.left,
            headingTop: headingBounds.top,
            text: eyebrow.textContent?.trim() ?? ''
          }
        })
      )

    for (const pair of headingPairs) {
      expect(
        Math.abs(pair.eyebrowLeft - pair.headingLeft),
        `${width}px ${pair.text} horizontal alignment`
      ).toBeLessThanOrEqual(1)
      expect(
        pair.headingTop - pair.eyebrowBottom,
        `${width}px ${pair.text} vertical order`
      ).toBeGreaterThanOrEqual(8)
      expect(
        pair.headingTop - pair.eyebrowBottom,
        `${width}px ${pair.text} vertical rhythm`
      ).toBeLessThanOrEqual(28)
    }
  }
})

test('closing CTA keeps a compact button-to-label proportion', async ({
  page
}, testInfo) => {
  for (const viewport of [
    { height: 1000, width: 1440 },
    { height: 1000, width: 864 },
    { height: 1180, width: 820 },
    { height: 1000, width: 800 },
    { height: 900, width: 680 },
    { height: 844, width: 390 },
    { height: 720, width: 320 }
  ]) {
    await page.setViewportSize(viewport)
    await loadLanding(page)

    const metrics = await page
      .locator('.closing__button')
      .evaluate((button: HTMLElement) => {
        const bounds = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        const fontSize = Number.parseFloat(style.fontSize)
        return {
          fontSize,
          fontToHeightRatio: fontSize / bounds.height,
          height: bounds.height,
          scrollWidth: button.scrollWidth,
          width: bounds.width
        }
      })

    expect(metrics.width).toBeGreaterThanOrEqual(170)
    expect(metrics.width).toBeLessThanOrEqual(240)
    expect(metrics.height).toBeGreaterThanOrEqual(44)
    expect(metrics.height).toBeLessThanOrEqual(60)
    expect(metrics.fontSize).toBeGreaterThanOrEqual(14)
    expect(metrics.fontToHeightRatio).toBeGreaterThanOrEqual(0.24)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1)
    await page.locator('.closing').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`closing-cta-${viewport.width}.png`)
    })
  }
})

test('520px and below centers the closing composition without an empty right side', async ({
  page
}, testInfo) => {
  for (const viewport of [
    { height: 900, width: 520 },
    { height: 844, width: 390 },
    { height: 720, width: 320 }
  ]) {
    await page.setViewportSize(viewport)
    await loadLanding(page)

    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) {
          throw new Error(`Missing compact Closing target: ${selector}`)
        }
        return element.getBoundingClientRect()
      }
      const closing = bounds('.closing')
      const copy = bounds('.closing__copy')
      const core = bounds('.closing__core')
      const button = bounds('.closing__button')
      const closingElement = document.querySelector<HTMLElement>('.closing')
      const headingElement = document.querySelector<HTMLElement>('.closing h2')
      if (!closingElement || !headingElement) {
        throw new Error('Missing compact Closing or footer target')
      }
      const closingStyle = getComputedStyle(closingElement)
      const headingStyle = getComputedStyle(headingElement)
      const centerOffset = (target: DOMRect) =>
        Math.abs(
          target.left + target.width / 2 - (closing.left + closing.width / 2)
        )
      return {
        buttonCenterOffset: centerOffset(button),
        buttonWidth: button.width,
        columns: closingStyle.gridTemplateColumns.split(' ').length,
        copyCenterOffset: centerOffset(copy),
        coreCenterOffset: centerOffset(core),
        coreWidth: core.width,
        headingTextAlign: headingStyle.textAlign
      }
    })

    expect(geometry.columns).toBe(1)
    expect(geometry.copyCenterOffset).toBeLessThanOrEqual(2)
    expect(geometry.coreCenterOffset).toBeLessThanOrEqual(2)
    expect(geometry.buttonCenterOffset).toBeLessThanOrEqual(2)
    expect(geometry.headingTextAlign).toBe('center')
    expect(geometry.coreWidth).toBeGreaterThanOrEqual(130)
    expect(geometry.coreWidth).toBeLessThanOrEqual(170)
    expect(geometry.buttonWidth).toBeGreaterThanOrEqual(170)
    expect(geometry.buttonWidth).toBeLessThanOrEqual(220)

    await page.locator('.closing').screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`closing-centered-${viewport.width}.png`)
    })
  }
})

test('680px closing keeps the core centered between copy and CTA', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 680, height: 900 })
  await loadLanding(page)

  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing 680px Closing target: ${selector}`)
      return element.getBoundingClientRect()
    }
    const closing = bounds('.closing')
    const copy = bounds('.closing__copy')
    const core = bounds('.closing__core')
    const button = bounds('.closing__button')
    const closingElement = document.querySelector<HTMLElement>('.closing')
    const headingLines = Array.from(
      document.querySelectorAll<HTMLElement>('.closing h2 .reference-line')
    ).reduce((total, line) => {
      const range = document.createRange()
      range.selectNodeContents(line)
      return total + range.getClientRects().length
    }, 0)
    if (!closingElement) throw new Error('Missing 680px Closing grid')
    return {
      buttonLeft: button.left,
      closingHeight: closing.height,
      columns:
        getComputedStyle(closingElement).gridTemplateColumns.split(' ').length,
      copyRight: copy.right,
      coreCenterOffset: Math.abs(
        core.left + core.width / 2 - window.innerWidth / 2
      ),
      coreLeft: core.left,
      coreRight: core.right,
      coreWidth: core.width,
      headingLines
    }
  })

  expect(geometry.columns).toBe(3)
  expect(geometry.copyRight).toBeLessThan(geometry.coreLeft)
  expect(geometry.coreRight).toBeLessThan(geometry.buttonLeft)
  expect(geometry.coreCenterOffset).toBeLessThanOrEqual(2)
  expect(geometry.coreWidth).toBeGreaterThanOrEqual(140)
  expect(geometry.closingHeight).toBeLessThanOrEqual(210)
  expect(geometry.headingLines).toBe(2)

  await page.locator('.closing').screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('closing-balanced-680.png')
  })
})

test('800px balances the complete compact two-column composition', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 800, height: 1000 })
  await loadLanding(page)

  const metrics = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing 800px target: ${selector}`)
      return element.getBoundingClientRect()
    }
    const heroImage = bounds('.hero-core')
    const domains = bounds('.domains')
    const domainRail = bounds('.domain-rail')
    const closing = bounds('.closing')
    const frameworkValue = bounds('.framework-value')
    const pocStory = bounds('.poc-story')
    const closingElement = document.querySelector<HTMLElement>('.closing')
    const closingHeading = document.querySelector<HTMLElement>('.closing h2')
    const heroElement = document.querySelector<HTMLElement>('.hero')
    if (!closingElement || !closingHeading || !heroElement) {
      throw new Error('Missing 800px composition target')
    }
    return {
      closing: {
        columns:
          getComputedStyle(closingElement).gridTemplateColumns.split(' ')
            .length,
        headingFontSize: Number.parseFloat(
          getComputedStyle(closingHeading).fontSize
        ),
        height: closing.height
      },
      documentHeight: document.documentElement.scrollHeight,
      frameworkValueHeight: frameworkValue.height,
      domains: {
        centerOffset: Math.abs(
          domainRail.left + domainRail.width / 2 - window.innerWidth / 2
        ),
        height: domains.height,
        railWidthRatio: domainRail.width / window.innerWidth
      },
      hero: {
        columns:
          getComputedStyle(heroElement).gridTemplateColumns.split(' ').length,
        imageWidthRatio: heroImage.width / window.innerWidth
      },
      pocStoryHeight: pocStory.height,
      proofs: Array.from(document.querySelectorAll<HTMLElement>('.proof')).map(
        (proof) => {
          const image = proof.querySelector<HTMLImageElement>('img')
          if (!image) throw new Error('Missing 800px Proof image')
          return {
            columns:
              getComputedStyle(proof).gridTemplateColumns.split(' ').length,
            height: proof.getBoundingClientRect().height,
            imageWidthRatio:
              image.getBoundingClientRect().width / window.innerWidth
          }
        }
      )
    }
  })

  expect(metrics.hero.columns).toBe(2)
  expect(metrics.hero.imageWidthRatio).toBeGreaterThanOrEqual(0.34)
  expect(metrics.hero.imageWidthRatio).toBeLessThanOrEqual(0.44)
  expect(metrics.pocStoryHeight).toBeGreaterThanOrEqual(1340)
  expect(metrics.pocStoryHeight).toBeLessThanOrEqual(1420)
  expect(
    metrics.documentHeight -
      metrics.pocStoryHeight -
      metrics.frameworkValueHeight
  ).toBeLessThanOrEqual(2600)
  expect(metrics.domains.centerOffset).toBeLessThanOrEqual(2)
  expect(metrics.domains.height).toBeLessThanOrEqual(390)
  expect(metrics.domains.railWidthRatio).toBeGreaterThanOrEqual(0.995)
  expect(metrics.domains.railWidthRatio).toBeLessThanOrEqual(1.005)
  for (const proof of metrics.proofs) {
    expect(proof.columns).toBe(2)
    expect(proof.height).toBeLessThanOrEqual(420)
    expect(proof.imageWidthRatio).toBeGreaterThanOrEqual(0.38)
    expect(proof.imageWidthRatio).toBeLessThanOrEqual(0.55)
  }
  expect(metrics.closing.columns).toBe(3)
  expect(metrics.closing.headingFontSize).toBeGreaterThanOrEqual(30)
  expect(metrics.closing.headingFontSize).toBeLessThanOrEqual(36)
  expect(metrics.closing.height).toBeLessThanOrEqual(210)
  await assertNoHorizontalOverflow(page)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('landing-balanced-800.png')
  })
})

test('domain rail stays connected to both viewport edges below the page maximum', async ({
  page
}) => {
  for (const width of [1719, 1440, 864, 820, 800, 797, 701, 700]) {
    await page.setViewportSize({ width, height: 900 })
    await loadLanding(page)

    const geometry = await page.evaluate(() => {
      const rail = document.querySelector<HTMLImageElement>('.domain-rail')
      const viewport = document.querySelector<HTMLElement>('.domains__rail')
      if (!rail || !viewport) throw new Error('Missing Domain rail target')
      const bounds = rail.getBoundingClientRect()
      return {
        left: bounds.left,
        right: bounds.right,
        scrollWidth: viewport.scrollWidth,
        viewportClientWidth: viewport.clientWidth,
        viewportWidth: window.innerWidth,
        width: bounds.width
      }
    })

    expect(
      Math.abs(geometry.left),
      `${width}px Domain rail left edge`
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(geometry.right - geometry.viewportWidth),
      `${width}px Domain rail right edge`
    ).toBeLessThanOrEqual(1)
    expect(geometry.width, `${width}px Domain rail width`).toBeCloseTo(
      geometry.viewportWidth,
      0
    )
    expect(
      geometry.scrollWidth,
      `${width}px Domain rail horizontal scroll`
    ).toBeLessThanOrEqual(geometry.viewportClientWidth + 1)
  }
})

test('680px and below splits the domain rail into two edge-connected rows', async ({
  page
}) => {
  for (const width of [680, 640, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await loadLanding(page)

    const geometry = await page.evaluate(() => {
      const rail = document.querySelector<HTMLImageElement>('.domain-rail')
      const second = document.querySelector<HTMLElement>('.domain-rail__second')
      const viewport = document.querySelector<HTMLElement>('.domains__rail')
      if (!rail || !second || !viewport) {
        throw new Error('Missing split Domain rail target')
      }
      const railBounds = rail.getBoundingClientRect()
      const secondBounds = second.getBoundingClientRect()
      const viewportBounds = viewport.getBoundingClientRect()
      return {
        firstLeft: railBounds.left,
        firstRowHeight: railBounds.height,
        firstSource: rail.currentSrc,
        firstWidth: railBounds.width,
        secondDisplay: getComputedStyle(second).display,
        secondLeft: secondBounds.left,
        secondRowHeight: secondBounds.height,
        secondSource:
          second instanceof HTMLImageElement ? second.currentSrc : '',
        secondWidth: secondBounds.width,
        viewportHeight: viewportBounds.height,
        viewportWidth: window.innerWidth
      }
    })

    expect(geometry.secondDisplay).not.toBe('none')
    expect(geometry.firstSource).toMatch(
      /domain-rail-v08-desktop-photoroom-row-1-(?:800|1200)\.webp$/
    )
    expect(geometry.secondSource).toMatch(
      /domain-rail-v08-desktop-photoroom-row-2-(?:800|1200)\.webp$/
    )
    expect(Math.abs(geometry.firstLeft)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.secondLeft)).toBeLessThanOrEqual(1)
    expect(geometry.firstWidth).toBeCloseTo(width, 0)
    expect(geometry.secondWidth).toBeCloseTo(width, 0)
    expect(geometry.firstRowHeight).toBeGreaterThanOrEqual(width * 0.26)
    expect(geometry.secondRowHeight).toBeCloseTo(geometry.firstRowHeight, 0)
    expect(geometry.viewportHeight).toBeGreaterThanOrEqual(
      geometry.firstRowHeight + geometry.secondRowHeight
    )
  }
})

test('700px through 800px keeps compact columns without collisions', async ({
  page
}, testInfo) => {
  for (const width of [800, 797, 768, 720, 701, 700]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)

    if (width >= 768) {
      await expect(page.locator('.primary-nav')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Open navigation' })
      ).toBeHidden()
    } else {
      await expect(page.locator('.primary-nav')).toBeHidden()
      await expect(
        page.getByRole('button', { name: 'Open navigation' })
      ).toBeVisible()
    }
    await assertNoHorizontalOverflow(page)
    await assertCompactTwoColumnFlow(page)
    await assertSourceImageDensity(page)
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: testInfo.outputPath(`landing-transition-${width}.png`)
    })
  }
})

test('680px through 320px preserves balanced mobile flow', async ({
  page
}, testInfo) => {
  const profiles = [
    {
      contract: {
        maxHeroImageWidthRatio: 0.54,
        maxImageWidthRatio: 0.58,
        maxInlineInset: 32,
        maxSectionPadding: 44,
        minCopyWidthRatio: 0.85,
        minHeroImageWidthRatio: 0.46,
        minImageWidthRatio: 0.46
      },
      width: 680
    },
    {
      contract: {
        maxHeroImageWidthRatio: 0.54,
        maxImageWidthRatio: 0.58,
        maxInlineInset: 32,
        maxSectionPadding: 44,
        minCopyWidthRatio: 0.85,
        minHeroImageWidthRatio: 0.46,
        minImageWidthRatio: 0.46
      },
      width: 640
    },
    {
      contract: {
        maxHeroImageWidthRatio: 0.54,
        maxImageWidthRatio: 0.58,
        maxInlineInset: 32,
        maxSectionPadding: 44,
        minCopyWidthRatio: 0.85,
        minHeroImageWidthRatio: 0.46,
        minImageWidthRatio: 0.46
      },
      width: 600
    },
    ...[540, 520, 480, 430, 390, 375, 360, 320].map((width) => ({
      contract: {
        maxHeroImageWidthRatio: 0.82,
        maxImageWidthRatio: 0.82,
        maxInlineInset: 32,
        maxSectionPadding: 44,
        minCopyWidthRatio: 0.85,
        minHeroImageWidthRatio: 0.5,
        minImageWidthRatio: 0.48
      },
      width
    }))
  ]

  for (const profile of profiles) {
    await page.setViewportSize({ width: profile.width, height: 900 })
    await loadLanding(page)

    await expect(page.locator('.primary-nav')).toBeHidden()
    await assertNoHorizontalOverflow(page)
    await assertResponsiveSingleColumnFlow(page, profile.contract)

    const buttonDirection = await page
      .locator('.button-row')
      .evaluate((row) => getComputedStyle(row).flexDirection)
    expect(buttonDirection, `${profile.width}px button direction`).toBe(
      profile.width <= 520 ? 'column' : 'row'
    )

    if (profile.width === 680 || profile.width === 520) {
      await page.screenshot({
        animations: 'disabled',
        fullPage: true,
        path: testInfo.outputPath(`landing-mobile-flow-${profile.width}.png`)
      })
    }
  }
})

test('content hierarchy stays balanced across desktop, tablet, and phone', async ({
  page
}) => {
  for (const width of [
    1440, 864, 820, 800, 797, 701, 700, 680, 640, 600, 540, 520, 480, 430, 390,
    375, 360, 320
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    await loadLanding(page)

    const hierarchy = await page.evaluate(() => {
      const domainHeading = document.querySelector<HTMLElement>('.domains h2')
      const domainCopy = document.querySelector<HTMLElement>(
        '.domains__heading > p'
      )
      if (!domainHeading || !domainCopy) {
        throw new Error('Missing Domain hierarchy targets')
      }
      const fontSize = (element: HTMLElement) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      const domainCopyBounds = domainCopy.getBoundingClientRect()
      return {
        domain: {
          copyFontSize: fontSize(domainCopy),
          copyWidthRatio: domainCopyBounds.width / window.innerWidth,
          headingToCopyRatio: fontSize(domainHeading) / fontSize(domainCopy)
        },
        proofs: Array.from(
          document.querySelectorAll<HTMLElement>('.proof')
        ).map((proof) => {
          const eyebrow = proof.querySelector<HTMLElement>('.eyebrow')
          const heading = proof.querySelector<HTMLElement>('h2')
          if (!eyebrow || !heading) {
            throw new Error('Missing proof hierarchy targets')
          }
          return {
            eyebrowFontSize: fontSize(eyebrow),
            headingToEyebrowRatio: fontSize(heading) / fontSize(eyebrow)
          }
        })
      }
    })

    expect(
      hierarchy.domain.copyFontSize,
      `${width}px Domain copy`
    ).toBeGreaterThanOrEqual(14)
    expect(
      hierarchy.domain.headingToCopyRatio,
      `${width}px Domain heading ratio`
    ).toBeGreaterThanOrEqual(2)
    expect(
      hierarchy.domain.headingToCopyRatio,
      `${width}px Domain heading ratio`
    ).toBeLessThanOrEqual(3.5)
    if (width <= 800) {
      expect(
        hierarchy.domain.copyWidthRatio,
        `${width}px Domain copy width`
      ).toBeGreaterThanOrEqual(0.85)
    }
    for (const proof of hierarchy.proofs) {
      expect(
        proof.eyebrowFontSize,
        `${width}px proof eyebrow`
      ).toBeGreaterThanOrEqual(11.5)
      expect(
        proof.eyebrowFontSize,
        `${width}px proof eyebrow`
      ).toBeLessThanOrEqual(13.5)
      expect(
        proof.headingToEyebrowRatio,
        `${width}px proof heading ratio`
      ).toBeGreaterThanOrEqual(2.3)
      expect(
        proof.headingToEyebrowRatio,
        `${width}px proof heading ratio`
      ).toBeLessThanOrEqual(3.6)
    }
  }
})

test('390px uses mobile crops without document overflow', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loadLanding(page)

  await expect(page.locator('.primary-nav')).toBeHidden()
  await assertLinksAndCtas(page)
  await assertSingleColumnProofs(page)
  await assertResponsiveSingleColumnFlow(page, {
    maxHeroImageWidthRatio: 0.82,
    maxImageWidthRatio: 0.82,
    maxInlineInset: 24,
    maxSectionPadding: 44,
    minCopyWidthRatio: 0.85,
    minHeroImageWidthRatio: 0.5,
    minImageWidthRatio: 0.48
  })
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
  expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth + 1)

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
  await assertResponsiveSingleColumnFlow(page, {
    maxHeroImageWidthRatio: 0.82,
    maxImageWidthRatio: 0.82,
    maxInlineInset: 24,
    maxSectionPadding: 44,
    minCopyWidthRatio: 0.85,
    minHeroImageWidthRatio: 0.5,
    minImageWidthRatio: 0.48
  })
  await assertTransparentPhotoroomAssets(page)
  await assertAdaptiveGridAndShadows(page)
  await assertSourceImageDensity(page)
  await assertModernSansTypography(page)
  await assertAiryHeadingTypography(page)
  await assertNoHorizontalOverflow(page)
  const proofHeadingLines = await page
    .locator('.proof h2')
    .evaluateAll((headings) =>
      headings.map((heading) => {
        const bounds = heading.getBoundingClientRect()
        const lineHeight = Number.parseFloat(
          getComputedStyle(heading).lineHeight
        )
        return Math.round(bounds.height / lineHeight)
      })
    )
  for (const lineCount of proofHeadingLines) {
    expect(lineCount).toBeLessThanOrEqual(5)
  }
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
  await expect(page.getByText('Prove it once. Keep what works.')).toBeVisible()
  await expect(page.locator('.poc-story__governance')).toContainText(
    'Engineering still owns production readiness'
  )
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
