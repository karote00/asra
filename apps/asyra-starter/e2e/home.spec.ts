import { expect, test } from '@playwright/test'

test('renders the Framework identity and starting point', async ({
  page
}, testInfo) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Asyra Framework' })
  ).toBeVisible()
  await expect(page.getByAltText('Asyra Framework logo')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Read the Framework guide' })
  ).toHaveAttribute(
    'href',
    'https://github.com/karote00/asyra/blob/main/docs/ai/framework/GETTING_STARTED.md'
  )

  await page.screenshot({
    path: testInfo.outputPath('framework-home.png'),
    fullPage: true
  })
})
