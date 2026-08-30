import { expect, test } from '@playwright/test'
import {
  clickCanvas,
  createTestDocumentURL,
  createRectangle,
  createVectorPath,
  getCoreDocumentDigest,
  getCanvasPosition,
  getCurrentDocumentFileId,
  getElementCount,
  getPersistedDocumentDigest,
  getSelectedElementClientCenter,
  hasSelectedElement,
  pressGroupCommandShortcut,
  redo,
  resetCanvas,
  undo,
  waitForAppReady
} from './test-utils'

test.describe('Delete Selected Element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('Delete key removes the single selected element', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    expect(await hasSelectedElement(page)).toBe(true)

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          const ids = core?.deps?.selection?.getElementSelectionIds?.() ?? []
          return ids.length
        })
      })
      .toBe(0)
  })

  test('Delete removes a complete Group subtree, keeps canvas selection usable, and persists the final document', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))

    await createRectangle(page, 0.42, 0.42)
    const subtree = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const childId = core.deps.selection.getElementSelectionIds()[0]
      return { childId }
    })
    await pressGroupCommandShortcut(page, 'group')
    const groupId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core.deps.selection.getElementSelectionIds()[0] as string
    })

    await page.keyboard.press('Delete')
    await expect
      .poll(() =>
        page.evaluate(
          async ({ childId, deletedGroupId }) => {
            const core = (await import('../src/testing/runtime-access')).core
            return {
              childExists: Boolean(core.deps.sceneTree.getElementById(childId)),
              flattenedIds:
                core.getUIProperty<string[]>('flattenedElementIds') ?? [],
              groupExists: Boolean(
                core.deps.sceneTree.getElementById(deletedGroupId)
              ),
              selectionIds:
                core.deps.selection.getElementSelectionIds() as string[]
            }
          },
          { childId: subtree.childId, deletedGroupId: groupId }
        )
      )
      .toEqual({
        childExists: false,
        flattenedIds: [],
        groupExists: false,
        selectionIds: []
      })

    await undo(page)
    await expect
      .poll(() =>
        page.evaluate(
          async ({ childId, deletedGroupId }) => {
            const core = (await import('../src/testing/runtime-access')).core
            return {
              childExists: Boolean(core.deps.sceneTree.getElementById(childId)),
              groupExists: Boolean(
                core.deps.sceneTree.getElementById(deletedGroupId)
              ),
              selectionIds:
                core.deps.selection.getElementSelectionIds() as string[]
            }
          },
          { childId: subtree.childId, deletedGroupId: groupId }
        )
      )
      .toEqual({
        childExists: true,
        groupExists: true,
        selectionIds: [groupId]
      })

    await redo(page)
    await expect
      .poll(() =>
        page.evaluate(
          async ({ childId, deletedGroupId }) => {
            const core = (await import('../src/testing/runtime-access')).core
            return {
              childExists: Boolean(core.deps.sceneTree.getElementById(childId)),
              groupExists: Boolean(
                core.deps.sceneTree.getElementById(deletedGroupId)
              ),
              selectionIds:
                core.deps.selection.getElementSelectionIds() as string[]
            }
          },
          { childId: subtree.childId, deletedGroupId: groupId }
        )
      )
      .toEqual({
        childExists: false,
        groupExists: false,
        selectionIds: []
      })

    await createRectangle(page, 0.72, 0.48)
    const survivingId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core.deps.selection.getElementSelectionIds()[0] as string
    })
    const survivingCenter = await getSelectedElementClientCenter(page)
    expect(survivingCenter).not.toBeNull()
    if (!survivingCenter) {
      return
    }
    const emptyCanvasPoint = await getCanvasPosition(page, 0.08, 0.08)
    await expect
      .poll(() =>
        page.evaluate(
          async ({ center, emptyPoint, expectedSurvivorId }) => {
            const core = (await import('../src/testing/runtime-access')).core
            return {
              elementDataMapIds: Object.keys(
                core.getUIProperty('elementDataMap') ?? {}
              ),
              emptyPointHitId:
                core.deps.render.getElementIdAtClientPos(emptyPoint) ?? null,
              flattenedIds:
                core.getUIProperty<string[]>('flattenedElementIds') ?? [],
              renderHitId:
                core.deps.render.getElementIdAtClientPos(center) ?? null,
              survivorExists: Boolean(
                core.deps.sceneTree.getElementById(expectedSurvivorId)
              )
            }
          },
          {
            center: survivingCenter,
            emptyPoint: emptyCanvasPoint,
            expectedSurvivorId: survivingId
          }
        )
      )
      .toEqual({
        elementDataMapIds: [survivingId],
        emptyPointHitId: null,
        flattenedIds: [survivingId],
        renderHitId: survivingId,
        survivorExists: true
      })
    await page.mouse.click(emptyCanvasPoint.x, emptyCanvasPoint.y)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core.deps.selection.getElementSelectionIds() as string[]
        })
      )
      .toEqual([])
    await page.mouse.click(survivingCenter.x, survivingCenter.y)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core.deps.selection.getElementSelectionIds() as string[]
        })
      )
      .toEqual([survivingId])

    const finalDocumentDigest = await getCoreDocumentDigest(page)
    await expect
      .poll(() => getPersistedDocumentDigest(getCurrentDocumentFileId(page)))
      .toEqual(finalDocumentDigest)

    await page.reload()
    await waitForAppReady(page)
    const afterReload = await page.evaluate(
      async ({ childId, deletedGroupId, expectedSurvivorId }) => {
        const core = (await import('../src/testing/runtime-access')).core
        return {
          childExists: Boolean(core.deps.sceneTree.getElementById(childId)),
          groupExists: Boolean(
            core.deps.sceneTree.getElementById(deletedGroupId)
          ),
          survivorExists: Boolean(
            core.deps.sceneTree.getElementById(expectedSurvivorId)
          )
        }
      },
      {
        childId: subtree.childId,
        deletedGroupId: groupId,
        expectedSurvivorId: survivingId
      }
    )
    expect(afterReload).toEqual({
      childExists: false,
      groupExists: false,
      survivorExists: true
    })
    expect(pageErrors).toEqual([])
  })

  test('Backspace key removes the single selected element', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.4, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Backspace')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
  })

  test('Delete key is a no-op when nothing is selected', async ({ page }) => {
    await createRectangle(page, 0.35, 0.35)
    const countAfterCreate = await getElementCount(page)

    await clickCanvas(page, 0.85, 0.85)
    expect(await hasSelectedElement(page)).toBe(false)

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(countAfterCreate)
  })

  test('delete action supports undo and redo', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text())
      }
    })
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.5, 0.45)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(await hasSelectedElement(page)).toBe(false)

    await undo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    expect(await hasSelectedElement(page)).toBe(true)

    await redo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(await hasSelectedElement(page)).toBe(false)
    expect(pageErrors).toEqual([])
  })

  test('validation failure restores deleted element and props exactly', async ({
    page
  }) => {
    await createRectangle(page, 0.48, 0.42)
    const before = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectionIds = core.deps.selection.getElementSelectionIds()
      const elementId = selectionIds[0]
      const element = core.deps.sceneTree.getElementById(elementId)
      const propIds = Object.values(element.save().props ?? {}).filter(
        (id): id is string => typeof id === 'string'
      )
      const propComponents = propIds.map((id) =>
        core.deps.props.getPropertyById(id)
      )
      const { testRuntimeState } = await import('../src/testing/runtime-access')
      testRuntimeState.set('delete-rollback-identity', {
        element,
        elementId,
        propComponents,
        propIds,
        selectionIds
      })
      const statuses = testRuntimeState.set<string[]>(
        'delete-rollback-statuses',
        []
      )
      core.deps.factory.subscribeToTransactionStatus((status) =>
        statuses.push(status.status)
      )
      core.deps.factory.registerTransactionValidator(
        'delete-rollback-e2e',
        () => ({
          valid: false,
          code: 'forced-delete-failure',
          message: 'Force delete rollback'
        })
      )
      return {
        data: await core.save(),
        elementId,
        propIds,
        selectionIds
      }
    })

    await page.keyboard.press('Delete')
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { testRuntimeState } =
            await import('../src/testing/runtime-access')
          return (
            testRuntimeState.get<string[]>('delete-rollback-statuses') ?? []
          )
        })
      )
      .toContain('rolled-back')

    const after = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const { testRuntimeState } = await import('../src/testing/runtime-access')
      const identity = testRuntimeState.get<{
        element: unknown
        elementId: string
        propComponents: readonly unknown[]
        propIds: readonly string[]
      }>('delete-rollback-identity')
      if (!identity) throw new Error('Delete rollback identity is unavailable')
      const restoredElement = core.deps.sceneTree.getElementById(
        identity.elementId
      )
      return {
        data: await core.save(),
        sameElement: restoredElement === identity.element,
        samePropComponents: identity.propIds.every(
          (id: string, index: number) =>
            core.deps.props.getPropertyById(id) ===
            identity.propComponents[index]
        ),
        selectionIds: core.deps.selection.getElementSelectionIds()
      }
    })
    expect(after.data).toEqual(before.data)
    expect(after.sameElement).toBe(true)
    expect(after.samePropComponents).toBe(true)
    expect(after.selectionIds).toEqual(before.selectionIds)
  })

  test('redo delete after sequential deletions does not throw selection-layer error', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(String(error))
    })

    const initialCount = await getElementCount(page)

    await page.keyboard.press('r')
    await clickCanvas(page, 0.3, 0.3)
    const firstElement = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core.deps.selection.getElementSelectionIds()[0] as string
    })
    const firstElementCenter = await getSelectedElementClientCenter(page)
    expect(firstElementCenter).not.toBeNull()
    if (!firstElementCenter) {
      return
    }

    await page.keyboard.press('o')
    await clickCanvas(page, 0.55, 0.5)
    const secondElement = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core.deps.selection.getElementSelectionIds()[0] as string
    })
    const secondElementCenter = await getSelectedElementClientCenter(page)
    expect(secondElementCenter).not.toBeNull()
    if (!secondElementCenter) {
      return
    }

    await page.keyboard.press('v')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)

    await page.mouse.click(firstElementCenter.x, firstElementCenter.y)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core.deps.selection.getElementSelectionIds() as string[]
        })
      )
      .toEqual([firstElement])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.mouse.click(secondElementCenter.x, secondElementCenter.y)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core.deps.selection.getElementSelectionIds() as string[]
        })
      )
      .toEqual([secondElement])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)

    await undo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await redo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(
      pageErrors.find((error) =>
        error.includes(
          "Cannot read properties of undefined (reading 'getBounds')"
        )
      )
    ).toBeUndefined()
  })

  test('delete re-evaluates hovered target instead of blindly clearing it', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('r')
    await clickCanvas(page, 0.42, 0.42)
    await page.keyboard.press('r')
    await clickCanvas(page, 0.42, 0.42)
    await page.keyboard.press('v')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)

    const overlappingPos = await getCanvasPosition(page, 0.42, 0.42)
    const runtime = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null

      return {
        selectedId
      }
    })

    expect(runtime.selectedId).not.toBeNull()
    if (!runtime.selectedId) {
      return
    }

    await page.evaluate(
      async ({ deletedId, x, y }) => {
        const core = (await import('../src/testing/runtime-access')).core
        core.setSystemProperty('mousePosition', { x, y })
        core.setSystemProperty('mouseDelta', { x: 0, y: 0 })
        core.setSystemProperty('mouseButton', 'none')
        core.setSystemProperty('mouseDown', false)
        core.setSystemProperty('mouseDragging', false)
        core.setSystemProperty('hoveredElementId', deletedId)
      },
      {
        deletedId: runtime.selectedId,
        x: overlappingPos.x + 10,
        y: overlappingPos.y + 10
      }
    )

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await expect
      .poll(async () => {
        return page.evaluate(async (deletedId) => {
          const core = (await import('../src/testing/runtime-access')).core
          const hoveredId =
            core?.getSystemProperty?.('hoveredElementId') ?? null
          return hoveredId !== deletedId
        }, runtime.selectedId)
      })
      .toBe(true)
  })

  test('Delete removes selected anchor in path-editing mode and splits interior path', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    const anchorPositions = [
      { x: 0.24, y: 0.28 },
      { x: 0.33, y: 0.33 },
      { x: 0.42, y: 0.38 },
      { x: 0.51, y: 0.43 },
      { x: 0.6, y: 0.48 }
    ]

    await page.keyboard.press('p')
    for (const position of anchorPositions) {
      await clickCanvas(page, position.x, position.y)
    }
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const beforeDelete = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const pathEditingVectorId =
        core?.getSystemProperty?.('pathEditingVectorId') ?? null
      if (!pathEditingVectorId) {
        return null
      }

      const element =
        core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const networks = Object.values(computed.networks ?? {})
      const primaryNetwork = networks[0] as
        { pointIds?: string[]; segmentIds?: string[] } | undefined

      return {
        vectorId: pathEditingVectorId,
        pointIds: primaryNetwork?.pointIds ?? [],
        segmentIds: primaryNetwork?.segmentIds ?? [],
        middlePointId: primaryNetwork?.pointIds?.[2] ?? null
      }
    })

    expect(beforeDelete).not.toBeNull()
    if (!beforeDelete || !beforeDelete.middlePointId) {
      return
    }

    await page.keyboard.press('v')
    const middlePointPos = await getCanvasPosition(
      page,
      anchorPositions[2].x,
      anchorPositions[2].y
    )
    await page.mouse.move(middlePointPos.x, middlePointPos.y)
    await page.mouse.click(middlePointPos.x, middlePointPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          return {
            pointId: selected?.pointId ?? null,
            target: selected?.target ?? null
          }
        })
      })
      .toMatchObject({
        pointId: beforeDelete.middlePointId,
        target: 'anchor'
      })

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await expect
      .poll(async () => {
        return page.evaluate(async (before) => {
          const core = (await import('../src/testing/runtime-access')).core
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')
          const element = core?.deps?.sceneTree?.getElementById?.(
            before.vectorId
          )
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]
          const anchorPointIds = networks.flatMap(
            (network) => network.pointIds ?? []
          )
          const segmentIds = Object.keys(computed.segments ?? {})
          const oldSegmentIds = new Set(before.segmentIds)
          const hasReusedSegmentId = segmentIds.some((id) =>
            oldSegmentIds.has(id)
          )
          const networkPointCounts = networks.map(
            (network) => (network.pointIds ?? []).length
          )
          const networkSegmentCounts = networks.map(
            (network) => (network.segmentIds ?? []).length
          )

          return (
            pathEditingVectorId === before.vectorId &&
            selectedPoint == null &&
            !anchorPointIds.includes(before.middlePointId) &&
            anchorPointIds.length === before.pointIds.length - 1 &&
            networkPointCounts.length === 2 &&
            networkPointCounts.every((count) => count === 2) &&
            networkSegmentCounts.length === 2 &&
            networkSegmentCounts.every((count) => count === 1) &&
            segmentIds.length === 2 &&
            !hasReusedSegmentId
          )
        }, beforeDelete)
      })
      .toBe(true)
  })

  test('Delete is blocked in path-editing mode', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createVectorPath(page, 0.3, 0.3, 0.2, 0.15)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.35, 0.35)
    await page.keyboard.press('Enter')

    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .not.toBeNull()

    const pathEditingVectorId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core?.getSystemProperty?.('pathEditingVectorId') ?? null
    })

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .toBe(pathEditingVectorId)
  })

  test('Delete is blocked when path-editing mode is true even without editing vector id', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.5, 0.5)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      core.setSystemProperty('pathEditingVectorId', null)
      core.setSystemProperty('pathEditingMode', true)
    })

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('Delete is allowed when path-editing mode is false even if editing vector id exists', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.55, 0.55)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const selectedId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const id = core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      core.setSystemProperty('pathEditingVectorId', id)
      core.setSystemProperty('pathEditingMode', false)
      return id
    })

    expect(selectedId).not.toBeNull()
    if (!selectedId) {
      return
    }

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
  })
})
