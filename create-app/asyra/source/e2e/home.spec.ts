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

  const intro = page.locator('.brand__intro')
  const introLines = await intro.evaluate((element) => {
    const styles = window.getComputedStyle(element)

    return (
      element.getBoundingClientRect().height / parseFloat(styles.lineHeight)
    )
  })

  expect(introLines).toBeLessThanOrEqual(2.1)

  await page.screenshot({
    path: testInfo.outputPath('framework-home.png'),
    fullPage: true
  })
})
