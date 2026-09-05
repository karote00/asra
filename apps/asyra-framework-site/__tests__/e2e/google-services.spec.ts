import { expect, test } from '@playwright/test'

test('Google services respect the deployment configuration and survive navigation', async ({
  page
}) => {
  const configured = process.env.GOOGLE_SERVICES_TEST_ENABLED === '1'
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const verification = process.env.GOOGLE_SITE_VERIFICATION
  if (configured) {
    expect(measurementId).toMatch(/^G-[A-Z0-9]+$/)
    expect(verification).toBeTruthy()
  }
  let libraryRequests = 0
  // Test the site's bootstrap and CSP without sending test data to Google.
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    libraryRequests += 1
    expect(route.request().url()).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    )
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await page.route('https://*.google-analytics.com/**', (route) =>
    route.abort()
  )
  await page.route('https://*.analytics.google.com/**', (route) =>
    route.abort()
  )

  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const meta = page.locator('head meta[name="google-site-verification"]')
  if (configured) {
    if (!verification) throw new Error('Missing test verification token')
    await expect(meta).toHaveAttribute('content', verification)
    await expect.poll(() => libraryRequests).toBe(1)
    const readConfig = () =>
      page.evaluate(() => {
        const analytics = window as typeof window & {
          dataLayer?: ArrayLike<unknown>[]
        }
        return (analytics.dataLayer ?? [])
          .map((entry) => Array.from(entry))
          .filter(([type]) => type === 'config')
      })
    await expect.poll(readConfig).toEqual([
      [
        'config',
        measurementId,
        {
          allow_google_signals: false,
          allow_ad_personalization_signals: false
        }
      ]
    ])
    await page
      .locator('.primary-nav')
      .getByRole('link', { name: 'Docs', exact: true })
      .click()
    await expect(page).toHaveURL(/\/docs$/)
    expect(libraryRequests).toBe(1)
    expect(await readConfig()).toHaveLength(1)
  } else {
    await expect(meta).toHaveCount(0)
    await expect(page.locator('#asyra-ga-init')).toHaveCount(0)
    await expect(page.locator('#asyra-ga-library')).toHaveCount(0)
    expect(libraryRequests).toBe(0)
  }
})
