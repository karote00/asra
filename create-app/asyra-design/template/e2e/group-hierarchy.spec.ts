import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  createTestDocumentURL,
  getContentsPanel,
  getPropertiesPanel,
  resetCanvas,
  waitForAppReady
} from './test-utils'

interface WorldRectangle {
  x: number
  y: number
  width: number
  height: number
}

test.describe('Group hierarchy product projection', () => {
  test('preserves live geometry and identity across an official Group reparent', async ({
    page
  }, testInfo) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)

    const setup = await page.evaluate(async () => {
      const { core, elementApis, hierarchyApis, testRuntimeState } =
        await import('../src/testing/runtime-access')
      if (!core.deps.sceneTree.currentWorkspace) {
        core.sceneTreeInit()
      }

      const firstId = elementApis.createElement(
        {
          type: 'rect',
          clientPosition: { x: 440, y: 220 },
          width: 120,
          height: 80
        },
        { undoable: false }
      )
      const secondId = elementApis.createElement(
        {
          type: 'rect',
          clientPosition: { x: 680, y: 360 },
          width: 100,
          height: 100
        },
        { undoable: false }
      )
      if (!firstId || !secondId) {
        throw new Error('Failed to create Gate 3 visual review elements')
      }

      const sourceGroup = hierarchyApis.groupElements([firstId], {
        undoable: false
      })
      const targetGroup = hierarchyApis.groupElements([secondId], {
        undoable: false
      })
      core.selectElements([], { undoable: false })

      const getWorldRectangle = (elementId: string) => {
        let currentId = elementId
        let x = 0
        let y = 0
        let width = 0
        let height = 0
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
          if (currentId === elementId) {
            width = Number(computed.width)
            height = Number(computed.height)
          }
          currentId = String(element.get('parentId') ?? '')
        }

        return { x, y, width, height }
      }

      const review = {
        firstId,
        secondId,
        sourceGroupId: sourceGroup.groupId,
        targetGroupId: targetGroup.groupId,
        firstElement: core.deps.sceneTree.getElementById(firstId),
        firstRenderNode: core.deps.render.getElementById(firstId)
      }
      testRuntimeState.set('gate3-group-visual-review', review)

      return {
        firstId,
        secondId,
        sourceGroupId: sourceGroup.groupId,
        targetGroupId: targetGroup.groupId,
        firstBefore: getWorldRectangle(firstId),
        secondBefore: getWorldRectangle(secondId),
        renderExists: Boolean(review.firstRenderNode)
      }
    })

    expect(setup.renderExists).toBe(true)
    const contentsBounds = await getContentsPanel(page).boundingBox()
    const propertiesBounds = await getPropertiesPanel(page).boundingBox()
    if (!contentsBounds || !propertiesBounds) {
      throw new Error('Asyra Design canvas viewport bounds are unavailable')
    }
    const canvasLeft = Math.ceil(contentsBounds.x + contentsBounds.width)
    const canvasTop = Math.ceil(Math.max(contentsBounds.y, propertiesBounds.y))
    const canvasRight = Math.floor(propertiesBounds.x)
    const canvasBottom = Math.floor(
      Math.min(
        contentsBounds.y + contentsBounds.height,
        propertiesBounds.y + propertiesBounds.height
      )
    )
    const canvasClip = {
      x: canvasLeft,
      y: canvasTop,
      width: canvasRight - canvasLeft,
      height: canvasBottom - canvasTop
    }
    expect(canvasClip.width).toBeGreaterThan(0)
    expect(canvasClip.height).toBeGreaterThan(0)
    const beforeScreenshotPath = testInfo.outputPath('before-reparent.png')
    const beforePixels = await page.screenshot({
      path: beforeScreenshotPath,
      clip: canvasClip
    })

    const result = await page.evaluate(async () => {
      const { core, hierarchyApis, testRuntimeState } = await import(
        '../src/testing/runtime-access'
      )
      const review = testRuntimeState.get<{
        firstElement: unknown
        firstId: string
        firstRenderNode: unknown
        secondId: string
        sourceGroupId: string
        targetGroupId: string
      }>('gate3-group-visual-review')
      if (!review) {
        throw new Error('Gate 3 visual review state is unavailable')
      }

      const getWorldRectangle = (elementId: string) => {
        let currentId = elementId
        let x = 0
        let y = 0
        let width = 0
        let height = 0
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
          if (currentId === elementId) {
            width = Number(computed.width)
            height = Number(computed.height)
          }
          currentId = String(element.get('parentId') ?? '')
        }

        return { x, y, width, height }
      }

      const moveResult = hierarchyApis.moveElements(
        {
          elementIds: [review.firstId],
          targetParentId: review.targetGroupId,
          targetIndex: 1
        },
        { undoable: false }
      )
      const sourceGroup = core.deps.sceneTree.getElementById(
        review.sourceGroupId
      )
      const targetGroup = core.deps.sceneTree.getElementById(
        review.targetGroupId
      )
      const sourceComputed = sourceGroup.getAllComputedData()
      const targetComputed = targetGroup.getAllComputedData()
      const response = {
        moveResult,
        firstAfter: getWorldRectangle(review.firstId),
        secondAfter: getWorldRectangle(review.secondId),
        sourceChildren: sourceGroup.get('children'),
        targetChildren: targetGroup.get('children'),
        sourceBounds: {
          x: Number(sourceComputed.x),
          y: Number(sourceComputed.y),
          width: Number(sourceComputed.width),
          height: Number(sourceComputed.height)
        },
        targetBounds: {
          x: Number(targetComputed.x),
          y: Number(targetComputed.y),
          width: Number(targetComputed.width),
          height: Number(targetComputed.height)
        },
        sceneIdentityPreserved:
          core.deps.sceneTree.getElementById(review.firstId) ===
          review.firstElement,
        renderIdentityPreserved:
          core.deps.render.getElementById(review.firstId) ===
          review.firstRenderNode
      }
      testRuntimeState.delete('gate3-group-visual-review')
      return response
    })

    await page.waitForTimeout(100)
    const afterScreenshotPath = testInfo.outputPath('after-reparent.png')
    const afterPixels = await page.screenshot({
      path: afterScreenshotPath,
      clip: canvasClip
    })

    expect(result.moveResult).toEqual({
      elementIds: [setup.firstId],
      moves: [
        {
          elementId: setup.firstId,
          before: { parentId: setup.sourceGroupId, index: 0 },
          after: { parentId: setup.targetGroupId, index: 1 }
        }
      ]
    })
    expect(result.firstAfter).toEqual(setup.firstBefore)
    expect(result.secondAfter).toEqual(setup.secondBefore)
    expect(result.sourceChildren).toEqual([])
    expect(result.targetChildren).toEqual([setup.secondId, setup.firstId])
    expect(result.sourceBounds).toEqual({
      x: setup.firstBefore.x,
      y: setup.firstBefore.y,
      width: 0,
      height: 0
    })

    const expectedTargetBounds: WorldRectangle = {
      x: Math.min(setup.firstBefore.x, setup.secondBefore.x),
      y: Math.min(setup.firstBefore.y, setup.secondBefore.y),
      width:
        Math.max(
          setup.firstBefore.x + setup.firstBefore.width,
          setup.secondBefore.x + setup.secondBefore.width
        ) - Math.min(setup.firstBefore.x, setup.secondBefore.x),
      height:
        Math.max(
          setup.firstBefore.y + setup.firstBefore.height,
          setup.secondBefore.y + setup.secondBefore.height
        ) - Math.min(setup.firstBefore.y, setup.secondBefore.y)
    }
    expect(result.targetBounds).toEqual(expectedTargetBounds)
    expect(result.sceneIdentityPreserved).toBe(true)
    expect(result.renderIdentityPreserved).toBe(true)
    expect(afterPixels.equals(beforePixels)).toBe(true)
    await expect(
      page.getByTestId(`element-item-${setup.firstId}`)
    ).toHaveAttribute('data-layer-depth', '1')
    const projectedRowIds = await page
      .locator('[data-layer-element-id]')
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute('data-layer-element-id'))
      )
    expect(projectedRowIds).toEqual([
      setup.sourceGroupId,
      setup.targetGroupId,
      setup.secondId,
      setup.firstId
    ])

    const runtimeStatePath = testInfo.outputPath('runtime-state.json')
    const runtimeState = {
      baseURL: testInfo.project.use.baseURL,
      viewport: page.viewportSize(),
      canvasClip,
      selection: [],
      editingState: 'none',
      zoom: '100%',
      screenshots: {
        before: beforeScreenshotPath,
        after: afterScreenshotPath,
        beforeSha256: createHash('sha256').update(beforePixels).digest('hex'),
        afterSha256: createHash('sha256').update(afterPixels).digest('hex')
      },
      setup,
      result
    }
    await writeFile(runtimeStatePath, JSON.stringify(runtimeState, null, 2))
    await testInfo.attach('group-hierarchy-runtime-state', {
      path: runtimeStatePath,
      contentType: 'application/json'
    })
  })
})
