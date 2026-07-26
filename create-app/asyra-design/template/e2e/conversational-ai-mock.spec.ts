import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { getTransactionSnapshot, waitForAppReady } from './test-utils'

interface CanvasElementEvidence {
  bounds: {
    height: number
    width: number
    x: number
    y: number
  } | null
  id: string
  strokeColor: string | null
  type: string
}

const openMockAi = async (page: Page) => {
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
}

const captureVisualState = async (
  page: Page,
  testInfo: TestInfo,
  name: string
) => {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, {
    contentType: 'image/png',
    path
  })
}

const submitTurn = async (
  page: Page,
  intent: string,
  outcome: 'cancelled' | 'failed' | 'no-change' | 'partial' | 'success',
  expectedSettledCount: number
) => {
  const input = page.getByLabel('Message Mock AI')
  const settledTurns = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
  await expect(input).toBeEnabled()
  await input.fill(intent)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(settledTurns).toHaveCount(expectedSettledCount, {
    timeout: 10_000
  })
  const turn = settledTurns.last()
  await expect(turn).toHaveAttribute('data-outcome', outcome)
  return turn
}

const getCanvasEvidence = async (
  page: Page
): Promise<CanvasElementEvidence[]> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const sceneTree = scope.__Core__?.deps?.sceneTree
    const elementApis = scope.__AsyraE2E__?.elementApis
    const strokeApis = scope.__AsyraE2E__?.strokeApis
    if (!sceneTree || !elementApis || !strokeApis) {
      throw new Error('Asyra Design E2E APIs are unavailable')
    }
    return [...sceneTree.getAllElements().entries()]
      .map(([id, element]) => ({
        bounds: elementApis.getElementBounds(id),
        id,
        strokeColor: strokeApis.getPrimaryStrokeColor(id),
        type: String(element.get('type'))
      }))
      .filter((entry) => entry.type !== 'workspace')
      .sort((left, right) => left.id.localeCompare(right.id))
  })

