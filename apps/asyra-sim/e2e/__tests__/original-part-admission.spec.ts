import { expect, test } from '@playwright/test'

test('runs complete original parts with one geometry display and rejects surrogate methods', async ({
  page
}, info) => {
  const errors: string[] = [],
    workers: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.locator('.viewport-summary')).toContainText(
    '11 analysis parts'
  )
  page.on('worker', (worker) => workers.push(worker.url()))
  const history = await page.getByTestId('history-depth').textContent()
  await expect(page.getByLabel('Visuals', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Proxies', { exact: true })).toHaveCount(0)
  await page.getByLabel('Wireframe', { exact: true }).check()
  await page.getByLabel('Wireframe', { exact: true }).uncheck()
  await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  await page.getByRole('button', { name: 'Run preflight', exact: true }).click()
  const report = page.getByTestId('preflight-report')
  await expect(report).toContainText('Ready for formal local analysis')
  await page
    .getByRole('button', { name: 'Run formal analysis', exact: true })
    .click()
  const result = page.getByTestId('analysis-result')
  await expect(result).toBeVisible({ timeout: 20000 })
  await expect(result).toContainText('completed')
  await expect(result).toContainText('Original-part continuous clearance')
  await expect(result).not.toContainText('Historical inputs differ')
  expect(workers.length).toBe(1)
  await result.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('original-part-result.png') })
  await page
    .getByLabel('Analysis method')
    .selectOption('continuous-clearance-v0@0.1.0')
  await page
    .getByRole('button', { name: 'Save experiment', exact: true })
    .click()
  for (const wireframe of [false, true]) {
    await page.getByLabel('Wireframe', { exact: true }).setChecked(wireframe)
    await page
      .getByRole('button', { name: 'Run preflight', exact: true })
      .click()
    await expect(report).toContainText('unsupported-geometry')
    await page
      .getByRole('button', { name: 'Run formal analysis', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'does not support every selected collider'
    )
    expect(workers.length).toBe(1)
  }
  expect(errors).toEqual([])
  await info.attach('original-part-review', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      viewport: page.viewportSize(),
      dpr: 1,
      camera: 'default',
      selection: null,
      runtime:
        'normal Core/Render/CUSTOM, production Worker; installed Chrome with SwiftShader',
      screenshots: ['original-part-result.png'],
      assertion:
        'original-part method executes; display state cannot authorize a surrogate method'
    })
  })
})
