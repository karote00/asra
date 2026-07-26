import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  getCoreDocumentDigest,
  getPersistedDocumentDigest,
  getTransactionSnapshot,
  waitForAppReady
} from './test-utils'

interface CanvasElementEvidence {
  bounds: {
    height: number
    width: number
    x: number
    y: number
  } | null
  id: string
  networkCount: number
  pointCount: number
  strokeColor: string | null
  type: string
}

interface CanvasSummary {
  groupCount: number
  pointCount: number
  totalCount: number
  uniqueIdCount: number
  vectorCount: number
}

const referenceImagePath = fileURLToPath(
  new URL(
    '../visual-review-records/research/research-02-original-tabby-source.png',
    import.meta.url
  )
)
const visualRecordDirectory = fileURLToPath(
  new URL('../visual-review-records/e2e-reference/', import.meta.url)
)

const openMockAi = async (page: Page) => {
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
}

const captureVisualState = async (
  page: Page,
  testInfo: TestInfo,
  name: string
) => {
  await mkdir(visualRecordDirectory, { recursive: true })
  const path = `${visualRecordDirectory}${name}.png`
  await page.screenshot({ path })
  await testInfo.attach(name, {
    contentType: 'image/png',
    path
  })
}

const addReferenceImage = async (page: Page) => {
  await page.getByLabel('Choose images').setInputFiles(referenceImagePath)
  await expect(
    page.getByRole('img', { name: 'research-02-original-tabby-source.png' })
  ).toBeVisible()
}

