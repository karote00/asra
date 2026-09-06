import { expect, test } from '@playwright/test'

for (const colorScheme of ['light', 'dark'] as const) {
  test(`toolbar actions use labeled 24px icons without a development badge in ${colorScheme} mode`, async ({
    page
  }, info) => {
    await page.emulateMedia({ colorScheme })
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    for (const width of [1440, 960, 600]) {
      await page.setViewportSize({ width, height: 960 })
      const modelToggle = page.locator('button[aria-label="Model"]')
      if (width > 1100) await expect(modelToggle).toBeHidden()
      else await expect(modelToggle).toBeVisible()
      const buttons = page.locator('.topbar button, .commandbar button')
      await expect(buttons).toHaveCount(9)
      for (const button of await buttons.all()) {
        await expect(button).toHaveAttribute('aria-label', /\S/)
        await expect(button).toHaveAttribute('title', /\S/)
        expect((await button.textContent())?.trim()).toBe('')
        await expect(button.locator('svg')).toHaveCount(1)
        await expect(button.locator('svg')).toHaveAttribute(
          'aria-hidden',
          'true'
        )
        if (!(await button.isVisible())) continue
        const bounds = await button.evaluate((node) => {
          const svg = node.querySelector('svg')
          if (!svg) throw new Error('Toolbar action is missing its icon')
          const icon = svg.getBoundingClientRect()
          const target = node.getBoundingClientRect()
          return {
            icon: { width: icon.width, height: icon.height },
            target: { width: target.width, height: target.height },
            fits: target.left >= 0 && target.right <= innerWidth
          }
        })
        expect(bounds).toEqual({
          icon: { width: 24, height: 24 },
          target: { width: 36, height: 36 },
          fits: true
        })
      }
      await expect(page.locator('.topbar')).not.toContainText('DEVELOPMENT')
      await page.screenshot({ path: info.outputPath(`toolbar-${width}.png`) })
      await page.locator('.topbar').screenshot({
        path: info.outputPath(`topbar-${width}.png`)
      })
      await page.locator('.commandbar').screenshot({
        path: info.outputPath(`commandbar-${width}.png`)
      })
    }
    await info.attach('toolbar-review', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        widths: [1440, 960, 600],
        height: 960,
        dpr: 1,
        colorScheme,
        runtime: 'normal Core/Render/CUSTOM synthetic workcell',
        camera: 'default',
        selection: null,
        overlays: 'default grid; no wireframe; object inspector'
      })
    })
  })
}

test('icon actions preserve accessible focus, inspector selection and local project controls', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const history = await page.getByTestId('history-depth').textContent()
  const projects = page.getByRole('button', { name: 'Projects', exact: true })
  await projects.focus()
  await expect(projects).toBeFocused()
  await expect(projects).toHaveCSS('outline-style', 'solid')
  await projects.click()
  const dialog = page.getByRole('dialog', { name: 'Local projects' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Save project', exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Save copy', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close projects' }).click()
  await expect(projects).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Close projects' }).click()

  const experiments = page.getByRole('button', {
    name: 'Experiments',
    exact: true
  })
  await experiments.click()
  await expect(experiments).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Object', exact: true }).click()
  await expect(experiments).toHaveAttribute('aria-pressed', 'false')
  await page.setViewportSize({ width: 600, height: 960 })
  const model = page.getByRole('button', { name: 'Model', exact: true })
  await model.click()
  await expect(model).toHaveAttribute('aria-expanded', 'true')
  await model.click()
  await expect(model).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
})
