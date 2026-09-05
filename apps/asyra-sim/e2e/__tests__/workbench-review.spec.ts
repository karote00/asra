import { expect, test } from '@playwright/test'

test('workbench controls fit desktop and narrow review panes without clipped text', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  for (const width of [1440, 960, 600]) {
    await page.setViewportSize({ width, height: 960 })
    await page.getByRole('button', { name: 'Experiments', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panels = [
            ...document.querySelectorAll<HTMLElement>(
              '.topbar, .commandbar, .properties-panel'
            )
          ]
          return panels.every((panel) => {
            const rect = panel.getBoundingClientRect()
            return (
              rect.left >= 0 &&
              rect.right <= innerWidth &&
              panel.scrollWidth <= panel.clientWidth + 1
            )
          })
        })
      )
      .toBe(true)
    const controls = page.locator('.commands button')
    for (const control of await controls.all()) {
      if (!(await control.isVisible())) continue
      const text = await control.innerText()
      expect(text).not.toMatch(/[↶↷+]/)
      expect(
        await control.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1
        )
      ).toBe(true)
    }
    await expect(page.locator('.trajectory-import')).not.toHaveAttribute(
      'open',
      ''
    )
    await page.screenshot({ path: info.outputPath(`workbench-${width}.png`) })
  }
})

test('trajectory playback advances, pauses, restarts and stops when leaving experiments without an Undo action', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const history = await page.getByTestId('history-depth').textContent()
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page
    .getByRole('button', { name: 'Play trajectory', exact: true })
    .click()
  const time = page.getByLabel('Sampled trajectory preview time')
  await expect
    .poll(async () => Number(await time.inputValue()))
    .toBeGreaterThan(0.1)
  await page
    .getByRole('button', { name: 'Pause trajectory', exact: true })
    .click()
  const paused = await time.inputValue()
  await page.waitForTimeout(150)
  await expect(time).toHaveValue(paused)
  await page
    .getByRole('button', { name: 'Restart trajectory', exact: true })
    .click()
  await expect(time).toHaveValue('0')
  await page
    .getByRole('button', { name: 'Play trajectory', exact: true })
    .click()
  await page.getByRole('button', { name: 'Object', exact: true }).click()
  await expect(page.locator('.viewport-summary')).not.toContainText(
    'Sampled preview'
  )
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Play trajectory', exact: true })
  ).toBeVisible()
  await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
  await expect(page.getByTestId('analysis-result')).toHaveCount(0)
})
