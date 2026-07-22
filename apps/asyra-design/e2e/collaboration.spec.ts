import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  createVectorPath,
  dragSelectedElementBy,
  getCanvasPosition,
  getElementCount,
  getSelectedElementClientCenter,
  redo,
  undo,
  waitForAppReady
} from './test-utils'

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}`

const waitForCollaboration = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
      )
    )
    .toBe('connected')
}

const getCanonicalSnapshot = (page: Page) =>
  page.evaluate(() => {
    const elements = window.__Core__?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) return []
    return Array.from(elements.entries())
      .filter(([, element]) => element.get?.('type') !== 'workspace')
      .map(([id, element]) => ({
        id,
        type: String(element.get?.('type') ?? ''),
        computed: element.getAllComputedData?.() ?? {},
        rendered: Boolean(window.__Core__?.deps?.render?.getElementById?.(id))
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  })

const getCollaborationDiagnostics = (page: Page) =>
  page.evaluate(() => ({
    status: window.__AsyraCollaboration__?.getStatus() ?? 'missing',
    identity: window.__AsyraCollaboration__?.identity,
    canonicalElementCount: Array.from(
      window.__Core__?.deps?.sceneTree?.getAllElements?.().values?.() ?? []
    ).filter((element) => element.get?.('type') !== 'workspace').length
  }))

const getCanonicalRenderVisibility = (page: Page, elementId: string) =>
  page.evaluate(
    (id) =>
      window.__Core__?.deps?.render?.getElementById?.(id)?.visible ?? null,
    elementId
  )

const expectSelectedElementInteriorToConverge = async (
  source: Page,
  peer: Page
) => {
  const center = await getSelectedElementClientCenter(source)
  if (!center) {
    throw new Error('Selected element center is unavailable for visual parity')
  }
  const clip = {
    x: Math.round(center.x - 10),
    y: Math.round(center.y - 10),
    width: 20,
    height: 20
  }
  const expected = (await source.screenshot({ clip })).toString('base64')

  await expect
    .poll(async () => (await peer.screenshot({ clip })).toString('base64'))
    .toBe(expected)
}

test('two real Asyra Design windows converge and reconnect through WebSocket/Yjs', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-${Date.now()}-${testInfo.workerIndex}`
  const isolatedFileId = `${fileId}-isolated`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const isolatedContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()
  const isolated = await isolatedContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId)),
      isolated.goto(collaborationUrl(isolatedFileId))
    ])
    await Promise.all([
      waitForAppReady(first),
      waitForAppReady(second),
      waitForAppReady(isolated)
    ])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second),
      waitForCollaboration(isolated)
    ])

    await createRectangle(first, 0.35, 0.35)
    try {
      await expect.poll(() => getElementCount(second)).toBe(1)
    } catch (error) {
      const diagnostics = {
        first: await getCollaborationDiagnostics(first),
        second: await getCollaborationDiagnostics(second)
      }
      await testInfo.attach('collaboration-diagnostics.json', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json'
      })
      throw error
    }
    expect(await getElementCount(isolated)).toBe(0)
    try {
      await expect
        .poll(() => getCanonicalSnapshot(second))
        .toEqual(await getCanonicalSnapshot(first))
    } catch (error) {
      const diagnostics = {
        first: await getCollaborationDiagnostics(first),
        second: await getCollaborationDiagnostics(second)
      }
      await testInfo.attach('canonical-convergence-diagnostics.json', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json'
      })
      throw error
    }
    await expectSelectedElementInteriorToConverge(first, second)
    expect(
      await second.evaluate(
        () =>
          window.__Core__?.deps?.selection?.getElementSelectionIds?.().length ??
          0
      )
    ).toBe(0)

    await dragSelectedElementBy(first, 90, 55, 12)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getElementCount(isolated)).toBe(0)

    const movedSnapshot = await getCanonicalSnapshot(first)
    await undo(first)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await redo(first)
    await expect
      .poll(() => getCanonicalSnapshot(first))
      .toEqual(movedSnapshot)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(movedSnapshot)

    await first.keyboard.press('Delete')
    await expect.poll(() => getElementCount(first)).toBe(0)
    await expect.poll(() => getElementCount(second)).toBe(0)
    expect(await getElementCount(isolated)).toBe(0)

    await second.evaluate(() => window.__AsyraCollaboration__?.disconnect())
    await expect
      .poll(() =>
        second.evaluate(
          () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
        )
      )
      .toBe('disconnected')

    await createRectangle(first, 0.6, 0.55)
    await expect.poll(() => getElementCount(first)).toBe(1)
    expect(await getElementCount(second)).toBe(0)
    expect(await getElementCount(isolated)).toBe(0)

    await second.evaluate(() => window.__AsyraCollaboration__?.reconnect())
    await waitForCollaboration(second)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    await expectSelectedElementInteriorToConverge(first, second)

    await first.screenshot({
      path: testInfo.outputPath('actor-a-converged.png'),
      fullPage: true
    })
    await second.screenshot({
      path: testInfo.outputPath('actor-b-converged.png'),
      fullPage: true
    })
  } finally {
    await Promise.all([
      firstContext.close(),
      secondContext.close(),
      isolatedContext.close()
    ])
  }
})

