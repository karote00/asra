import { expect, test } from '@playwright/test'

const names = [
  'Synthetic clearance study',
  'Shoulder reach study',
  'Elbow folding study',
  'Wrist orientation study',
  'Tool and table sweep'
]

for (const name of names) {
  test(`${name} previews and executes through the original-part method`, async ({
    page
  }, info) => {
    test.setTimeout(45_000)
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    const history = await page.getByTestId('history-depth').textContent()
    await page.getByRole('button', { name: 'Experiments', exact: true }).click()
    const picker = page.getByLabel('Experiment', { exact: true })
    await expect(picker.locator('option')).toHaveText([
      'New draft',
      ...names.map((value) => `${value} · r1`)
    ])
    await picker.selectOption({ label: `${name} · r1` })
    await expect(
      page.getByRole('button', { name: 'Save experiment', exact: true })
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Play trajectory', exact: true })
      .click()
    await expect
      .poll(async () =>
        Number(
          await page.getByLabel('Sampled trajectory preview time').inputValue()
        )
      )
      .toBeGreaterThan(0.1)
    await page
      .getByRole('button', { name: 'Pause trajectory', exact: true })
      .click()
    await page.getByLabel('Sampled trajectory preview time').press('End')
    await expect(page.locator('.viewport-summary')).toContainText('8.0000 s')
    await page.screenshot({ path: info.outputPath('study-preview.png') })
    await page
      .getByRole('button', { name: 'Run preflight', exact: true })
      .click()
    await expect(page.getByTestId('preflight-report')).toContainText(
      'Ready for formal local analysis'
    )
    await page
      .getByRole('button', { name: 'Run formal analysis', exact: true })
      .click()
    const result = page.getByTestId('analysis-result')
    await expect(result).toBeVisible({ timeout: 35_000 })
    await expect(
      result
        .locator('.result-grid > div')
        .filter({ has: page.getByText('Execution', { exact: true }) })
        .locator('dd')
    ).toHaveText('completed')
    await expect(result).toContainText('Original parts - 23,028 triangles')
    await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
    await result.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('study-result.png') })
    await info.attach('starter-study-review', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        study: name,
        viewport: page.viewportSize(),
        dpr: 1,
        camera: 'default',
        previewTime: 8,
        selection: null,
        overlays: 'default grid and experiment inspector',
        pipeline: 'normal Features / original-part Worker / CUSTOM renderer',
        result: await result.innerText(),
        screenshots: ['study-preview.png', 'study-result.png']
      })
    })
  })
}
