import { expect, test } from '@playwright/test'

test.skip(
  Boolean(process.env.SITE_URL),
  'The development shell contract applies only to the local dev server'
)

test('development shell does not surface a Next error overlay', async ({
  page
}, testInfo) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const policy = await page
    .locator('body')
    .evaluate(() =>
      fetch(window.location.href, { method: 'HEAD' }).then((response) =>
        response.headers.get('content-security-policy')
      )
    )
  expect(policy).toContain("'unsafe-eval'")
  const errorOverlayState = await page
    .locator('nextjs-portal')
    .evaluateAll((portals) =>
      portals.map((portal) => ({
        hasErrorFooter: Boolean(
          portal.shadowRoot?.querySelector('[data-nextjs-error-overlay-footer]')
        ),
        text: portal.shadowRoot?.textContent ?? ''
      }))
    )
  expect(errorOverlayState).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ hasErrorFooter: true })])
  )
  expect(errorOverlayState.map(({ text }) => text).join(' ')).not.toMatch(
    /\b1 Issue\b/i
  )
  expect(browserErrors.join('\n')).not.toContain(
    'eval() is not supported in this environment'
  )

  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath('development-shell-without-error-overlay.png')
  })
})
