import { expect, test } from '@playwright/test'

test('mechanical main bodies remain articulated during playback with bounded frame stalls', async ({
  page
}, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(page.getByLabel('Candidate', { exact: true })).toHaveValue(/.+/)
  await page.getByLabel('Wireframe', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Experiments', exact: true }).click()
  const play = page.getByRole('button', {
    name: 'Play trajectory',
    exact: true
  })
  await expect(play).toBeInViewport()
  await page.screenshot({ path: info.outputPath('mechanical-overview.png') })
  await play.click()
  const deltas = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = []
        let previous = 0,
          warmup = 15
        const frame = (now: number) => {
          if (previous && warmup-- <= 0) samples.push(now - previous)
          previous = now
          if (samples.length === 90) resolve(samples)
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      })
  )
  await page
    .getByRole('button', { name: 'Pause trajectory', exact: true })
    .click()
  const sorted = [...deltas].sort((a, b) => a - b)
  const metrics = {
    medianMs: sorted[45],
    p95Ms: sorted[85],
    maxMs: sorted[89],
    frames: deltas.length
  }
  await info.attach('frame-timing.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      ...metrics,
      baseURL: info.project.use.baseURL,
      viewport: page.viewportSize(),
      state:
        'complete original mechanical parts, wireframe off, saved trajectory playback',
      limitations:
        'Browser scheduling evidence on this host, not a universal FPS guarantee.'
    })
  })
  expect(metrics.p95Ms).toBeLessThan(100)
  const slider = page.getByLabel('Sampled trajectory preview time')
  for (const [time, key] of [
    [0, 'Home'],
    [4, null],
    [8, 'End']
  ] as const) {
    await slider.focus()
    if (key) await slider.press(key)
    else await slider.fill('4')
    await page.screenshot({
      path: info.outputPath(`mechanical-pose-${time}.png`)
    })
  }
  await page.getByRole('button', { name: 'Return to editing pose' }).click()
  await page.getByRole('button', { name: 'Reset view' }).click()
  const canvas = page.locator('canvas')
  await canvas.hover()
  // Trackpad scrolling pans; use the browser's explicit pinch-zoom signal.
  await page.keyboard.down('Control')
  try {
    await page.mouse.wheel(0, -420)
  } finally {
    await page.keyboard.up('Control')
  }
  await page.screenshot({ path: info.outputPath('mechanical-closeup.png') })
})
