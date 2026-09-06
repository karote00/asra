import { expect, test } from '@playwright/test'

for (const kind of ['clearance', 'collision']) {
  test(`cold manual dragging preserves ${kind} feedback and reuses checked targets`, async ({
    page
  }, info) => {
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    await page.reload()
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    await page.getByRole('button', { name: 'Experiments', exact: true }).click()
    await page.getByLabel('Experiment', { exact: true }).selectOption({
      label: 'Tool and table collision - r1'
    })

    // Widen the clearance-only interval through the ordinary authored setting.
    if (kind === 'clearance') {
      await page.getByLabel('Minimum clearance (mm)').fill('200')
      await page
        .getByRole('button', { name: 'Save experiment', exact: true })
        .click()
    }

    const slider = page.getByLabel('Sampled trajectory preview time')
    const feedback = page.getByTestId('playback-feedback')
    const history = await page.getByTestId('history-depth').textContent()
    const bounds = await slider.boundingBox()

    if (!bounds) throw new Error('Missing manual time slider')

    const targets =
      kind === 'collision'
        ? [3.872, 3.92, 3.968, 4.016, 4.064, 3.92]
        : [3.52, 3.568, 3.616, 3.664, 3.712, 3.568]
    const sampled: number[] = []
    const drag = async (target: number) => {
      const previous = Number(await slider.inputValue())
      const x = (time: number) =>
        bounds.x + 8 + ((bounds.width - 16) * time) / 8
      const y = bounds.y + bounds.height / 2

      await page.mouse.move(x(previous), y)
      await page.mouse.down()
      await page.mouse.move(x(target), y)
      await page.mouse.up()

      const actual = Number(await slider.inputValue())
      await expect(feedback).toContainText(`Checked ${actual.toFixed(4)} s`)
      await expect(feedback).toHaveAttribute('data-kind', kind)
      await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
      sampled.push(actual)
    }

    await drag(targets[0])
    await page.evaluate(() => {
      const frames: {
        kind: string | null
        matches: string | null
        text: string
      }[] = []
      const notice = document.querySelector('[data-testid="playback-feedback"]')

      if (!notice) throw new Error('Missing playback notice')

      const observer = new MutationObserver(() => {
        if (frames.length >= 512)
          throw new Error('Manual feedback trace exceeded its bound')

        frames.push({
          kind: notice.getAttribute('data-kind'),
          matches: notice.getAttribute('data-pose-matches'),
          text: notice.textContent ?? ''
        })
      })
      observer.observe(notice, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      })
      Object.assign(window, { manualSeekTrace: { frames, observer } })
    })

    for (const target of targets.slice(1)) await drag(target)

    await page.screenshot({ path: info.outputPath(`${kind}-cold-seek.png`) })
    const records =
      (await page
        .getByTestId('live-observations')
        .locator('summary')
        .textContent()) ?? ''

    // Revisit exact observed values through the control; completed records must not grow.
    for (const time of sampled.slice(0, 3)) {
      await slider.fill(String(time))
      await expect(feedback).toContainText(`Checked ${time.toFixed(4)} s`)
      await expect(feedback).toHaveAttribute('data-kind', kind)
    }
    await expect(
      page.getByTestId('live-observations').locator('summary')
    ).toHaveText(records)

    const frames = await page.evaluate(() => {
      const trace = Reflect.get(window, 'manualSeekTrace') as {
        frames: { kind: string | null; matches: string | null; text: string }[]
        observer: MutationObserver
      }
      trace.observer.disconnect()
      return trace.frames
    })

    await info.attach('manual-seek-trace', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        viewport: page.viewportSize(),
        dpr: 1,
        camera: 'default',
        kind,
        sampled,
        records,
        frames
      })
    })
    expect(frames.length).toBeGreaterThan(0)
    expect(
      frames.every((frame) => frame.kind === kind && frame.matches === 'true')
    ).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Play trajectory', exact: true })
    ).toBeVisible()
    await expect(page.getByTestId('analysis-result')).toHaveCount(0)
    await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await page.screenshot({
      path: info.outputPath(`${kind}-warm-seek-dark.png`)
    })

    await slider.fill('0')
    await expect(feedback).toHaveAttribute('data-kind', 'clear')
    await expect(feedback).toContainText('Checked 0.0000 s')
  })
}
