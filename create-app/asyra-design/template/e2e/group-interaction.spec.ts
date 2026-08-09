import { expect, test, type Page } from '@playwright/test'
import {
  createTestDocumentURL,
  createRectangle,
  getCanvasPosition,
  getCoreDocumentDigest,
  getContentsPanel,
  getCurrentDocumentFileId,
  getPersistedDocumentDigest,
  getSelectedElementClientCenter,
  pressGroupCommandShortcut,
  redo,
  resetCanvas,
  undo,
  waitForAppReady
} from './test-utils'

const layerRow = (page: Page, elementId: string) =>
  page.getByTestId(`element-item-${elementId}`)

const getLayerIds = async (page: Page): Promise<string[]> =>
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
    async () =>
      (
        await import('../src/testing/runtime-access')
      ).core?.deps.selection.getElementSelectionIds() ?? []
  )

const getHoveredId = (page: Page): Promise<string | null> =>
  page.evaluate(
    async () =>
      (await import('../src/testing/runtime-access')).core?.getSystemProperty(
        'hoveredElementId'
      ) ?? null
  )

const groupLayerIds = async (
  page: Page,
  elementIds: readonly string[]
): Promise<string> => {
  await layerRow(page, elementIds[0]).click()
  if (elementIds.length > 1) {
    await page.keyboard.down('Shift')
    try {
      for (const elementId of elementIds.slice(1)) {
        await layerRow(page, elementId).click()
      }
    } finally {
      await page.keyboard.up('Shift')
    }
  }

  await pressGroupCommandShortcut(page, 'group')
  await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
  return (await getSelectedIds(page))[0]
}

const getWorldPositions = (
  page: Page,
  elementIds: string[]
): Promise<Record<string, { x: number; y: number }>> =>
  page.evaluate(async (ids) => {
    const core = (await import('../src/testing/runtime-access')).core
    const positions: Record<string, { x: number; y: number }> = {}
    for (const elementId of ids) {
      let currentId = elementId
      let x = 0
      let y = 0
      const visited = new Set<string>()
      while (currentId) {
        if (visited.has(currentId)) {
          throw new Error(`Hierarchy cycle reaches "${currentId}"`)
        }
        visited.add(currentId)
        const element = core.deps.sceneTree.getElementById(currentId)
        if (!element) {
          throw new Error(`Missing hierarchy element "${currentId}"`)
        }
        if (element.get('type') === 'workspace') {
          break
        }
        const computed = element.getAllComputedData()
        x += Number(computed.x)
        y += Number(computed.y)
        currentId = String(element.get('parentId') ?? '')
      }
      positions[elementId] = { x, y }
    }
    return positions
  }, elementIds)

const getCanonicalGeometries = (
  page: Page,
  elementIds: string[]
): Promise<
  Record<string, { x: number; y: number; width: number; height: number }>
> =>
  page.evaluate(async (ids) => {
    const sceneTree = (await import('../src/testing/runtime-access')).core.deps
      .sceneTree
    const geometries: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {}
    for (const elementId of ids) {
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        throw new Error(`Missing hierarchy element "${elementId}"`)
      }
      const computed = element.getAllComputedData()
      geometries[elementId] = {
        x: Number(computed.x),
        y: Number(computed.y),
        width: Number(computed.width),
        height: Number(computed.height)
      }
    }
    return geometries
  }, elementIds)

