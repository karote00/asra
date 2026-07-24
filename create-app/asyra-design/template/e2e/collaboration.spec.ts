import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  createVectorPath,
  dragSelectedElementBy,
  getCanvasPosition,
  getContentsPanel,
  getElementCount,
  getSelectedElementClientCenter,
  redo,
  undo,
  waitForAppReady
} from './test-utils'

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}`

const layerRow = (page: Page, elementId: string) =>
  page.getByTestId(`element-item-${elementId}`)

const getLayerIds = (page: Page): Promise<string[]> =>
  getContentsPanel(page)
    .locator('[data-layer-element="true"]')
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          row.getAttribute('data-testid')?.replace('element-item-', '') ?? ''
      )
    )

const getSelectedIds = (page: Page): Promise<string[]> =>
  page.evaluate(
    () => window.__Core__?.deps.selection.getElementSelectionIds() ?? []
  )

const groupLayerIds = async (
  page: Page,
  elementIds: readonly string[]
): Promise<string> => {
  const contentsPanel = getContentsPanel(page)
  const panelBounds = await contentsPanel.boundingBox()
  if (!panelBounds) {
    throw new Error('Layers panel bounds are unavailable')
  }
  await page.mouse.click(
    panelBounds.x + panelBounds.width / 2,
    panelBounds.y + panelBounds.height - 50
  )
  await expect.poll(() => getSelectedIds(page)).toEqual([])

  await layerRow(page, elementIds[0]).click()
  await page.keyboard.down('Shift')
  try {
    for (const elementId of elementIds.slice(1)) {
      await layerRow(page, elementId).click()
    }
  } finally {
    await page.keyboard.up('Shift')
  }
  const groupButton = page.getByTestId('layers-group-button')
  await expect(groupButton).toBeEnabled()
  await groupButton.click()
  await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
  return (await getSelectedIds(page))[0]
}

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

const getCanonicalHierarchyGeometry = (page: Page) =>
  page.evaluate(() => {
    const sceneTree = window.__Core__?.deps?.sceneTree
    const elements = sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) return []

    const getFiniteNumber = (
      value: unknown,
      elementId: string,
      key: string
    ): number => {
      const result = Number(value)
      if (!Number.isFinite(result)) {
        throw new Error(
          `Element "${elementId}" has non-finite computed "${key}"`
        )
      }
      return result
    }

    const getWorldPosition = (elementId: string) => {
      let currentId = elementId
      let x = 0
      let y = 0
      const visited = new Set<string>()

      while (currentId) {
        if (visited.has(currentId)) {
          throw new Error(`Hierarchy cycle reaches "${currentId}"`)
        }
        visited.add(currentId)
        const element = sceneTree?.getElementById?.(currentId)
        if (!element) {
          throw new Error(`Missing hierarchy element "${currentId}"`)
        }
        if (element.get?.('type') === 'workspace') {
          break
        }
        const computed = element.getAllComputedData?.() ?? {}
        x += getFiniteNumber(computed.x, currentId, 'x')
        y += getFiniteNumber(computed.y, currentId, 'y')
        currentId = String(element.get?.('parentId') ?? '')
      }

      return { x, y }
    }

    return Array.from(elements.entries())
      .filter(([, element]) => element.get?.('type') !== 'workspace')
      .map(([id, element]) => {
        const computed = element.getAllComputedData?.() ?? {}
        const type = String(element.get?.('type') ?? '')
        const children =
          type === 'group' ? element.get?.('children') : undefined
        return {
          id,
          type,
          parentId: String(element.get?.('parentId') ?? ''),
          children: Array.isArray(children) ? [...children] : undefined,
          local: {
            x: getFiniteNumber(computed.x, id, 'x'),
            y: getFiniteNumber(computed.y, id, 'y'),
            width: getFiniteNumber(computed.width, id, 'width'),
            height: getFiniteNumber(computed.height, id, 'height')
          },
          world: getWorldPosition(id)
        }
      })
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

const getOwnerSave = (page: Page) =>
  page.evaluate(() => ({
    sceneTree: window.__Core__.deps.sceneTree.save(),
    props: window.__Core__.deps.props.save()
  }))

const getUndoDepth = (page: Page) =>
  page.evaluate(
    () =>
      (
        window.__Core__.deps.factory.transact as unknown as {
          undoStack?: unknown[]
        }
      ).undoStack?.length ?? 0
  )

const capturePublicationOutcomes = (page: Page) =>
  page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __remoteRestoreOutcomes?: unknown[]
    }
    runtime.__remoteRestoreOutcomes = []
    const handle = window.__AsyraCollaboration__ as
      | (NonNullable<Window['__AsyraCollaboration__']> & {
          observePublicationOutcomes(
            subscriber: (outcome: {
              direction: string
              status: string
              publicationId: string
              error?: unknown
            }) => void
          ): () => void
        })
      | undefined
    handle?.observePublicationOutcomes((outcome) => {
      runtime.__remoteRestoreOutcomes?.push({
        ...outcome,
        ...(outcome.error instanceof Error
          ? {
              error: {
                name: outcome.error.name,
                message: outcome.error.message,
                stack: outcome.error.stack
              }
            }
          : {})
      })
    })
  })

const getPublicationOutcomes = (page: Page) =>
  page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __remoteRestoreOutcomes?: unknown[]
        }
      ).__remoteRestoreOutcomes ?? []
  )

const getVectorTopologySummary = (page: Page) =>
  page.evaluate(() => {
    const elements = window.__Core__?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) return null
    const vector = Array.from(elements.values()).find(
      (element) => element.get?.('type') === 'vector'
    )
    const computed = vector?.getAllComputedData?.()
    if (!computed) return null
    const points = Object.values(computed.points ?? {}) as {
      kind?: unknown
    }[]
    const segments = Object.values(computed.segments ?? {}) as {
      inControlId?: unknown
      outControlId?: unknown
    }[]
    return {
      anchorCount: points.filter((point) => point.kind === 'anchor').length,
      controlCount: points.filter((point) => point.kind === 'control').length,
      segmentCount: segments.length,
      curvedSegmentCount: segments.filter(
        (segment) => segment.inControlId || segment.outControlId
      ).length
    }
  })

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

test('two real Asyra Design windows converge while connected and reconnect live-only', async ({
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

    const unmovedSnapshot = await getCanonicalSnapshot(first)
    await dragSelectedElementBy(first, 90, 55, 12)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getElementCount(isolated)).toBe(0)

    const movedSnapshot = await getCanonicalSnapshot(first)
    expect(movedSnapshot).not.toEqual(unmovedSnapshot)
    await undo(first)
    await expect
      .poll(() => getCanonicalSnapshot(first))
      .toEqual(unmovedSnapshot)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(unmovedSnapshot)

    await redo(first)
    await expect.poll(() => getCanonicalSnapshot(first)).toEqual(movedSnapshot)
    await expect.poll(() => getCanonicalSnapshot(second)).toEqual(movedSnapshot)

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
    expect(await getElementCount(second)).toBe(0)

    await createRectangle(first, 0.72, 0.62)
    await expect.poll(() => getElementCount(first)).toBe(2)
    await expect.poll(() => getElementCount(second)).toBe(1)

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

test('remote undo restores an exact nested Group with and without local tombstones', async ({
  browser
}, testInfo) => {
  test.setTimeout(120_000)
  const fileId = `restore-${Date.now()}-${testInfo.workerIndex}`
  const senderContext = await browser.newContext()
  const tombstoneContext = await browser.newContext()
  const sender = await senderContext.newPage()
  const tombstonePeer = await tombstoneContext.newPage()
  let noTombstonePeer: Page | undefined

  try {
    await Promise.all([
      sender.goto(collaborationUrl(fileId)),
      tombstonePeer.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(sender), waitForAppReady(tombstonePeer)])
    await Promise.all([
      waitForCollaboration(sender),
      waitForCollaboration(tombstonePeer)
    ])

    await createRectangle(sender, 0.28, 0.32)
    await createRectangle(sender, 0.48, 0.45)
    await createRectangle(sender, 0.68, 0.58)
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(3)
    const rectangleIds = (await getCanonicalSnapshot(sender)).map(
      ({ id }) => id
    )
    const innerGroupId = await groupLayerIds(sender, rectangleIds.slice(0, 2))
    await sender.getByTestId(`layers-group-toggle-${innerGroupId}`).click()
    const outerGroupId = await groupLayerIds(sender, [
      rectangleIds[2],
      innerGroupId
    ])
    await sender.getByTestId(`layers-group-toggle-${innerGroupId}`).click()
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(5)
    await expect
      .poll(() => getOwnerSave(tombstonePeer))
      .toEqual(await getOwnerSave(sender))

    const expectedOwnerSave = await getOwnerSave(sender)
    const expectedLayerIds = await getLayerIds(sender)
    const expectedElementIds = (await getCanonicalSnapshot(sender)).map(
      ({ id }) => id
    )

    await layerRow(sender, outerGroupId).click()
    await sender.keyboard.press('Delete')
    await expect.poll(() => getElementCount(sender)).toBe(0)
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(0)
    await expect
      .poll(() =>
        tombstonePeer.evaluate((expectedSceneCount) => {
          const sceneTree = window.__Core__.deps.sceneTree as unknown as {
            _deletedMap?: Map<string, unknown>
          }
          const props = window.__Core__.deps.props as unknown as {
            _deletedMap?: Map<string, unknown>
          }
          return (
            sceneTree._deletedMap?.size === expectedSceneCount &&
            (props._deletedMap?.size ?? 0) > 0
          )
        }, expectedElementIds.length)
      )
      .toBe(true)

    await expect
      .poll(() =>
        sender.evaluate(
          ({ storageKey, removedGroupId }) => {
            const raw = localStorage.getItem(storageKey)
            if (!raw) return false
            const saved = JSON.parse(raw) as {
              sceneTree?: { elements?: Record<string, unknown> }
            }
            return !saved.sceneTree?.elements?.[removedGroupId]
          },
          {
            storageKey: `FILE:${fileId}`,
            removedGroupId: outerGroupId
          }
        )
      )
      .toBe(true)

    noTombstonePeer = await senderContext.newPage()
    await noTombstonePeer.goto(collaborationUrl(fileId))
    await waitForAppReady(noTombstonePeer)
    await waitForCollaboration(noTombstonePeer)
    expect(await getElementCount(noTombstonePeer)).toBe(0)
    expect(
      await noTombstonePeer.evaluate(() => {
        const sceneTree = window.__Core__.deps.sceneTree as unknown as {
          _deletedMap?: Map<string, unknown>
        }
        const props = window.__Core__.deps.props as unknown as {
          _deletedMap?: Map<string, unknown>
        }
        return {
          scene: sceneTree._deletedMap?.size ?? 0,
          props: props._deletedMap?.size ?? 0
        }
      })
    ).toEqual({ scene: 0, props: 0 })

    await noTombstonePeer.evaluate(() => {
      const runtime = globalThis as typeof globalThis & {
        __remoteRestorePublications?: unknown[]
        __remoteRestoreCommits?: unknown[]
      }
      runtime.__remoteRestorePublications = []
      runtime.__remoteRestoreCommits = []
      window.__Core__.deps.factory.subscribeToSharedPublication((publication) =>
        runtime.__remoteRestorePublications?.push(publication)
      )
      window.__Core__.deps.factory.subscribeToTransactionStatus((status) => {
        if (status.origin === 'remote' && status.status === 'committed') {
          runtime.__remoteRestoreCommits?.push(status)
        }
      })
    })
    const noTombstoneUndoDepth = await getUndoDepth(noTombstonePeer)
    await Promise.all([
      capturePublicationOutcomes(tombstonePeer),
      capturePublicationOutcomes(noTombstonePeer)
    ])

    await undo(sender)
    await expect
      .poll(async () => (await getPublicationOutcomes(tombstonePeer)).length)
      .toBeGreaterThan(0)
    const remoteOutcomes = {
      tombstone: await getPublicationOutcomes(tombstonePeer),
      noTombstone: await getPublicationOutcomes(noTombstonePeer)
    }
    const processFailures = Object.values(remoteOutcomes)
      .flat()
      .filter(
        (outcome) =>
          typeof outcome === 'object' &&
          outcome !== null &&
          'status' in outcome &&
          outcome.status === 'process-failed'
      )
    if (processFailures.length > 0) {
      throw new Error(
        `Remote restore processing failed:\n${JSON.stringify(
          remoteOutcomes,
          null,
          2
        )}`
      )
    }

    try {
      await expect
        .poll(() => getOwnerSave(tombstonePeer))
        .toEqual(expectedOwnerSave)
    } catch (error) {
      await testInfo.attach('remote-restore-outcomes.json', {
        body: JSON.stringify(
          {
            tombstone: await getPublicationOutcomes(tombstonePeer),
            noTombstone: await getPublicationOutcomes(noTombstonePeer)
          },
          null,
          2
        ),
        contentType: 'application/json'
      })
      throw error
    }
    await expect
      .poll(() => getOwnerSave(noTombstonePeer as Page))
      .toEqual(expectedOwnerSave)
    await expect
      .poll(() => getLayerIds(tombstonePeer))
      .toEqual(expectedLayerIds)
    await expect
      .poll(() => getLayerIds(noTombstonePeer as Page))
      .toEqual(expectedLayerIds)
    await expect
      .poll(() => getCanonicalSnapshot(noTombstonePeer as Page))
      .toEqual(await getCanonicalSnapshot(sender))

    expect(await getUndoDepth(noTombstonePeer)).toBe(noTombstoneUndoDepth)
    expect(
      await noTombstonePeer.evaluate(() => {
        const runtime = globalThis as typeof globalThis & {
          __remoteRestorePublications?: unknown[]
          __remoteRestoreCommits?: unknown[]
        }
        return {
          publications: runtime.__remoteRestorePublications?.length ?? -1,
          commits: runtime.__remoteRestoreCommits?.length ?? -1
        }
      })
    ).toEqual({ publications: 0, commits: 1 })

    for (const elementId of expectedElementIds) {
      expect(
        await getCanonicalRenderVisibility(noTombstonePeer, elementId)
      ).not.toBeNull()
    }

    await redo(sender)
    await expect.poll(() => getElementCount(sender)).toBe(0)
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(0)
    await expect.poll(() => getElementCount(noTombstonePeer as Page)).toBe(0)
    expect(await getUndoDepth(noTombstonePeer)).toBe(noTombstoneUndoDepth)
  } finally {
    await Promise.all([senderContext.close(), tombstoneContext.close()])
  }
})

test('remote Group redo preserves exact hierarchy and world geometry', async ({
  browser
}, testInfo) => {
  const fileId = `group-redo-${Date.now()}-${testInfo.workerIndex}`
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

    await createRectangle(first, 0.3, 0.35)
    await createRectangle(first, 0.62, 0.55)
    await expect.poll(() => getElementCount(second)).toBe(2)

    const rectangleIds = (await getCanonicalSnapshot(first)).map(({ id }) => id)
    const ungroupedGeometry = await getCanonicalHierarchyGeometry(first)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(ungroupedGeometry)

    const groupId = await groupLayerIds(first, rectangleIds)
    await expect.poll(() => getElementCount(second)).toBe(3)
    const groupedGeometry = await getCanonicalHierarchyGeometry(first)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(groupedGeometry)

    await undo(first)
    await expect.poll(() => getElementCount(first)).toBe(2)
    await expect.poll(() => getElementCount(second)).toBe(2)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(first))
      .toEqual(ungroupedGeometry)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(ungroupedGeometry)

    await redo(first)
    await expect.poll(() => getElementCount(first)).toBe(3)
    await expect.poll(() => getElementCount(second)).toBe(3)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(first))
      .toEqual(groupedGeometry)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(groupedGeometry)

    const remoteGroup = (await getCanonicalHierarchyGeometry(second)).find(
      ({ id }) => id === groupId
    )
    expect(remoteGroup).toEqual(
      groupedGeometry.find(({ id }) => id === groupId)
    )
    await Promise.all([
      first.screenshot({
        path: testInfo.outputPath('group-redo-source.png'),
        fullPage: true
      }),
      second.screenshot({
        path: testInfo.outputPath('group-redo-peer.png'),
        fullPage: true
      })
    ])
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
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

    const remotePoint = await second.evaluate(({ vectorId, pointId }) => {
      const point = window.__Core__?.deps?.sceneTree
        ?.getElementById?.(vectorId)
        ?.getAllComputedData?.()?.points?.[pointId]
      return point ? { x: point.x, y: point.y } : null
    }, before)
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

test('pen drag-to-add publishes real topology and curve frames before pointer-up', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-pen-drag-${Date.now()}-${testInfo.workerIndex}`
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

    const firstPoint = await getCanvasPosition(first, 0.3, 0.3)
    const secondPoint = await getCanvasPosition(first, 0.48, 0.45)
    const curveHandle = await getCanvasPosition(first, 0.58, 0.34)

    await first.keyboard.press('p')
    await first.mouse.click(firstPoint.x, firstPoint.y)
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 1,
        segmentCount: 0
      })
    const undoDepthBeforeDrag = await first.evaluate(
      () => window.__Core__?.deps?.factory?.transact?.undoStack?.length ?? 0
    )

    await first.mouse.move(secondPoint.x, secondPoint.y)
    await first.mouse.down()
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 2,
        segmentCount: 1
      })

    await first.mouse.move(curveHandle.x, curveHandle.y, { steps: 8 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getVectorTopologySummary(second)).toMatchObject({
      anchorCount: 2,
      controlCount: 3,
      segmentCount: 1,
      curvedSegmentCount: 1
    })

    await first.mouse.up()
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(
      await first.evaluate(
        () => window.__Core__?.deps?.factory?.transact?.undoStack?.length ?? 0
      )
    ).toBe(undoDepthBeforeDrag + 1)

    await undo(first)
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 1,
        controlCount: 0,
        segmentCount: 0,
        curvedSegmentCount: 0
      })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await redo(first)
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 2,
        controlCount: 3,
        segmentCount: 1,
        curvedSegmentCount: 1
      })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})