test.describe('Conversational AI Mock Drawing', () => {
  test('activates only for the exact ai=mock query', async ({
    page
  }, testInfo) => {
    const expectNoAiSurface = async () => {
      await expect(page.getByTestId('mock-ai-toolbar-button')).toHaveCount(0)
      await page.mouse.click(600, 300, { button: 'right' })
      await expect(
        page.getByRole('menuitem', { name: /Toggle Agent Panel/ })
      ).toHaveCount(0)
      await page.keyboard.press('Escape')
    }

    await page.goto('/')
    await waitForAppReady(page)
    await expectNoAiSurface()

    await page.goto('/?ai=unknown')
    await waitForAppReady(page)
    await expectNoAiSurface()

    await page.goto('/?ai=mock&ai=mock')
    await waitForAppReady(page)
    await expectNoAiSurface()

    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await expect(page.getByTestId('mock-ai-toolbar-button')).toBeVisible()

    const canvasHost = page.getByTestId('asyra-canvas-host')
    await canvasHost.focus()
    const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${primaryModifier}+i`)
    await expect(page.getByRole('complementary')).toBeVisible()
    await expect(page.getByLabel('Message Mock AI')).toBeFocused()
    await page.keyboard.press(`${primaryModifier}+i`)
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await expect(canvasHost).toBeFocused()

    await page.mouse.click(600, 300, { button: 'right' })
    const agentCommand = page.getByRole('menuitem', {
      name: /Toggle Agent Panel/
    })
    await expect(agentCommand).toBeVisible()
    await expect(agentCommand).toContainText(
      process.platform === 'darwin' ? '⌘I' : 'Ctrl+I'
    )
    await captureVisualState(page, testInfo, 'conversational-ai-context-menu')
    await agentCommand.click()
    await expect(page.getByRole('complementary')).toBeVisible()
    await expect(page.getByLabel('Message Mock AI')).toBeFocused()
  })

  test('creates and incrementally edits the same canonical cat-face ids with one history action per turn', async ({
    page
  }, testInfo) => {
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)

    const beforeHistory = await getTransactionSnapshot(page)
    const input = page.getByLabel('Message Mock AI')
    await input.fill('畫一個貓臉')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Working on your request')).toBeVisible()
    await captureVisualState(page, testInfo, 'conversational-ai-planning-state')
    const settledTurns = page
      .getByTestId('mock-ai-panel')
      .locator('article[data-turn-id]')
    await expect(settledTurns).toHaveCount(1, { timeout: 10_000 })
    const createTurn = settledTurns.last()
    await expect(createTurn).toHaveAttribute('data-outcome', 'success')
    await expect(
      createTurn.getByText('Understanding the request')
    ).toBeVisible()
    await expect(createTurn.getByText('Applying changes')).toBeVisible()
    await expect(
      createTurn.getByText('Drawing updated successfully.')
    ).toBeVisible()

    const created = await getCanvasEvidence(page)
    expect(created).toHaveLength(17)
    expect(new Set(created.map(({ id }) => id)).size).toBe(17)
    const createdHistory = await getTransactionSnapshot(page)
    expect(createdHistory.undoCount).toBe(beforeHistory.undoCount + 1)

    const eyesBefore = created.filter(
      ({ bounds, type }) =>
        type === 'oval' && bounds?.width === 58 && bounds.height === 70
    )
    expect(eyesBefore).toHaveLength(2)

    await submitTurn(page, '把眼睛放大一點', 'success', 2)
    const enlarged = await getCanvasEvidence(page)
    expect(enlarged.map(({ id }) => id)).toEqual(created.map(({ id }) => id))
    const enlargedById = new Map(enlarged.map((entry) => [entry.id, entry]))
    eyesBefore.forEach((eye) => {
      expect(enlargedById.get(eye.id)?.bounds?.width).toBeCloseTo(69.6)
      expect(enlargedById.get(eye.id)?.bounds?.height).toBeCloseTo(84)
    })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 2
    )

    await submitTurn(page, '把鬍鬚改成藍色', 'success', 3)
    const recolored = await getCanvasEvidence(page)
    expect(recolored.map(({ id }) => id)).toEqual(created.map(({ id }) => id))
    const blueIds = recolored
      .filter(({ strokeColor }) => strokeColor === '#2563EB')
      .map(({ id }) => id)
    expect(blueIds).toHaveLength(6)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 3
    )

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__Core__?.selectElements?.([], {
        undoable: false
      })
    })
    await captureVisualState(page, testInfo, 'conversational-ai-cat-face')

    await page.getByRole('button', { name: 'Undo AI change' }).click()
    await expect(
      page.getByRole('button', { name: 'Redo AI change' })
    ).toBeVisible()
    await expect
      .poll(
        async () =>
          (await getCanvasEvidence(page)).filter(
            ({ strokeColor }) => strokeColor === '#2563EB'
          ).length
      )
      .toBe(0)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 2
    )
    await captureVisualState(page, testInfo, 'conversational-ai-undo-state')

    await page.getByRole('button', { name: 'Redo AI change' }).click()
    await expect(
      page.getByRole('button', { name: 'Undo AI change' })
    ).toBeVisible()
    await expect
      .poll(
        async () =>
          (await getCanvasEvidence(page)).filter(
            ({ strokeColor }) => strokeColor === '#2563EB'
          ).length
      )
      .toBe(6)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 3
    )
    await captureVisualState(page, testInfo, 'conversational-ai-redo-state')
  })

  test('creates a detailed editable cat face as one bounded history action', async ({
    page
  }, testInfo) => {
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)
    const beforeHistory = await getTransactionSnapshot(page)

    await submitTurn(page, '畫一個精緻的貓臉', 'success', 1)
    const panel = page.getByTestId('mock-ai-panel')
    await expect(panel.getByText('You', { exact: true })).toHaveCount(0)
    await expect(panel.getByText('Mock AI', { exact: true })).toHaveCount(1)
    const created = await getCanvasEvidence(page)
    expect(created).toHaveLength(25)
    expect(new Set(created.map(({ id }) => id)).size).toBe(25)
    expect(created.filter(({ type }) => type === 'group')).toHaveLength(1)
    expect(created.filter(({ type }) => type === 'oval')).toHaveLength(11)
    expect(created.filter(({ type }) => type === 'vector')).toHaveLength(13)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )

    await captureVisualState(
      page,
      testInfo,
      'conversational-ai-detailed-cat-face'
    )

    await page.getByRole('button', { name: 'Undo AI change' }).click()
    await expect.poll(() => getCanvasEvidence(page)).toEqual([])
  })

  test('projects cancellation, provider failure, unsupported, and partial outcomes without hidden mutation', async ({
    page
  }, testInfo) => {
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)
    const beforeHistory = await getTransactionSnapshot(page)

    await page.getByLabel('Message Mock AI').fill('畫一個貓臉')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(
      page.getByRole('button', { name: 'Cancel request' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel request' }).click()
    const settledTurns = page
      .getByTestId('mock-ai-panel')
      .locator('article[data-turn-id]')
    await expect(settledTurns).toHaveCount(1)
    await expect(settledTurns.last()).toHaveAttribute(
      'data-outcome',
      'cancelled'
    )

    await submitTurn(page, '模擬 provider 失敗', 'failed', 2)
    await submitTurn(page, '這不是支援的指令', 'failed', 3)
    expect(await getCanvasEvidence(page)).toHaveLength(0)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount
    )
    await expect(
      page.getByRole('button', { name: 'Undo AI change' })
    ).toHaveCount(0)

    const partial = await submitTurn(page, '模擬部分成功', 'partial', 4)
    await expect(
      partial.getByText('Partially updated the drawing: 16 applied, 1 skipped.')
    ).toBeVisible()
    expect(await getCanvasEvidence(page)).toHaveLength(17)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )
    await captureVisualState(page, testInfo, 'conversational-ai-partial-state')
  })

  test('keeps confirmation visible, revalidates a stale target, and invalidates older history controls', async ({
    page
  }, testInfo) => {
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)

    await submitTurn(page, '畫一個貓臉', 'success', 1)
    const afterCreate = await getTransactionSnapshot(page)
    await expect(
      page.getByRole('button', { name: 'Undo AI change' })
    ).toBeVisible()

    await page.getByLabel('Message Mock AI').fill('刪除目前的貓臉')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByLabel('AI action confirmation')).toBeVisible()
    await captureVisualState(
      page,
      testInfo,
      'conversational-ai-confirmation-state'
    )
    await page.getByRole('button', { name: 'Deny' }).click()
    const settledTurns = page
      .getByTestId('mock-ai-panel')
      .locator('article[data-turn-id]')
    await expect(settledTurns).toHaveCount(2)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      afterCreate.undoCount
    )

    await page.getByLabel('Message Mock AI').fill('刪除目前的貓臉')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByLabel('AI action confirmation')).toBeVisible()
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      const sceneTree = scope.__Core__?.deps?.sceneTree
      const hierarchyApis = scope.__AsyraE2E__?.hierarchyApis
      const group = [...sceneTree.getAllElements().entries()].find(
        ([, element]) => element.get('type') === 'group'
      )
      if (!group || !hierarchyApis) {
        throw new Error('Current cat-face group is unavailable')
      }
      hierarchyApis.removeSubtree(group[0], {
        undoable: true
      })
    })
    await expect(
      page.getByRole('button', { name: 'Undo AI change' })
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Allow' }).click()
    await expect(settledTurns).toHaveCount(3)
    await expect(settledTurns.last()).toHaveAttribute(
      'data-outcome',
      'no-change'
    )
    expect(await getCanvasEvidence(page)).toHaveLength(0)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      afterCreate.undoCount + 1
    )

    await submitTurn(page, '畫一個貓臉', 'success', 4)
    const beforeConfirmedDelete = await getTransactionSnapshot(page)
    await page.getByLabel('Message Mock AI').fill('刪除目前的貓臉')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByLabel('AI action confirmation')).toBeVisible()
    await page.getByRole('button', { name: 'Allow' }).click()
    await expect(settledTurns).toHaveCount(5)
    expect(await getCanvasEvidence(page)).toHaveLength(0)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeConfirmedDelete.undoCount + 1
    )
  })
})
