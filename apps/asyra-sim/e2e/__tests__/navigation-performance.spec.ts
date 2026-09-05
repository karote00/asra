import { expect, test } from '@playwright/test'

for (const route of ['navigation', 'playback'] as const)
  test(`profiles sustained ${route} through the ordinary workbench without model or history changes`, async ({
    page
  }, info) => {
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    const canvas = page.getByTestId('workcell-canvas').locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Missing viewport')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    if (route === 'playback')
      await page
        .getByRole('button', { name: 'Experiments', exact: true })
        .click()
    const session = await page.context().newCDPSession(page)
    await session.send('Profiler.enable')
    await session.send('Profiler.start')
    const start = Date.now()
    try {
      if (route === 'navigation') {
        for (let i = 0; i < 60; i++) await page.mouse.wheel(i < 30 ? 3 : -3, 0)
      } else {
        await page.getByRole('button', { name: 'Play trajectory' }).click()
        await expect
          .poll(async () =>
            parseFloat(await page.locator('.preview-time').innerText())
          )
          .toBeGreaterThan(1.5)
        await page.getByRole('button', { name: 'Pause trajectory' }).click()
      }
      await expect(page.getByTestId('history-depth')).toHaveText(
        'Undo steps: 2'
      )
      await expect(page.getByRole('treeitem')).toHaveCount(11)
      const { profile } = await session.send('Profiler.stop')
      const nodes = new Map(
        profile.nodes.map((node) => [node.id, node.callFrame])
      )
      const times = new Map<string, number>()
      profile.samples?.forEach((id, index) => {
        const frame = nodes.get(id)
        if (!frame || !frame.url.includes('/src/')) return
        const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('?')[0]}`
        times.set(
          key,
          (times.get(key) ?? 0) + (profile.timeDeltas?.[index] ?? 0) / 1000
        )
      })
      await info.attach(`${route}-performance`, {
        contentType: 'application/json',
        body: JSON.stringify(
          {
            url: page.url(),
            viewport: page.viewportSize(),
            canvas: box,
            route,
            wheelSamples: route === 'navigation' ? 60 : 0,
            elapsedMs: Date.now() - start,
            history: 2,
            renderer:
              'project Chrome/SwiftShader profile; not a reference-hardware FPS guarantee',
            hotFunctions: [...times].sort((a, b) => b[1] - a[1]).slice(0, 15)
          },
          null,
          2
        )
      })
      await canvas.screenshot({ path: info.outputPath(`${route}-profile.png`) })
    } finally {
      await session.detach()
    }
  })
