import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  getContentsPanel,
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
    () => window.__Core__?.deps.selection.getElementSelectionIds() ?? []
  )

const getWorldPositions = (
  page: Page,
  elementIds: string[]
): Promise<Record<string, { x: number; y: number }>> =>
  page.evaluate((ids) => {
    const core = window.__Core__
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

test.describe('Asyra Design Group interaction MVP', () => {
  test('groups, nests, projects, restores, reloads, and ungroups through product commands', async ({
    page
  }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)

    await createRectangle(page, 0.25, 0.3)
    await createRectangle(page, 0.5, 0.45)
    await createRectangle(page, 0.7, 0.62)

    const initialIds = await getLayerIds(page)
    expect(initialIds).toHaveLength(3)
    const worldBefore = await getWorldPositions(page, initialIds)

    await page.evaluate((ids) => {
      const core = window.__Core__
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
    await expect(page.getByTestId('layers-group-button')).toBeEnabled()
    await page.getByTestId('layers-group-button').click()

    await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
    const firstGroupId = (await getSelectedIds(page))[0]
    await expect(
      page.getByTestId(`layers-group-toggle-${firstGroupId}`)
    ).toBeVisible()
    expect(await getWorldPositions(page, initialIds)).toEqual(worldBefore)

    await page.evaluate(
      ({ groupId, siblingId }) => {
        window.__Core__.selectElements([groupId, siblingId])
      },
      { groupId: firstGroupId, siblingId: initialIds[2] }
    )
    await page.keyboard.press('Meta+G')

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
    const identity = await page.evaluate((ids) => {
      const core = window.__Core__
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
    const ungroupProjection = await page.evaluate((removedGroupId) => {
      const core = window.__Core__
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

    const beforeReload = await page.evaluate(async () => {
      const data = await window.__Core__.save()
      return data.sceneTree
    })
    await expect
      .poll(() =>
        page.evaluate(
          (groupId) => localStorage.getItem('FILE')?.includes(groupId) ?? false,
          nestedGroupId
        )
      )
      .toBe(true)

    await page.reload()
    await waitForAppReady(page)
    const afterReload = await page.evaluate(async () => {
      const data = await window.__Core__.save()
      return data.sceneTree
    })
    expect(afterReload).toEqual(beforeReload)
    await expect(layerRow(page, nestedGroupId)).toBeVisible()
    await expect(layerRow(page, initialIds[0])).toHaveAttribute(
      'data-layer-depth',
      '2'
    )

    await layerRow(page, nestedGroupId).click()
    await expect(page.getByTestId('layers-ungroup-button')).toBeEnabled()
    await page.getByTestId('layers-ungroup-button').click()
    await expect
      .poll(() => getSelectedIds(page))
      .toEqual([firstGroupId, initialIds[2]])
    const reloadedUngroupProjection = await page.evaluate((removedGroupId) => {
      const core = window.__Core__
      return {
        canonicalExists: Boolean(
          core.deps.sceneTree.getElementById(removedGroupId)
        ),
        flattenedIds: core.getUIProperty<string[]>('flattenedElementIds') ?? []
      }
    }, nestedGroupId)
    expect(reloadedUngroupProjection.canonicalExists).toBe(false)
    expect(reloadedUngroupProjection.flattenedIds).not.toContain(nestedGroupId)
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

    await page.evaluate(() => {
      delete (
        window as typeof window & {
          __GroupInteractionIdentity?: unknown
        }
      ).__GroupInteractionIdentity
    })
  })
})
