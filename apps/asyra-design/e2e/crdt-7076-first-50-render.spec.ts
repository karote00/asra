import { expect, test } from '@playwright/test'

test('renders the checked-in crdt-7076 first-50 sample from existing Vector values', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000)
  const renderFailures: string[] = []
  const startupErrors: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error') {
      startupErrors.push(text)
    }
    if (
      message.type() === 'error' &&
      (text.includes('[Preset Vector]') ||
        text.includes('[RenderLayer] Element render strategy failed') ||
        text.includes('canonical local Vector geometry'))
    ) {
      renderFailures.push(text)
    }
  })
  page.on('pageerror', (error) => {
    renderFailures.push(error.message)
  })

  await page.goto('/?fileId=crdt-7076-first-50-sample')
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { getCollaborationMode } = await import(
          '../src/render-app/collaboration-mode'
        )
        return getCollaborationMode()
      })
    )
    .toBeNull()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 })
  await page.waitForFunction(
    async () => {
      const { core } = await import('../src/testing/runtime-access')
      const document = await core.save()
      return Object.keys(document.sceneTree.elements).length === 50
    },
    undefined,
    { timeout: 60_000 }
  )

  const initial = await page.evaluate(async () => {
    const { core } = await import('../src/testing/runtime-access')
    const document = await core.save()
    const elements = Object.values(document.sceneTree.elements)
    const vectorElements = elements.filter(
      (element) => element.type === 'vector'
    )
    const summaries = vectorElements.map((element) => {
      const computed =
        core.deps?.sceneTree
          ?.getElementById?.(element.id)
          ?.getAllComputedData?.() ?? {}
      return {
        id: element.id,
        pointCoordinateSpace: computed.pointCoordinateSpace,
        pointCount: Object.keys(computed.points ?? {}).length,
        rendered: Boolean(core.deps?.render?.getElementById?.(element.id))
      }
    })
    return {
      sceneTreeRecordCount: elements.length,
      vectorCount: summaries.length,
      pointCount: summaries.reduce(
        (total, vector) => total + vector.pointCount,
        0
      ),
      denseVectorCount: summaries.filter(({ pointCount }) => pointCount > 1_000)
        .length,
      workspaceCoordinateCount: summaries.filter(
        ({ pointCoordinateSpace }) => pointCoordinateSpace === 'workspace'
      ).length,
      renderedVectorCount: summaries.filter(({ rendered }) => rendered).length,
      densestVectorId: [...summaries].sort(
        (left, right) => right.pointCount - left.pointCount
      )[0]?.id
    }
  })

  expect(initial, `Startup errors: ${startupErrors.join(' | ')}`).toMatchObject(
    {
      sceneTreeRecordCount: 50,
      vectorCount: 48,
      pointCount: 22_928,
      denseVectorCount: 5,
      workspaceCoordinateCount: 48,
      renderedVectorCount: 48
    }
  )
  expect(initial.densestVectorId).toBeTruthy()
  if (!initial.densestVectorId) {
    throw new Error('The first-50 sample must contain at least one Vector')
  }

  const moved = await page.evaluate(async (elementId) => {
    const { core, elementApis } = await import('../src/testing/runtime-access')
    const element = core.deps?.sceneTree?.getElementById?.(elementId)
    const before = element?.getAllComputedData?.() ?? {}
    const points = before.points
    const pointSamples = Object.values(points ?? {})
      .slice(0, 3)
      .map((point) => ({ x: point.x, y: point.y }))
    const firstAnchorEntry = Object.entries(points ?? {}).find(
      ([, point]) => point.kind === 'anchor'
    )
    elementApis.setElementPositions(
      {
        [elementId]: {
          x: (before.x ?? 0) + 24,
          y: (before.y ?? 0) - 12
        }
      },
      { undoable: false }
    )
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    const after = element?.getAllComputedData?.() ?? {}
    const afterSamples = Object.values(after.points ?? {})
      .slice(0, 3)
      .map((point) => ({ x: point.x, y: point.y }))
    const renderElement = core.deps?.render?.getElementById?.(elementId)
    const projectedAnchorHit = firstAnchorEntry
      ? elementApis.getVectorEditablePointAtWorkspacePos(
          elementId,
          {
            x: firstAnchorEntry[1].x + 24,
            y: firstAnchorEntry[1].y - 12
          },
          1
        )
      : null
    return {
      pointsIdentityPreserved: points === after.points,
      pointSamplesPreserved:
        JSON.stringify(pointSamples) === JSON.stringify(afterSamples),
      x: after.x,
      y: after.y,
      renderX: renderElement?.x,
      renderY: renderElement?.y,
      firstAnchorId: firstAnchorEntry?.[0],
      projectedAnchorHitId: projectedAnchorHit?.point.id
    }
  }, initial.densestVectorId)

  expect(moved.pointsIdentityPreserved).toBe(true)
  expect(moved.pointSamplesPreserved).toBe(true)
  expect(moved.renderX).toBeCloseTo(moved.x)
  expect(moved.renderY).toBeCloseTo(moved.y)
  expect(moved.projectedAnchorHitId).toBe(moved.firstAnchorId)
  expect(renderFailures).toEqual([])

  const edited = await page.evaluate(async (elementId) => {
    const { core, elementApis } = await import('../src/testing/runtime-access')
    const element = core.deps?.sceneTree?.getElementById?.(elementId)
    const before = element?.getAllComputedData?.() ?? {}
    const visibleAnchor = elementApis.getVectorAnchorPoints(elementId)[0]
    if (!visibleAnchor) {
      throw new Error('The dense Vector must expose an editable anchor')
    }
    const storedBefore = before.points?.[visibleAnchor.id]
    const target = {
      x: visibleAnchor.x + 5,
      y: visibleAnchor.y + 3
    }
    elementApis.updateVectorAnchorPointPosition(
      elementId,
      visibleAnchor.id,
      target,
      { undoable: false, skipResult: true }
    )
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    const after = element?.getAllComputedData?.() ?? {}
    const storedAfter = after.points?.[visibleAnchor.id]
    if (!storedBefore || !storedAfter) {
      throw new Error('The edited anchor must remain in stored Vector data')
    }
    const projectedHit = elementApis.getVectorEditablePointAtWorkspacePos(
      elementId,
      target,
      1
    )
    return {
      pointCount: Object.keys(after.points ?? {}).length,
      storedDeltaX: storedAfter?.x - storedBefore?.x,
      storedDeltaY: storedAfter?.y - storedBefore?.y,
      editedPointId: visibleAnchor.id,
      projectedHitId: projectedHit?.point.id
    }
  }, initial.densestVectorId)

  expect(edited.pointCount).toBeGreaterThan(1_000)
  expect(edited.storedDeltaX).toBeCloseTo(5)
  expect(edited.storedDeltaY).toBeCloseTo(3)
  expect(edited.projectedHitId).toBe(edited.editedPointId)
  expect(renderFailures).toEqual([])

  const screenshotPath = testInfo.outputPath('crdt-7076-first-50-render.png')
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: 'disabled'
  })
  await testInfo.attach('crdt-7076-first-50-render', {
    path: screenshotPath,
    contentType: 'image/png'
  })
})