test.describe('Asyra Design Group interaction MVP', () => {
  test('undoes and redoes a basic two-rectangle Group without losing either rectangle', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.35, 0.42)
    await createRectangle(page, 0.65, 0.58)

    const initialIds = await getLayerIds(page)
    expect(initialIds).toHaveLength(2)
    const initialWorldPositions = await getWorldPositions(page, initialIds)
    const initialHierarchy = await page.evaluate(async (elementIds) => {
      const sceneTree = (await import('../src/testing/runtime-access')).core
        .deps.sceneTree
      const workspaceId = String(sceneTree.workspace)
      const workspace = sceneTree.getElementById(workspaceId)
      return {
        workspaceId,
        workspaceChildren: [
          ...((workspace?.get('children') as string[] | undefined) ?? [])
        ],
        parentIds: elementIds.map((elementId) =>
          String(sceneTree.getElementById(elementId)?.get('parentId') ?? '')
        )
      }
    }, initialIds)
    expect(initialHierarchy.workspaceChildren).toEqual(initialIds)
    expect(initialHierarchy.parentIds).toEqual(
      initialIds.map(() => initialHierarchy.workspaceId)
    )
    await page.evaluate(async (elementIds) => {
      const core = (await import('../src/testing/runtime-access')).core
      ;(
        window as typeof window & {
          __BasicGroupUndoIdentity?: {
            sceneElements: unknown[]
            renderElements: unknown[]
          }
        }
      ).__BasicGroupUndoIdentity = {
        sceneElements: elementIds.map((elementId) =>
          core.deps.sceneTree.getElementById(elementId)
        ),
        renderElements: elementIds.map((elementId) =>
          core.deps.render.getElementById(elementId)
        )
      }
    }, initialIds)

    const groupId = await groupLayerIds(page, initialIds)
    expect(groupId).not.toBe(initialIds[0])
    expect(groupId).not.toBe(initialIds[1])
    await expect
      .poll(() =>
        page.evaluate(
          async ({ createdGroupId, childIds }) => {
            const sceneTree = (await import('../src/testing/runtime-access'))
              .core.deps.sceneTree
            const group = sceneTree.getElementById(createdGroupId)
            return {
              groupExists: Boolean(group),
              groupChildren: [
                ...((group?.get('children') as string[] | undefined) ?? [])
              ],
              childParentIds: childIds.map((childId) =>
                String(sceneTree.getElementById(childId)?.get('parentId') ?? '')
              )
            }
          },
          { createdGroupId: groupId, childIds: initialIds }
        )
      )
      .toEqual({
        groupExists: true,
        groupChildren: initialIds,
        childParentIds: initialIds.map(() => groupId)
      })

    await undo(page)

    await expect.poll(() => getLayerIds(page)).toEqual(initialIds)
    await expect.poll(() => getSelectedIds(page)).toEqual(initialIds)
    const undoHierarchy = await page.evaluate(
      async ({ createdGroupId, elementIds, workspaceId }) => {
        const sceneTree = (await import('../src/testing/runtime-access')).core
          .deps.sceneTree
        const workspace = sceneTree.getElementById(workspaceId)
        return {
          groupExists: Boolean(sceneTree.getElementById(createdGroupId)),
          elementExists: elementIds.map((elementId) =>
            Boolean(sceneTree.getElementById(elementId))
          ),
          workspaceChildren: [
            ...((workspace?.get('children') as string[] | undefined) ?? [])
          ],
          parentIds: elementIds.map((elementId) =>
            String(sceneTree.getElementById(elementId)?.get('parentId') ?? '')
          )
        }
      },
      {
        createdGroupId: groupId,
        elementIds: initialIds,
        workspaceId: initialHierarchy.workspaceId
      }
    )
    expect(undoHierarchy).toEqual({
      groupExists: false,
      elementExists: initialIds.map(() => true),
      workspaceChildren: initialHierarchy.workspaceChildren,
      parentIds: initialHierarchy.parentIds
    })
    expect(await getWorldPositions(page, initialIds)).toEqual(
      initialWorldPositions
    )
    const undoIdentity = await page.evaluate(async (elementIds) => {
      const core = (await import('../src/testing/runtime-access')).core
      const initial = (
        window as typeof window & {
          __BasicGroupUndoIdentity?: {
            sceneElements: unknown[]
            renderElements: unknown[]
          }
        }
      ).__BasicGroupUndoIdentity
      if (!initial) {
        throw new Error('Missing basic Group undo identity evidence')
      }
      return {
        scene: elementIds.map(
          (elementId, index) =>
            core.deps.sceneTree.getElementById(elementId) ===
            initial.sceneElements[index]
        ),
        render: elementIds.map(
          (elementId, index) =>
            core.deps.render.getElementById(elementId) ===
            initial.renderElements[index]
        ),
        renderParentIds: elementIds.map(
          (elementId) =>
            core.deps.render.getElementById(elementId)?.parent?.label ?? null
        )
      }
    }, initialIds)
    expect(undoIdentity).toEqual({
      scene: initialIds.map(() => true),
      render: initialIds.map(() => true),
      renderParentIds: initialIds.map(() => initialHierarchy.workspaceId)
    })

    await redo(page)

    await expect.poll(() => getSelectedIds(page)).toEqual([groupId])
    await expect(layerRow(page, groupId)).toBeVisible()
    expect(await getWorldPositions(page, initialIds)).toEqual(
      initialWorldPositions
    )
    await page.evaluate(async () => {
      delete (
        window as typeof window & {
          __BasicGroupUndoIdentity?: unknown
        }
      ).__BasicGroupUndoIdentity
    })
  })

  test('creates in the hierarchy-target Group or explicit workspace root from mouse down', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.48, 0.46)
    const rectId = (await getSelectedIds(page))[0]
    const rectCenter = await getSelectedElementClientCenter(page)
    expect(rectCenter).not.toBeNull()
    if (!rectCenter) {
      return
    }

    const innerGroupId = await groupLayerIds(page, [rectId])
    const outerGroupId = await groupLayerIds(page, [innerGroupId])
    expect(outerGroupId).not.toBe(innerGroupId)

    const nestedCreatePosition = {
      x: rectCenter.x + 1,
      y: rectCenter.y
    }
    const nestedCreateEndPosition = {
      x: nestedCreatePosition.x + 60,
      y: nestedCreatePosition.y + 40
    }
    const nestedCreateWorkspacePosition = await page.evaluate(
      async ({ x, y }) =>
        (
          await import('../src/testing/runtime-access')
        ).core.deps.render.getMousePosInWorkspace({
          clientX: x,
          clientY: y
        }),
      nestedCreatePosition
    )

    await page.keyboard.press('r')
    await page.keyboard.down('Meta')
    try {
      await page.mouse.move(nestedCreatePosition.x, nestedCreatePosition.y)
      await page.mouse.down()
      await page.mouse.move(
        nestedCreateEndPosition.x,
        nestedCreateEndPosition.y,
        { steps: 2 }
      )
      await page.mouse.up()
    } finally {
      await page.keyboard.up('Meta')
    }

    const nestedCreatedId = (await getSelectedIds(page))[0]
    const nestedCreatedParentId = await page.evaluate(
      async (elementId) =>
        String(
          (await import('../src/testing/runtime-access')).core.deps.sceneTree
            .getElementById(elementId)
            ?.get('parentId') ?? ''
        ),
      nestedCreatedId
    )
    expect(nestedCreatedParentId).toBe(innerGroupId)

    const nestedWorldPosition = (
      await getWorldPositions(page, [nestedCreatedId])
    )[nestedCreatedId]
    expect(nestedWorldPosition.x).toBeCloseTo(nestedCreateWorkspacePosition.x)
    expect(nestedWorldPosition.y).toBeCloseTo(nestedCreateWorkspacePosition.y)
    const nestedCreatedBounds = await page.evaluate(async (elementId) => {
      const computed =
        (await import('../src/testing/runtime-access')).core.deps.sceneTree
          .getElementById(elementId)
          ?.getAllComputedData() ?? {}
      return {
        width: Number(computed.width),
        height: Number(computed.height)
      }
    }, nestedCreatedId)
    expect(nestedCreatedBounds.width).toBeCloseTo(60)
    expect(nestedCreatedBounds.height).toBeCloseTo(40)

    await undo(page)
    await expect
      .poll(() =>
        page.evaluate(
          async (elementId) =>
            Boolean(
              (
                await import('../src/testing/runtime-access')
              ).core.deps.sceneTree.getElementById(elementId)
            ),
          nestedCreatedId
        )
      )
      .toBe(false)

    await redo(page)
    await expect
      .poll(() =>
        page.evaluate(
          async (elementId) =>
            String(
              (
                await import('../src/testing/runtime-access')
              ).core.deps.sceneTree
                .getElementById(elementId)
                ?.get('parentId') ?? ''
            ),
          nestedCreatedId
        )
      )
      .toBe(innerGroupId)

    const emptyPosition = await getCanvasPosition(page, 0.9, 0.12)
    await page.keyboard.press('r')
    await page.mouse.click(emptyPosition.x, emptyPosition.y)

    const workspaceCreatedId = (await getSelectedIds(page))[0]
    const workspaceParent = await page.evaluate(async (elementId) => {
      const sceneTree = (await import('../src/testing/runtime-access')).core
        .deps.sceneTree
      return {
        actual: String(
          sceneTree.getElementById(elementId)?.get('parentId') ?? ''
        ),
        workspace: String(sceneTree.workspace)
      }
    }, workspaceCreatedId)
    expect(workspaceParent.actual).toBe(workspaceParent.workspace)
    expect(workspaceParent.actual).not.toBe(outerGroupId)
  })

  test('resolves canvas hover and click from selection parent scope or Meta leaf access', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.32, 0.34)
    const firstId = (await getSelectedIds(page))[0]
    const firstCenter = await getSelectedElementClientCenter(page)
    await createRectangle(page, 0.68, 0.58)
    const secondId = (await getSelectedIds(page))[0]
    const secondCenter = await getSelectedElementClientCenter(page)

    expect(firstCenter).not.toBeNull()
    expect(secondCenter).not.toBeNull()
    if (!firstCenter || !secondCenter) {
      return
    }

    const firstGroupId = await groupLayerIds(page, [firstId])
    await page.getByTestId(`layers-group-toggle-${firstGroupId}`).click()
    const secondGroupId = await groupLayerIds(page, [secondId])
    await page.getByTestId(`layers-group-toggle-${secondGroupId}`).click()
    const outerGroupId = await groupLayerIds(page, [
      firstGroupId,
      secondGroupId
    ])
    await page.getByTestId(`layers-group-toggle-${firstGroupId}`).click()
    await page.getByTestId(`layers-group-toggle-${secondGroupId}`).click()

    const emptyPosition = await getCanvasPosition(page, 0.92, 0.12)
    await page.mouse.click(emptyPosition.x, emptyPosition.y)
    await expect.poll(() => getSelectedIds(page)).toEqual([])

    await page.mouse.move(firstCenter.x, firstCenter.y)
    await expect.poll(() => getHoveredId(page)).toBe(outerGroupId)

    await page.keyboard.down('Meta')
    try {
      await page.mouse.move(firstCenter.x + 1, firstCenter.y)
      await expect.poll(() => getHoveredId(page)).toBe(firstId)
    } finally {
      await page.keyboard.up('Meta')
    }

    await layerRow(page, firstId).click()
    await expect.poll(() => getSelectedIds(page)).toEqual([firstId])

    await page.mouse.move(secondCenter.x, secondCenter.y)
    await expect.poll(() => getHoveredId(page)).toBeNull()

    await page.mouse.move(firstCenter.x, firstCenter.y)
    await expect.poll(() => getHoveredId(page)).toBe(firstId)

    await page.keyboard.down('Meta')
    try {
      await page.mouse.move(secondCenter.x + 1, secondCenter.y)
      await expect.poll(() => getHoveredId(page)).toBe(secondId)
      await page.mouse.click(secondCenter.x, secondCenter.y)
      await expect.poll(() => getSelectedIds(page)).toEqual([secondId])
    } finally {
      await page.keyboard.up('Meta')
    }
  })

  test('prioritizes the projected multi-selection box over Group canvas targeting', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.3, 0.46)
    const leftId = (await getSelectedIds(page))[0]
    await createRectangle(page, 0.7, 0.46)
    const rightId = (await getSelectedIds(page))[0]
    await createRectangle(page, 0.5, 0.46)
    const middleId = (await getSelectedIds(page))[0]
    const middleCenter = await getSelectedElementClientCenter(page)
    expect(middleCenter).not.toBeNull()
    if (!middleCenter) {
      return
    }

    const middleGroupId = await groupLayerIds(page, [middleId])
    await layerRow(page, leftId).click()
    await page.keyboard.down('Shift')
    try {
      await layerRow(page, rightId).click()
    } finally {
      await page.keyboard.up('Shift')
    }
    await expect.poll(() => getSelectedIds(page)).toEqual([leftId, rightId])

    const elementIds = [leftId, rightId, middleId, middleGroupId]
    const before = await getWorldPositions(page, elementIds)
    const dragEnd = {
      x: middleCenter.x + 48,
      y: middleCenter.y + 24
    }
    const workspaceDelta = await page.evaluate(
      async ({ start, end }) => {
        const render = (await import('../src/testing/runtime-access')).core.deps
          .render
        const startWorkspace = render.getMousePosInWorkspace({
          clientX: start.x,
          clientY: start.y
        })
        const endWorkspace = render.getMousePosInWorkspace({
          clientX: end.x,
          clientY: end.y
        })
        return {
          x: endWorkspace.x - startWorkspace.x,
          y: endWorkspace.y - startWorkspace.y
        }
      },
      { start: middleCenter, end: dragEnd }
    )

    await page.mouse.move(middleCenter.x, middleCenter.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 4 })
    await page.mouse.up()

    await expect.poll(() => getSelectedIds(page)).toEqual([leftId, rightId])
    const after = await getWorldPositions(page, elementIds)
    for (const selectedId of [leftId, rightId]) {
      expect(after[selectedId].x).toBeCloseTo(
        before[selectedId].x + workspaceDelta.x,
        5
      )
      expect(after[selectedId].y).toBeCloseTo(
        before[selectedId].y + workspaceDelta.y,
        5
      )
    }
    for (const stationaryId of [middleId, middleGroupId]) {
      expect(after[stationaryId]).toEqual(before[stationaryId])
    }
  })

  test('moves only a nested child without a visible jump or eager Group normalization', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.48, 0.46)
    const rectId = (await getSelectedIds(page))[0]
    const innerGroupId = await groupLayerIds(page, [rectId])
    const outerGroupId = await groupLayerIds(page, [innerGroupId])

    await layerRow(page, rectId).click()
    await expect.poll(() => getSelectedIds(page)).toEqual([rectId])
    const rectCenter = await getSelectedElementClientCenter(page)
    expect(rectCenter).not.toBeNull()
    if (!rectCenter) {
      return
    }

    const elementIds = [rectId, innerGroupId, outerGroupId]
    const before = await getWorldPositions(page, elementIds)
    const canonicalBefore = await getCanonicalGeometries(page, elementIds)
    const dragEnd = {
      x: rectCenter.x + 48,
      y: rectCenter.y + 32
    }
    const workspaceDelta = await page.evaluate(
      async ({ start, end }) => {
        const render = (await import('../src/testing/runtime-access')).core.deps
          .render
        const startWorkspace = render.getMousePosInWorkspace({
          clientX: start.x,
          clientY: start.y
        })
        const endWorkspace = render.getMousePosInWorkspace({
          clientX: end.x,
          clientY: end.y
        })
        return {
          x: endWorkspace.x - startWorkspace.x,
          y: endWorkspace.y - startWorkspace.y
        }
      },
      { start: rectCenter, end: dragEnd }
    )

    await page.mouse.move(rectCenter.x, rectCenter.y)
    await page.mouse.down()
    await expect.poll(() => getSelectedIds(page)).toEqual([rectId])
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 4 })
    await expect.poll(() => getSelectedIds(page)).toEqual([rectId])
    await page.mouse.up()

    await expect.poll(() => getSelectedIds(page)).toEqual([rectId])

    await expect
      .poll(async () => (await getWorldPositions(page, [rectId]))[rectId].x)
      .toBeCloseTo(before[rectId].x + workspaceDelta.x, 5)
    await expect
      .poll(async () => (await getWorldPositions(page, [rectId]))[rectId].y)
      .toBeCloseTo(before[rectId].y + workspaceDelta.y, 5)
    for (const groupId of [innerGroupId, outerGroupId]) {
      await expect
        .poll(async () => (await getWorldPositions(page, [groupId]))[groupId])
        .toEqual(before[groupId])
    }

    const canonicalAfter = await getCanonicalGeometries(page, elementIds)
    expect(canonicalAfter[rectId].x).toBeCloseTo(
      canonicalBefore[rectId].x + workspaceDelta.x,
      5
    )
    expect(canonicalAfter[rectId].y).toBeCloseTo(
      canonicalBefore[rectId].y + workspaceDelta.y,
      5
    )
    expect(canonicalAfter[rectId].width).toBe(canonicalBefore[rectId].width)
    expect(canonicalAfter[rectId].height).toBe(canonicalBefore[rectId].height)
    for (const groupId of [innerGroupId, outerGroupId]) {
      expect(canonicalAfter[groupId]).toEqual(canonicalBefore[groupId])
    }
  })

  test('groups, nests, projects, restores, ungroups, and persists through product commands', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.25, 0.3)
    await createRectangle(page, 0.5, 0.45)
    await createRectangle(page, 0.7, 0.62)

    const initialIds = await getLayerIds(page)
    expect(initialIds).toHaveLength(3)
    const worldBefore = await getWorldPositions(page, initialIds)

    await page.evaluate(async (ids) => {
      const core = (await import('../src/testing/runtime-access')).core
      ;(
        window as typeof window & {
          __GroupInteractionIdentity?: {
            elements: unknown[]
            renderNodes: unknown[]
          }
        }
      ).__GroupInteractionIdentity = {
        elements: ids.map((id) => core.deps.sceneTree.getElementById(id)),
        renderNodes: ids.map((id) => core.deps.render.getElementById(id))
      }
    }, initialIds)

    await layerRow(page, initialIds[0]).click()
    await page.keyboard.down('Shift')
    try {
      await layerRow(page, initialIds[1]).click()
    } finally {
      await page.keyboard.up('Shift')
    }
    await pressGroupCommandShortcut(page, 'group')

    await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
    const firstGroupId = (await getSelectedIds(page))[0]
    await expect(
      page.getByTestId(`layers-group-toggle-${firstGroupId}`)
    ).toBeVisible()
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    await page.evaluate(
      async ({ groupId, siblingId }) => {
        ;(await import('../src/testing/runtime-access')).core.selectElements([
          groupId,
          siblingId
        ])
      },
      { groupId: firstGroupId, siblingId: initialIds[2] }
    )
    await pressGroupCommandShortcut(page, 'group')

    await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
    const nestedGroupId = (await getSelectedIds(page))[0]
    expect(nestedGroupId).not.toBe(firstGroupId)

    await expect(layerRow(page, nestedGroupId)).toHaveAttribute(
      'data-layer-depth',
      '0'
    )
    await expect(layerRow(page, firstGroupId)).toHaveAttribute(
      'data-layer-depth',
      '1'
    )
    await expect(layerRow(page, initialIds[0])).toHaveAttribute(
      'data-layer-depth',
      '2'
    )
    await expect(layerRow(page, initialIds[2])).toHaveAttribute(
      'data-layer-depth',
      '1'
    )

    await page.getByTestId(`layers-group-toggle-${firstGroupId}`).click()
    await expect(layerRow(page, initialIds[0])).toHaveCount(0)
    expect(await getSelectedIds(page)).toEqual([nestedGroupId])
    await page.getByTestId(`layers-group-toggle-${firstGroupId}`).click()
    await expect(layerRow(page, initialIds[0])).toBeVisible()

    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)
    const identity = await page.evaluate(async (ids) => {
      const core = (await import('../src/testing/runtime-access')).core
      const saved = (
        window as typeof window & {
          __GroupInteractionIdentity?: {
            elements: unknown[]
            renderNodes: unknown[]
          }
        }
      ).__GroupInteractionIdentity
      if (!saved) {
        throw new Error('Missing Group interaction identity evidence')
      }
      return {
        scene: ids.every(
          (id, index) =>
            core.deps.sceneTree.getElementById(id) === saved.elements[index]
        ),
        render: ids.every(
          (id, index) =>
            core.deps.render.getElementById(id) === saved.renderNodes[index]
        )
      }
    }, initialIds)
    expect(identity).toEqual({ scene: true, render: true })

    await undo(page)
    await expect
      .poll(() => getSelectedIds(page))
      .toEqual([firstGroupId, initialIds[2]])
    const ungroupProjection = await page.evaluate(async (removedGroupId) => {
      const core = (await import('../src/testing/runtime-access')).core
      return {
        canonicalExists: Boolean(
          core.deps.sceneTree.getElementById(removedGroupId)
        ),
        flattenedIds: core.getUIProperty<string[]>('flattenedElementIds') ?? []
      }
    }, nestedGroupId)
    expect(ungroupProjection.canonicalExists).toBe(false)
    expect(ungroupProjection.flattenedIds).not.toContain(nestedGroupId)
    await expect(layerRow(page, nestedGroupId)).toHaveCount(0)

    await redo(page)
    await expect.poll(() => getSelectedIds(page)).toEqual([nestedGroupId])
    await expect(layerRow(page, nestedGroupId)).toBeVisible()

    await layerRow(page, nestedGroupId).click()
    await pressGroupCommandShortcut(page, 'ungroup')
    await expect
      .poll(() => getSelectedIds(page))
      .toEqual([firstGroupId, initialIds[2]])
    const ungroupedProjection = await page.evaluate(async (removedGroupId) => {
      const core = (await import('../src/testing/runtime-access')).core
      return {
        canonicalExists: Boolean(
          core.deps.sceneTree.getElementById(removedGroupId)
        ),
        flattenedIds: core.getUIProperty<string[]>('flattenedElementIds') ?? []
      }
    }, nestedGroupId)
    expect(ungroupedProjection.canonicalExists).toBe(false)
    expect(ungroupedProjection.flattenedIds).not.toContain(nestedGroupId)
    await expect(layerRow(page, nestedGroupId)).toHaveCount(0)

    await page.keyboard.up('Shift')
    await layerRow(page, firstGroupId).click()
    await expect.poll(() => getSelectedIds(page)).toEqual([firstGroupId])
    await page.keyboard.press('Meta+Shift+G')
    await expect
      .poll(() => getSelectedIds(page))
      .toEqual(initialIds.slice(0, 2))
    await expect(layerRow(page, firstGroupId)).toHaveCount(0)
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)
    const finalDocumentDigest = await getCoreDocumentDigest(page)
    await expect
      .poll(() => getPersistedDocumentDigest(getCurrentDocumentFileId(page)))
      .toEqual(finalDocumentDigest)

    await page.evaluate(async () => {
      delete (
        window as typeof window & {
          __GroupInteractionIdentity?: unknown
        }
      ).__GroupInteractionIdentity
    })

    await page.reload()
    await waitForAppReady(page)
    expect(await getLayerIds(page)).toEqual(initialIds)
    expect(await getSelectedIds(page)).toEqual([])
    expect(
      await page.evaluate(
        async ({ elementIds, removedGroupIds }) => {
          const { core } = await import('../src/testing/runtime-access')
          return {
            elementsExist: elementIds.every((id) =>
              Boolean(core.deps.sceneTree.getElementById(id))
            ),
            groupsExist: removedGroupIds.some((id) =>
              Boolean(core.deps.sceneTree.getElementById(id))
            )
          }
        },
        {
          elementIds: initialIds,
          removedGroupIds: [firstGroupId, nestedGroupId]
        }
      )
    ).toEqual({ elementsExist: true, groupsExist: false })
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)
  })
})