const submitTurn = async (
  page: Page,
  intent: string,
  outcome: 'cancelled' | 'failed' | 'no-change' | 'partial' | 'success',
  expectedSettledCount: number,
  timeout = 10_000
) => {
  const input = page.getByLabel('Message Agent')
  const settledTurns = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
  await expect(input).toBeEnabled()
  await input.fill(intent)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(settledTurns).toHaveCount(expectedSettledCount, {
    timeout
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
      .map(([id, element]) => {
        const type = String(element.get('type'))
        const topology =
          type === 'vector' ? elementApis.getVectorTopology(id) : null
        return {
          bounds: elementApis.getElementBounds(id),
          id,
          networkCount: topology ? Object.keys(topology.networks).length : 0,
          pointCount: topology ? Object.keys(topology.points).length : 0,
          strokeColor: strokeApis.getPrimaryStrokeColor(id),
          type
        }
      })
      .filter((entry) => entry.type !== 'workspace')
      .sort((left, right) => left.id.localeCompare(right.id))
  })

const getCanvasSummary = async (page: Page): Promise<CanvasSummary> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const sceneTree = scope.__Core__?.deps?.sceneTree
    const elementApis = scope.__AsyraE2E__?.elementApis
    if (!sceneTree || !elementApis) {
      throw new Error('Asyra Design E2E APIs are unavailable')
    }
    let groupCount = 0
    let pointCount = 0
    let totalCount = 0
    let vectorCount = 0
    const ids = new Set<string>()
    for (const [id, element] of sceneTree.getAllElements().entries()) {
      const type = String(element.get('type'))
      if (type === 'workspace') {
        continue
      }
      totalCount += 1
      ids.add(id)
      if (type === 'group') {
        groupCount += 1
      }
      if (type === 'vector') {
        vectorCount += 1
        const topology = elementApis.getVectorTopology(id)
        pointCount += topology ? Object.keys(topology.points).length : 0
      }
    }
    return {
      groupCount,
      pointCount,
      totalCount,
      uniqueIdCount: ids.size,
      vectorCount
    }
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
    await expect(page.getByLabel('Message Agent')).toBeFocused()
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
    await expect(page.getByLabel('Message Agent')).toBeFocused()
  })

  test('attaches a reference, chooses balanced detail, and incrementally edits the same canonical ids with one history action per mutating turn', async ({
    page
  }, testInfo) => {
    test.setTimeout(180_000)
    const persistenceErrors: string[] = []
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /(?:LocalStorage|IndexedDb)Persistence.*Save failed|QuotaExceededError/.test(
          message.text()
        )
      ) {
        persistenceErrors.push(message.text())
      }
    })
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)

    const beforeHistory = await getTransactionSnapshot(page)
    await addReferenceImage(page)
    await page.getByLabel('Message Agent').fill('請依照這張圖繪製')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Working on your request')).toBeVisible()
    await captureVisualState(page, testInfo, 'conversational-ai-planning-state')
    const settledTurns = page
      .getByTestId('mock-ai-panel')
      .locator('article[data-turn-id]')
    await expect(settledTurns).toHaveCount(1, { timeout: 10_000 })
    const clarificationTurn = settledTurns.last()
    await expect(clarificationTurn).toHaveAttribute('data-outcome', 'no-change')
    await expect(
      clarificationTurn.getByText('Choose a drawing detail level.')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Choose Balanced detail' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Choose Maximum detail' })
    ).toBeVisible()
    expect(await getCanvasEvidence(page)).toEqual([])
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount
    )
    await captureVisualState(page, testInfo, 'conversational-ai-detail-choice')

    await page.getByRole('button', { name: 'Choose Balanced detail' }).click()
    await expect(settledTurns).toHaveCount(2, { timeout: 120_000 })
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
    expect(created).toHaveLength(7112)
    expect(new Set(created.map(({ id }) => id)).size).toBe(7112)
    expect(created.filter(({ type }) => type === 'group')).toHaveLength(1)
    expect(created.filter(({ type }) => type === 'vector')).toHaveLength(7111)
    expect(
      created.reduce((total, entry) => total + entry.pointCount, 0)
    ).toBeGreaterThanOrEqual(115_000)
    const createdHistory = await getTransactionSnapshot(page)
    expect(createdHistory.undoCount).toBe(beforeHistory.undoCount + 1)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__Core__?.selectElements?.([], {
        undoable: false
      })
    })
    await captureVisualState(
      page,
      testInfo,
      'conversational-ai-balanced-cat-face-created'
    )

    await submitTurn(page, '把眼睛放大一點', 'success', 3, 120_000)
    const enlarged = await getCanvasEvidence(page)
    expect(enlarged.map(({ id }) => id)).toEqual(created.map(({ id }) => id))
    const createdById = new Map(created.map((entry) => [entry.id, entry]))
    const changedBounds = enlarged.filter((entry) => {
      const previous = createdById.get(entry.id)?.bounds
      return (
        previous !== null &&
        entry.bounds !== null &&
        (entry.bounds.width !== previous?.width ||
          entry.bounds.height !== previous?.height)
      )
    })
    expect(changedBounds.length).toBeGreaterThanOrEqual(2)
    changedBounds.forEach((entry) => {
      const previous = createdById.get(entry.id)?.bounds
      expect(entry.bounds?.width).toBeCloseTo((previous?.width ?? 0) * 1.2)
      expect(entry.bounds?.height).toBeCloseTo((previous?.height ?? 0) * 1.2)
    })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 2
    )

    await submitTurn(page, '把鬍鬚改成藍色', 'success', 4, 120_000)
    const recolored = await getCanvasEvidence(page)
    expect(recolored.map(({ id }) => id)).toEqual(created.map(({ id }) => id))
    const blueIds = recolored
      .filter(({ strokeColor }) => strokeColor === '#2563EB')
      .map(({ id }) => id)
    expect(blueIds.length).toBeGreaterThanOrEqual(2)
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
      .toBe(blueIds.length)
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 3
    )
    await captureVisualState(page, testInfo, 'conversational-ai-redo-state')

    const beforeReloadDigest = await getCoreDocumentDigest(page)
    expect(beforeReloadDigest.byteLength).toBeGreaterThan(5 * 1024 * 1024)
    await expect
      .poll(
        async () => (await getPersistedDocumentDigest(page))?.sha256 ?? null,
        { timeout: 30_000 }
      )
      .toBe(beforeReloadDigest.sha256)
    expect(persistenceErrors).toEqual([])

    await page.reload()
    await waitForAppReady(page)
    expect(await getCoreDocumentDigest(page)).toEqual(beforeReloadDigest)
  })

  test('creates the maximum-detail reference as one bounded history action', async ({
    page
  }, testInfo) => {
    test.skip(
      process.env.ASYRA_DESIGN_RUN_MAXIMUM_DETAIL !== '1',
      'Maximum-detail live materialization is an explicit one-run resource gate.'
    )
    test.setTimeout(900_000)
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)
    const beforeHistory = await getTransactionSnapshot(page)

    await addReferenceImage(page)
    await submitTurn(page, '請依照這張圖繪製', 'no-change', 1)
    await page.getByRole('button', { name: 'Choose Maximum detail' }).click()
    const settledTurns = page
      .getByTestId('mock-ai-panel')
      .locator('article[data-turn-id]')
    await expect(settledTurns).toHaveCount(2, { timeout: 900_000 })
    const createdTurn = settledTurns.last()
    await expect(createdTurn).toHaveAttribute('data-outcome', 'success')
    await expect(
      createdTurn.getByText('Drawing updated successfully.')
    ).toBeVisible()
    await expect(createdTurn.getByText(/^Elapsed \d/)).toBeVisible()
    const panel = page.getByTestId('mock-ai-panel')
    await expect(panel.getByText('You', { exact: true })).toHaveCount(0)
    await expect(panel.getByText('Mock AI', { exact: true })).toHaveCount(0)
    expect(await getCanvasSummary(page)).toEqual({
      groupCount: 1,
      pointCount: 295_794,
      totalCount: 27_472,
      uniqueIdCount: 27_472,
      vectorCount: 27_471
    })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )

    await captureVisualState(
      page,
      testInfo,
      'conversational-ai-maximum-detail-cat-face'
    )
  })

  test('projects cancellation, provider failure, unsupported, and partial outcomes without hidden mutation', async ({
    page
  }, testInfo) => {
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)
    const beforeHistory = await getTransactionSnapshot(page)

    await page.getByLabel('Message Agent').fill('畫一個貓臉')
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

    const partial = await submitTurn(
      page,
      '模擬部分成功',
      'partial',
      4,
      120_000
    )
    await expect(
      partial.getByText(
        'Partially updated the drawing: 7111 applied, 1 skipped.'
      )
    ).toBeVisible()
    expect(await getCanvasSummary(page)).toMatchObject({
      groupCount: 1,
      totalCount: 7112,
      vectorCount: 7111
    })
    expect((await getTransactionSnapshot(page)).undoCount).toBe(
      beforeHistory.undoCount + 1
    )
    await captureVisualState(page, testInfo, 'conversational-ai-partial-state')
  })

  test('keeps confirmation visible, revalidates a stale target, and invalidates older history controls', async ({
    page
  }, testInfo) => {
    test.setTimeout(300_000)
    await page.goto('/?ai=mock')
    await waitForAppReady(page)
    await openMockAi(page)

    await submitTurn(page, '畫一個貓臉', 'success', 1, 120_000)
    const afterCreate = await getTransactionSnapshot(page)
    await expect(
      page.getByRole('button', { name: 'Undo AI change' })
    ).toBeVisible()

    await page.getByLabel('Message Agent').fill('刪除目前的貓臉')
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

    await page.getByLabel('Message Agent').fill('刪除目前的貓臉')
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

    await submitTurn(page, '畫一個貓臉', 'success', 4, 120_000)
    const beforeConfirmedDelete = await getTransactionSnapshot(page)
    await captureVisualState(
      page,
      testInfo,
      'conversational-ai-confirmed-delete-created'
    )
    await page.getByLabel('Message Agent').fill('刪除目前的貓臉')
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