test('vector creation and anchor movement converge through the canonical collaboration pipeline', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-vector-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])

    await createVectorPath(first, 0.32, 0.3, 0.18, 0.16)
    await expect.poll(() => getElementCount(second)).toBe(1)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await first.keyboard.press('Enter')
    const before = await first.evaluate(() => {
      const core = window.__Core__
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
      const computed = vectorId
        ? core?.deps?.sceneTree
            ?.getElementById?.(vectorId)
            ?.getAllComputedData?.()
        : undefined
      const anchor = Object.values(computed?.points ?? {}).find(
        (point) =>
          typeof point === 'object' && point !== null && point.kind === 'anchor'
      ) as { id: string; x: number; y: number } | undefined
      if (!vectorId || !anchor) {
        throw new Error('Created vector has no editable anchor')
      }
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const usesWorkspacePoints = computed?.pointCoordinateSpace === 'workspace'
      const offsetX = usesWorkspacePoints ? 0 : (computed?.x ?? 0)
      const offsetY = usesWorkspacePoints ? 0 : (computed?.y ?? 0)
      return {
        vectorId,
        pointId: anchor.id,
        point: { x: anchor.x, y: anchor.y },
        client: {
          x: (offsetX + anchor.x) * zoom + viewport.x,
          y: (offsetY + anchor.y) * zoom + viewport.y
        }
      }
    })

    await first.mouse.move(before.client.x, before.client.y)
    await first.mouse.down()
    await first.mouse.move(before.client.x + 48, before.client.y + 24, {
      steps: 12
    })
    await first.mouse.up()
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    const remotePoint = await second.evaluate(
      ({ vectorId, pointId }) => {
        const point = window.__Core__?.deps?.sceneTree
          ?.getElementById?.(vectorId)
          ?.getAllComputedData?.()?.points?.[pointId]
        return point ? { x: point.x, y: point.y } : null
      },
      before
    )
    expect(remotePoint).not.toBeNull()
    expect(remotePoint).not.toEqual(before.point)
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})

test('mouse-down create and drag frames reach peer canonical state before pointer-up', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-return-origin-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])

    await first.keyboard.press('r')
    const createPosition = await getCanvasPosition(first, 0.35, 0.35)
    await first.mouse.move(createPosition.x, createPosition.y)
    await first.mouse.down()
    await expect.poll(() => getElementCount(second)).toBe(1)
    await first.mouse.up()
    await first.keyboard.press('v')
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    const clickCreated = (await getCanonicalSnapshot(second))[0]?.computed as
      | { width?: unknown; height?: unknown }
      | undefined
    expect(clickCreated?.width).toBe(100)
    expect(clickCreated?.height).toBe(100)

    const snapshot = await getCanonicalSnapshot(first)
    const elementId = snapshot[0]?.id
    const center = await getSelectedElementClientCenter(first)
    if (!elementId || !center) {
      throw new Error('move return-to-origin setup did not produce an element')
    }

    await first.mouse.move(center.x, center.y)
    await first.mouse.down()
    await first.mouse.move(center.x + 90, center.y + 55, { steps: 12 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getCanonicalRenderVisibility(second, elementId)).toBe(true)

    await first.mouse.move(center.x, center.y, { steps: 12 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    await first.mouse.up()

    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getCanonicalRenderVisibility(second, elementId)).toBe(true)
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})
