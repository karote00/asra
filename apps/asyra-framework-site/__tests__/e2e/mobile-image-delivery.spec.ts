import { stat } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const siteRoot = path.resolve(import.meta.dirname, '../..')

for (const width of [320, 390, 412, 520, 680, 800]) {
  test(`${width}px mobile images select a bounded sharp source on a fresh load`, async ({
    browser
  }, testInfo) => {
    // A fresh context prevents Chrome's larger-image cache from masking sizes.
    const context = await browser.newContext({
      deviceScaleFactor: 2,
      viewport: { width, height: 900 }
    })
    const page = await context.newPage()
    try {
      await page.goto('/')
      const selectors = ['.hero-core']
      if (width <= 520) {
        selectors.push(
          '.proof-image--grow',
          '.proof-image--same-path',
          '.proof-image--one-source'
        )
      }
      for (const selector of selectors) {
        const image = page.locator(selector)
        await image.scrollIntoViewIfNeeded()
        await image.evaluate((element: HTMLImageElement) => element.decode())
        const selected = await image.evaluate((element: HTMLImageElement) => ({
          pathname: new URL(element.currentSrc).pathname,
          renderedWidth: element.getBoundingClientRect().width
        }))
        const sourceWidth = Number(
          selected.pathname.match(/-(\d+)\.webp$/)?.[1]
        )
        expect(
          sourceWidth,
          `${selector} preserves Retina detail`
        ).toBeGreaterThanOrEqual(selected.renderedWidth * 2)
        // Every reviewed phone illustration fits the approved 720px source.
        expect(
          sourceWidth,
          `${selector} must not download a desktop derivative`
        ).toBe(720)
        const bytes = (
          await stat(path.join(siteRoot, 'public', selected.pathname))
        ).size
        expect(bytes, `${selector} transfer budget`).toBeLessThanOrEqual(
          350 * 1024
        )
        await testInfo.attach(`${selector}-delivery`, {
          body: JSON.stringify({
            ...selected,
            sourceWidth,
            bytes,
            viewport: width,
            dpr: 2
          }),
          contentType: 'application/json'
        })
      }
      await page.locator('.hero').screenshot({
        path: testInfo.outputPath(`hero-${width}-retina.png`),
        animations: 'disabled'
      })
    } finally {
      await context.close()
    }
  })
}
