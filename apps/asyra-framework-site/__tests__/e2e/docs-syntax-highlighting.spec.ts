import { expect, test } from '@playwright/test'

test('documentation TypeScript blocks use semantic syntax colors at every layout', async ({
  page
}, testInfo) => {
  const examples = [
    {
      name: 'review-record',
      route: '/docs/start/create-design-app',
      needle: 'reviewQueue',
      expected: ['type ReviewRecord', 'new Map<string, ReviewRecord>()'],
      unexpected: 'new Map<string, Readonly'
    },
    {
      name: 'migration',
      route: '/docs/build/persistence-migration',
      needle: 'const migrations',
      expected: [
        'type Migration = (document: AppDocument) => AppDocument',
        'new Map<string, Migration>'
      ],
      unexpected: 'new Map<string, (document'
    },
    {
      name: 'feature-payload',
      route: '/docs/build/feature-session',
      needle: 'ValuePayload',
      expected: ['type ValuePayload', 'type ValueUpdate']
    }
  ]

  for (const example of examples) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
      await page.goto(example.route)

      const block = page
        .locator('.markdown-code')
        .filter({ hasText: example.needle })
      await expect(block).toBeVisible()
      for (const expected of example.expected) {
        await expect(block.locator('code')).toContainText(expected)
      }
      if (example.unexpected) {
        await expect(block.locator('code')).not.toContainText(
          example.unexpected
        )
      }

      const tokenColors = await block
        .locator('code span')
        .evaluateAll((tokens) =>
          [
            ...new Set(tokens.map((token) => getComputedStyle(token).color))
          ].filter((color) => color !== 'rgba(0, 0, 0, 0)')
        )
      expect(tokenColors.length).toBeGreaterThanOrEqual(4)

      const pageWidths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
      }))
      expect(pageWidths.scroll).toBeLessThanOrEqual(pageWidths.client + 1)

      await block.screenshot({
        animations: 'disabled',
        path: testInfo.outputPath(
          `typescript-highlight-${example.name}-${width}.png`
        )
      })
    }
  }
})
