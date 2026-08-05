import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { ACTION_BATCH_ENDPOINT } from '../src/ai/action-batch-endpoint'
import { seedServerResponse } from './server-response-inbox'
import { waitForAppReady } from './test-utils'

const SAMPLE_FILE_ID = 'crdt-7076-sample'
const sampleRoot = new URL('../samples/crdt-7076/', import.meta.url)

const attachReferenceImage = async (page: Page) => {
  const image = await readFile(new URL('reference-image.png', sampleRoot))
  const dataTransfer = await page.evaluateHandle(
    ({ base64 }) => {
      const bytes = Uint8Array.from(globalThis.atob(base64), (character) =>
        character.charCodeAt(0)
      )
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([bytes], 'reference-image.png', {
          type: 'image/png'
        })
      )
      return transfer
    },
    { base64: image.toString('base64') }
  )

  try {
    await page
      .getByTestId('agent-image-drop-target')
      .dispatchEvent('drop', { dataTransfer })
  } finally {
    await dataTransfer.dispose()
  }
  await expect(
    page.getByRole('img', { name: 'reference-image.png' })
  ).toBeVisible()
}

test('renders the complete crdt-7076 HTTP-intercepted action while the socket is unavailable', async ({
  page
}, testInfo) => {
  test.setTimeout(360_000)
  const renderFailures: string[] = []
  const startupErrors: string[] = []
  let actionBatchPostCount = 0
  let directDocumentRequestCount = 0
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
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === ACTION_BATCH_ENDPOINT
    ) {
      actionBatchPostCount += 1
    }
    if (request.url().includes('/samples/crdt-7076/document.json.gz')) {
      directDocumentRequestCount += 1
    }
  })

  await seedServerResponse(page.context(), {
    fileId: SAMPLE_FILE_ID,
    itemCount: 7_075
  })
  await page.goto(`/?fileId=${SAMPLE_FILE_ID}`)
  try {
    await waitForAppReady(page)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${message}\nCaptured startup errors: ${
        startupErrors.join(' | ') || '(none)'
      }\nCaptured render failures: ${renderFailures.join(' | ') || '(none)'}`
    )
  }
  await expect
    .poll(() =>
      startupErrors.some((message) =>
        message.includes('[collaboration] initial document session failed:')
      )
    )
    .toBe(true)
  expect(directDocumentRequestCount).toBe(0)

  await page.getByRole('button', { name: 'Open Agent' }).click()
  await expect(page.getByTestId('ai-agent-panel')).toBeVisible()
  await attachReferenceImage(page)
  const instruction = (
    await readFile(new URL('instruction.txt', sampleRoot), 'utf8')
  ).trim()
  await page.getByLabel('Message Agent').fill(instruction)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(
    page.getByTestId('ai-agent-panel').locator('article[data-turn-id]').last()
  ).toHaveAttribute('data-outcome', 'success', { timeout: 300_000 })
  expect(actionBatchPostCount).toBe(1)

  await page.waitForFunction(
    async () => {
      const { core } = await import('../src/testing/runtime-access')
      const document = await core.save()
      return Object.keys(document.sceneTree.elements).length === 7_077
    },
    undefined,
    { timeout: 300_000 }
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
      sceneTreeRecordCount: 7_077,
      vectorCount: 7_075,
      pointCount: 156_373,
      denseVectorCount: 5,
      workspaceCoordinateCount: 7_075,
      renderedVectorCount: 7_075
    }
  )
  expect(initial.densestVectorId).toBeTruthy()
  if (!initial.densestVectorId) {
    throw new Error('The complete sample must contain at least one Vector')
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

  const screenshotPath = testInfo.outputPath('crdt-7076-render.png')
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: 'disabled'
  })
  await testInfo.attach('crdt-7076-render', {
    path: screenshotPath,
    contentType: 'image/png'
  })
})
