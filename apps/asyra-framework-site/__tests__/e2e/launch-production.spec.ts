import { expect, test } from '@playwright/test'

const productionUrl = process.env.SITE_URL
const productionOrigin = productionUrl ? new URL(productionUrl).origin : ''

test.skip(!productionUrl, 'SITE_URL is required for production verification')

test('production is anonymous, canonical, searchable, and secure', async ({
  page,
  request
}) => {
  const response = await request.get('/')
  expect(response.status()).toBe(200)
  ;[
    'content-security-policy',
    'permissions-policy',
    'referrer-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options'
  ].forEach((header) => expect(response.headers()[header]).toBeTruthy())

  await page.goto('/docs')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${productionOrigin}/docs`
  )
  await page.keyboard.press('Control+k')
  const search = page.getByRole('dialog', { name: 'Search documentation' })
  await expect(search).toBeVisible()
  await search.getByRole('searchbox').fill('transaction')
  await expect(search.locator('.search-results a').first()).toBeVisible()
})

test('production explains Asyra globally and reaches its verified reference product', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      name: 'Build the model your world needs.'
    })
  ).toBeVisible()
  await expect(
    page.getByText('Framework owns reusable infrastructure.')
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open Asyra Design' })
  ).toHaveAttribute(
    'href',
    'https://asra.vercel.app/?fileId=asyra-framework-demo'
  )
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})

test('production Runtime Atlas executes canonical evidence', async ({
  page
}) => {
  await page.goto('/atlas')
  const status = page.locator('[data-atlas-status]')
  await page.locator('[data-atlas-action="run"]').click()
  await expect(status).toHaveAttribute('data-atlas-status', 'accepted', {
    timeout: 4_000
  })
})
