import { expect, test } from '@playwright/test'

test('two-finger scrolling matches pinch zoom without panning or changing page scale', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(
    page.getByRole('button', { name: /Switch to (mouse|trackpad) controls/ })
  ).toHaveCount(0)
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  const canvas = page.getByTestId('workcell-canvas').locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Missing viewport')
  const rest = async () => {
    await page.getByRole('button', { name: 'Undo', exact: true }).focus()
    await page.mouse.move(10, 10)
  }
  await rest()
  const pageScale = await page.evaluate(() => ({
    scale: visualViewport?.scale,
    dpr: devicePixelRatio,
    width: innerWidth
  }))
  const initial = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(75, 35)
  await rest()
  let zoomed = initial
  await expect
    .poll(async () => {
      zoomed = await canvas.screenshot()
      return zoomed.equals(initial)
    })
    .toBe(false)
  await canvas.screenshot({ path: info.outputPath('two-finger-zoom.png') })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  // Pinch has no horizontal delta: exact parity proves scroll did not pan.
  await page.keyboard.down('Control')
  try {
    await page.mouse.wheel(0, 35)
  } finally {
    await page.keyboard.up('Control')
  }
  await rest()
  await expect
    .poll(async () => (await canvas.screenshot()).equals(zoomed))
    .toBe(true)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(75, 0)
  await rest()
  expect((await canvas.screenshot()).equals(zoomed)).toBe(true)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  // Chromium represents trackpad pinch as a Ctrl-modified wheel event.
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -60)
  await page.keyboard.up('Control')
  await rest()
  let pinched = zoomed
  await expect
    .poll(async () => {
      pinched = await canvas.screenshot()
      return pinched.equals(zoomed)
    })
    .toBe(false)
  expect(
    await page.evaluate(() => ({
      scale: visualViewport?.scale,
      dpr: devicePixelRatio,
      width: innerWidth
    }))
  ).toEqual(pageScale)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 2')
  await expect(page.getByLabel('Object name')).toHaveValue('fixture post')
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
  await canvas.screenshot({ path: info.outputPath('pinch-zoom.png') })
  // Scrolling the inspector must not move the scene behind it.
  await page.getByText('Mount rotation', { exact: true }).click()
  await page.locator('summary').filter({ hasText: 'Original parts' }).click()
  const panel = page.locator('.properties-panel .editor-content')
  await expect
    .poll(() => panel.evaluate((node) => node.scrollHeight - node.clientHeight))
    .toBeGreaterThan(0)
  const panelBox = await panel.boundingBox()
  if (!panelBox) throw new Error('Missing inspector')
  await page.mouse.move(panelBox.x + panelBox.width - 20, panelBox.y + 180)
  await page.mouse.wheel(0, 320)
  await expect
    .poll(() => panel.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0)
  await rest()
  expect((await canvas.screenshot()).equals(pinched)).toBe(true)
  await info.attach('trackpad-review', {
    contentType: 'application/json',
    body: JSON.stringify({
      url: page.url(),
      viewport: page.viewportSize(),
      canvas: box,
      dpr: 1,
      scope: 'files:e2e/__tests__/trackpad-navigation.spec.ts',
      input: 'Scroll and pinch zoom; Shift-drag pan',
      initialCamera: 'default',
      wheel: [75, 35],
      equivalentPinch: 'Ctrl-wheel deltaY 35',
      pinch: 'Ctrl-wheel deltaY -60',
      selection: 'example:fixture-post',
      geometry: 'default synthetic six-axis workcell',
      screenshots: ['two-finger-zoom.png', 'pinch-zoom.png'],
      limitation:
        'Browser event-path verification; physical trackpad feel requires user testing.'
    })
  })
})

test('a previous trackpad preference cannot restore scroll pan after reload', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('asyra-sim.navigation-input', 'trackpad')
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(
    page.getByRole('button', { name: /Switch to (mouse|trackpad) controls/ })
  ).toHaveCount(0)
  const canvas = page.getByTestId('workcell-canvas').locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Missing viewport')
  await page.getByRole('button', { name: 'Undo', exact: true }).focus()
  await page.mouse.move(10, 10)
  const initial = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -60)
  await page.mouse.move(10, 10)
  let mouseZoom = initial
  await expect
    .poll(async () => {
      mouseZoom = await canvas.screenshot()
      return mouseZoom.equals(initial)
    })
    .toBe(false)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).focus()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -60)
  await page.keyboard.up('Control')
  await page.mouse.move(10, 10)
  await expect
    .poll(async () => (await canvas.screenshot()).equals(mouseZoom))
    .toBe(true)
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 2')
})

test('navigation controls fit narrow widths without changing panel dimensions', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  for (const width of [1440, 960, 600]) {
    await page.setViewportSize({ width, height: 960 })
    const panel = page.getByRole('region', { name: '3D workcell' })
    const before = await panel.boundingBox()
    const button = page.getByRole('button', {
      name: 'Fit all',
      exact: true
    })
    await expect(button).toBeVisible()
    const bounds = await button.boundingBox()
    if (!bounds || !before) throw new Error('Missing navigation controls')
    expect(bounds.x).toBeGreaterThanOrEqual(before.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(before.x + before.width)
    await button.click()
    expect(await panel.boundingBox()).toEqual(before)
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    expect(await panel.boundingBox()).toEqual(before)
    await page.screenshot({
      path: info.outputPath(`zoom-controls-${width}.png`)
    })
  }
})
