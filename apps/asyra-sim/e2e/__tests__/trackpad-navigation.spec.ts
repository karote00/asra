import { expect, test } from '@playwright/test'

test('two-finger scrolling matches screen-plane drag pan, while pinch zoom stays inside the viewport', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(
    page.getByRole('button', { name: 'Switch to mouse controls' })
  ).toHaveText('Trackpad')
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
  const initial = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(75, 35)
  await rest()
  let panned = initial
  await expect
    .poll(async () => {
      panned = await canvas.screenshot()
      return panned.equals(initial)
    })
    .toBe(false)
  await canvas.screenshot({ path: info.outputPath('two-finger-pan.png') })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 - 75,
    box.y + box.height / 2 - 35,
    { steps: 6 }
  )
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await rest()
  await expect
    .poll(async () => (await canvas.screenshot()).equals(panned))
    .toBe(true)
  const pageScale = await page.evaluate(() => ({
    scale: visualViewport?.scale,
    dpr: devicePixelRatio,
    width: innerWidth
  }))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  // Chromium represents trackpad pinch as a Ctrl-modified wheel event.
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -60)
  await page.keyboard.up('Control')
  await rest()
  let pinched = panned
  await expect
    .poll(async () => {
      pinched = await canvas.screenshot()
      return pinched.equals(panned)
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
      input: 'Trackpad',
      initialCamera: 'default',
      wheel: [75, 35],
      equivalentDrag: [-75, -35],
      pinch: 'Ctrl-wheel deltaY -60',
      selection: 'example:fixture-post',
      geometry: 'default synthetic six-axis workcell',
      screenshots: ['two-finger-pan.png', 'pinch-zoom.png'],
      limitation:
        'Browser event-path verification; physical trackpad feel requires user testing.'
    })
  })
})

test('mouse controls retain wheel zoom and the device choice survives reload', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await page.getByRole('button', { name: 'Switch to mouse controls' }).click()
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  await expect(
    page.getByRole('button', { name: 'Switch to trackpad controls' })
  ).toHaveText('Mouse')
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
  await page
    .getByRole('button', { name: 'Switch to trackpad controls' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Switch to mouse controls' })
  ).toHaveText('Trackpad')
  await expect(page.getByTestId('history-depth')).toHaveText('Undo steps: 2')
})

test('input mode remains accessible without changing panel dimensions at narrow widths', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  for (const width of [1440, 960, 600]) {
    await page.setViewportSize({ width, height: 960 })
    const panel = page.getByRole('region', { name: '3D workcell' })
    const before = await panel.boundingBox()
    const button = page.getByRole('button', {
      name: 'Switch to mouse controls'
    })
    await expect(button).toBeVisible()
    const bounds = await button.boundingBox()
    if (!bounds || !before) throw new Error('Missing navigation controls')
    expect(bounds.x).toBeGreaterThanOrEqual(before.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(before.x + before.width)
    await button.click()
    expect(await panel.boundingBox()).toEqual(before)
    await page
      .getByRole('button', { name: 'Switch to trackpad controls' })
      .click()
    await page.screenshot({ path: info.outputPath(`input-mode-${width}.png`) })
  }
})
