import { expect, test } from '@playwright/test'
import * as THREE from 'three'
import { readHistoryDepth } from '../history-depth'

test('starting a left-button view gesture preserves normal Object field completion', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Local runtime ready')
  const initialDepth = await readHistoryDepth(page)
  await page
    .getByRole('treeitem', { name: '◇ fixture post', exact: true })
    .click()
  await page.getByLabel('Mount position (m) X', { exact: true }).fill('-1.25')
  const box = await page.getByTestId('workcell-canvas').boundingBox()
  if (!box) throw new Error('Missing canvas')
  await page.mouse.move(box.x + 60, box.y + 80)
  await page.mouse.down()
  await page.mouse.move(box.x + 90, box.y + 100, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => readHistoryDepth(page)).toBe(initialDepth + 1)
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).not.toBeFocused()
  await page.keyboard.press('Meta+z')
  await expect(
    page.getByLabel('Mount position (m) X', { exact: true })
  ).toHaveValue('-0.75')
})

for (const button of ['middle', 'left'] as const) {
  test(`Shift+${button} drag pans the normal scene without changing selection or history`, async ({
    page
  }, info) => {
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    await page
      .getByRole('treeitem', { name: '◉ J1 - Base yaw', exact: true })
      .click()
    const canvas = page.getByTestId('workcell-canvas').locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Missing canvas')
    const history = await page.getByTestId('history-depth').innerText()
    await canvas.screenshot({ path: info.outputPath('before-pan.png') })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.down('Shift')
    await page.mouse.down({ button })
    await page.mouse.move(
      box.x + box.width / 2 + 75,
      box.y + box.height / 2 + 35,
      { steps: 8 }
    )
    await page.mouse.up({ button })
    await page.keyboard.up('Shift')
    await expect(page.getByLabel('Object name')).toHaveValue('J1 - Base yaw')
    await expect(page.getByTestId('history-depth')).toHaveText(history)
    // Independent Three.js perspective oracle: ray selection must follow the panned geometry.
    const eye = new THREE.Vector3(3.2, 2.4, 3.6),
      target = new THREE.Vector3(0, 0.9, 0)
    const back = eye.clone().sub(target).normalize()
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize()
    const up = back.clone().cross(right)
    const pixelSize =
      (2 * eye.distanceTo(target) * Math.tan((23 * Math.PI) / 180)) / box.height
    const offset = right
      .multiplyScalar(-75 * pixelSize)
      .add(up.multiplyScalar(35 * pixelSize))
    const camera = new THREE.PerspectiveCamera(
      46,
      box.width / box.height,
      0.005,
      200
    )
    camera.position.copy(eye.add(offset))
    camera.lookAt(target.add(offset))
    camera.updateMatrixWorld()
    const point = new THREE.Vector3(-0.75, 0.65, 0.45).project(camera)
    await page.mouse.click(
      box.x + ((point.x + 1) * box.width) / 2,
      box.y + ((1 - point.y) * box.height) / 2
    )
    await expect(page.getByLabel('Object name')).toHaveValue('fixture post')
    await expect(
      page.getByLabel('Mount position (m) X', { exact: true })
    ).toHaveValue('-0.75')
    await canvas.screenshot({ path: info.outputPath('after-pan.png') })
    await info.attach('viewport-review', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        viewport: page.viewportSize(),
        canvas: box,
        dpr: 1,
        scope: 'files:e2e/__tests__/viewport-navigation.spec.ts',
        gesture: `Shift+${button}`,
        delta: [75, 35],
        camera: {
          position: camera.position.toArray(),
          target: target.toArray(),
          fov: 46
        },
        selection: 'example:fixture-post',
        screenshots: ['before-pan.png', 'after-pan.png']
      })
    })
  })
}

for (const [modifier, width] of [
  ['Meta', 1440],
  ['Control', 960]
] as const) {
  test(`${modifier}+1 and Fit all share framing at ${width}px without model edits`, async ({
    page
  }, info) => {
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    await page
      .getByRole('treeitem', { name: '◇ fixture post', exact: true })
      .click()
    await page.setViewportSize({ width, height: 960 })
    const restPointerAndFocus = async () => {
      await page.getByRole('button', { name: 'Undo', exact: true }).focus()
      await page.mouse.move(10, 10)
    }
    await restPointerAndFocus()
    const canvas = page.getByTestId('workcell-canvas').locator('canvas')
    const history = await page.getByTestId('history-depth').innerText()
    const initial = await canvas.screenshot()
    await page.keyboard.press(`${modifier}+1`)
    let fitted = initial
    await expect
      .poll(async () => {
        fitted = await canvas.screenshot()
        return fitted.equals(initial)
      })
      .toBe(false)
    await canvas.screenshot({ path: info.outputPath('fit-keyboard.png') })
    await expect(page.getByLabel('Object name')).toHaveValue('fixture post')
    await expect(page.getByTestId('history-depth')).toHaveText(history)
    // A native field owns its key input; fitting must not run behind it.
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await restPointerAndFocus()
    await expect
      .poll(async () => (await canvas.screenshot()).equals(initial))
      .toBe(true)
    await page.getByLabel('Object name').press(`${modifier}+1`)
    expect((await canvas.screenshot()).equals(initial)).toBe(true)
    await page.getByRole('button', { name: 'Fit all', exact: true }).click()
    await restPointerAndFocus()
    await expect
      .poll(async () => (await canvas.screenshot()).equals(fitted))
      .toBe(true)
    await canvas.screenshot({ path: info.outputPath('fit-button.png') })
    await expect(
      page.getByLabel('Mount position (m) X', { exact: true })
    ).toHaveValue('-0.75')
    await expect(page.getByTestId('history-depth')).toHaveText(history)
    await info.attach('viewport-review', {
      contentType: 'application/json',
      body: JSON.stringify({
        url: page.url(),
        viewport: page.viewportSize(),
        canvas: await canvas.boundingBox(),
        dpr: 1,
        scope: 'files:e2e/__tests__/viewport-navigation.spec.ts',
        selection: 'example:fixture-post',
        geometry: 'default synthetic six-axis workcell',
        projection: 'normal Core/Render/CUSTOM',
        camera:
          'Fit all preserving default direction; 32 CSS px minimum padding',
        screenshots: ['fit-keyboard.png', 'fit-button.png']
      })
    })
  })
}
