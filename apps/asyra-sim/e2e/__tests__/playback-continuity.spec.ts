import { expect, test } from '@playwright/test'

for (const formalFirst of [false, true]) {
  test(`collision feedback preserves uninterrupted playback (formal evidence: ${formalFirst})`, async ({
    page
  }, info) => {
    test.setTimeout(45_000)

    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    await page.getByRole('button', { name: 'Experiments', exact: true }).click()
    await page.getByLabel('Experiment', { exact: true }).selectOption({
      label: 'Tool and table collision - r1'
    })

    if (formalFirst) {
      await page
        .getByRole('button', { name: 'Run preflight', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Run formal analysis', exact: true })
        .click()
      await expect(page.getByTestId('analysis-result')).toBeVisible({
        timeout: 35_000
      })
    }

    const time = page.getByLabel('Sampled trajectory preview time')
    const feedback = page.getByTestId('playback-feedback')
    const history = await page.getByTestId('history-depth').textContent()

    // This original-part pose is already colliding, before the report's 4 s witness.
    await time.fill('3.888')
    await expect(feedback).toContainText('Collision detected')
    await expect(feedback).toContainText('Checked 3.8880 s')
    await expect(feedback).toHaveAttribute('data-pose-matches', 'true')

    await page
      .getByRole('button', { name: 'Play trajectory', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Pause trajectory', exact: true })
    ).toBeVisible()
    await expect
      .poll(async () => Number(await time.inputValue()))
      .toBeGreaterThan(4.1)

    await page.screenshot({
      path: info.outputPath('collision-keeps-playing.png')
    })
    await page
      .getByRole('button', { name: 'Pause trajectory', exact: true })
      .click()

    const paused = await time.inputValue()

    await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
    await expect(time).toHaveValue(paused)
    await expect(page.getByTestId('history-depth')).toHaveText(history ?? '')
    await page.screenshot({ path: info.outputPath('explicit-pause.png') })
    await info.attach('playback-continuity', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        formalFirst,
        viewport: page.viewportSize(),
        dpr: 1,
        camera: 'default',
        checkedBeforePlay: 3.888,
        paused,
        feedback: await feedback.innerText(),
        pipeline: 'ordinary Play / accepted evidence / CUSTOM renderer',
        screenshots: ['collision-keeps-playing.png', 'explicit-pause.png']
      })
    })

    await time.fill('8')
    await expect(feedback).toHaveAttribute('data-pose-matches', 'true')
    await page
      .getByRole('button', { name: 'Play trajectory', exact: true })
      .click()
    await expect
      .poll(async () => Number(await time.inputValue()))
      .toBeGreaterThan(0)
    expect(Number(await time.inputValue())).toBeLessThan(3)
    await expect(feedback).toContainText('Checked 0.0000 s')
    await page
      .getByRole('button', { name: 'Pause trajectory', exact: true })
      .click()
  })
}
