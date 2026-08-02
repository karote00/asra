import { expect, test, type Page } from '@playwright/test'
import {
  createTestDocumentURL,
  createRectangle,
  getCoreDocumentDigest,
  getContentsPanel,
  getCurrentDocumentStorageKey,
  getPersistedDocumentDigest,
  pressGroupCommandShortcut,
  redo,
  resetCanvas,
  undo,
  waitForAppReady
} from './test-utils'

const layerRow = (page: Page, elementId: string) =>
  page.getByTestId(`element-item-${elementId}`)

const getVisibleLayerIds = async (page: Page): Promise<string[]> =>
  getContentsPanel(page)
    .locator('[data-layer-element="true"]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-layer-element-id') ?? '')
    )

const getSelectedIds = (page: Page): Promise<string[]> =>
  page.evaluate(
    async () =>
      (
        await import('../src/testing/runtime-access')
      ).core?.deps.selection.getElementSelectionIds() ?? []
  )

const getChildren = (page: Page, parentId: string): Promise<string[]> =>
  page.evaluate(async (id) => {
    const element = (
      await import('../src/testing/runtime-access')
    ).core.deps.sceneTree.getElementById(id)
    return [...((element?.get('children') as string[] | undefined) ?? [])]
  }, parentId)

const getWorldPositions = (
  page: Page,
  elementIds: string[]
): Promise<Record<string, { x: number; y: number }>> =>
  page.evaluate(async (ids) => {
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
        const element = (
          await import('../src/testing/runtime-access')
        ).core.deps.sceneTree.getElementById(currentId)
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

const dragLayerToRow = async (
  page: Page,
  sourceId: string,
  targetId: string,
  zone: 'before' | 'inside' | 'after'
) => {
  const source = layerRow(page, sourceId)
  const target = layerRow(page, targetId)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('Layer drag rows must be visible')
  }
  let targetY = targetBox.y + targetBox.height / 2
  if (zone === 'before') {
    targetY = targetBox.y + 2
  }
  if (zone === 'after') {
    targetY = targetBox.y + targetBox.height - 2
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetY, {
    steps: 8
  })
  await expect(target).toHaveAttribute('data-layer-drop-state', zone)
  await page.mouse.up()
  await expect(getContentsPanel(page)).toHaveAttribute(
    'data-layer-move-state',
    'idle'
  )
}

const dragLayerToWorkspace = async (page: Page, sourceId: string) => {
  const sourceBox = await layerRow(page, sourceId).boundingBox()
  const workspace = getContentsPanel(page).locator(
    '[data-layer-drop-workspace="true"]'
  )
  const workspaceBox = await workspace.boundingBox()
  if (!sourceBox || !workspaceBox) {
    throw new Error('Layer source and workspace target must be visible')
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    workspaceBox.x + workspaceBox.width / 2,
    workspaceBox.y + workspaceBox.height - 12,
    { steps: 8 }
  )
  await expect(workspace).toHaveAttribute('data-layer-drop-state', 'workspace')
  await page.mouse.up()
}

test.describe('Asyra Design Layer Tree reparent and reorder', () => {
  test('moves canonical identities through Layers pointer interactions without canvas jump', async ({
    page
  }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.25, 0.3)
    await createRectangle(page, 0.5, 0.45)
    await createRectangle(page, 0.7, 0.62)

    const initialIds = await getVisibleLayerIds(page)
    expect(initialIds).toHaveLength(3)
    const [firstId, secondId, thirdId] = initialIds
    const worldBefore = await getWorldPositions(page, initialIds)

    await page.evaluate(async (ids) => {
      const core = (await import('../src/testing/runtime-access')).core
      ;(
        window as typeof window & {
          __LayerMoveIdentity?: {
            scene: unknown[]
            render: unknown[]
          }
        }
      ).__LayerMoveIdentity = {
        scene: ids.map((id) => core.deps.sceneTree.getElementById(id)),
        render: ids.map((id) => core.deps.render.getElementById(id))
      }
    }, initialIds)

    await dragLayerToRow(page, firstId, thirdId, 'after')
    await expect
      .poll(() => getVisibleLayerIds(page))
      .toEqual([secondId, thirdId, firstId])
    await expect.poll(() => getSelectedIds(page)).toEqual([firstId])
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    await undo(page)
    await expect.poll(() => getVisibleLayerIds(page)).toEqual(initialIds)
    await redo(page)
    await page.keyboard.up('Shift')
    await expect
      .poll(() => getVisibleLayerIds(page))
      .toEqual([secondId, thirdId, firstId])

    await layerRow(page, secondId).click()
    await expect.poll(() => getSelectedIds(page)).toEqual([secondId])
    await page.keyboard.down('Shift')
    try {
      await layerRow(page, thirdId).click()
    } finally {
      await page.keyboard.up('Shift')
    }
    await expect.poll(() => getSelectedIds(page)).toEqual([secondId, thirdId])
    await pressGroupCommandShortcut(page, 'group')
    await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
    const groupId = (await getSelectedIds(page))[0]
    await expect(layerRow(page, groupId)).toBeVisible()
    expect(await getChildren(page, groupId)).toEqual([secondId, thirdId])

    await page.getByTestId(`layers-group-toggle-${groupId}`).click()
    await expect(layerRow(page, secondId)).toHaveCount(0)
    await dragLayerToRow(page, firstId, groupId, 'inside')
    await expect(
      page.getByTestId(`layers-group-toggle-${groupId}`)
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(layerRow(page, firstId)).toHaveAttribute(
      'data-layer-depth',
      '1'
    )
    expect(await getChildren(page, groupId)).toEqual([
      secondId,
      thirdId,
      firstId
    ])
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    await dragLayerToWorkspace(page, firstId)
    await expect(layerRow(page, firstId)).toHaveAttribute(
      'data-layer-depth',
      '0'
    )
    expect(await getChildren(page, groupId)).toEqual([secondId, thirdId])
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    await dragLayerToRow(page, firstId, groupId, 'inside')
    await layerRow(page, secondId).click()
    await page.keyboard.down('Shift')
    try {
      await layerRow(page, thirdId).click()
    } finally {
      await page.keyboard.up('Shift')
    }
    await dragLayerToRow(page, secondId, firstId, 'before')
    expect(await getChildren(page, groupId)).toEqual([
      secondId,
      thirdId,
      firstId
    ])
    await dragLayerToRow(page, secondId, firstId, 'after')
    expect(await getChildren(page, groupId)).toEqual([
      firstId,
      secondId,
      thirdId
    ])

    const identity = await page.evaluate(async (ids) => {
      const core = (await import('../src/testing/runtime-access')).core
      const stored = (
        window as typeof window & {
          __LayerMoveIdentity?: {
            scene: unknown[]
            render: unknown[]
          }
        }
      ).__LayerMoveIdentity
      if (!stored) {
        throw new Error('Missing Layer move identity evidence')
      }
      return {
        scene: ids.every(
          (id, index) =>
            core.deps.sceneTree.getElementById(id) === stored.scene[index]
        ),
        render: ids.every(
          (id, index) =>
            core.deps.render.getElementById(id) === stored.render[index]
        )
      }
    }, initialIds)
    expect(identity).toEqual({ scene: true, render: true })
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    const orderBeforeCancel = await getChildren(page, groupId)
    const sourceBox = await layerRow(page, firstId).boundingBox()
    const targetBox = await layerRow(page, thirdId).boundingBox()
    if (!sourceBox || !targetBox) {
      throw new Error('Cancellation rows must be visible')
    }
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 2, {
      steps: 4
    })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    expect(await getChildren(page, groupId)).toEqual(orderBeforeCancel)
    await expect(getContentsPanel(page)).toHaveAttribute(
      'data-layer-move-state',
      'idle'
    )

    const finalDocumentDigest = await getCoreDocumentDigest(page)
    await expect
      .poll(() =>
        getPersistedDocumentDigest(page, getCurrentDocumentStorageKey(page))
      )
      .toEqual(finalDocumentDigest)
    await page.evaluate(async () => {
      delete (
        window as typeof window & {
          __LayerMoveIdentity?: unknown
        }
      ).__LayerMoveIdentity
    })

    await page.reload()
    await waitForAppReady(page)
    expect(await getSelectedIds(page)).toEqual([])
    await expect
      .poll(() => getChildren(page, groupId))
      .toEqual([firstId, secondId, thirdId])
    expect(
      await page.evaluate(
        async (ids) => {
          const { core } = await import('../src/testing/runtime-access')
          return ids.every((id) =>
            Boolean(core.deps.sceneTree.getElementById(id))
          )
        },
        [...initialIds, groupId]
      )
    ).toBe(true)
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)
  })
})
