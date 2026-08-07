import { expect, test, type Page } from '@playwright/test'
import {
  createTestDocumentIdentity,
  getCoreDocumentDigest,
  getPersistedDocumentDigest,
  getUndoHistoryDepth,
  redo,
  undo,
  waitForAppReady
} from './test-utils'
import { installGeneratedActionBatchInterceptor } from './action-batch-interceptor'

interface CanonicalDrawingSummary {
  readonly groupCount: number
  readonly totalCount: number
  readonly vectorCount: number
}

const readCanonicalDrawingSummary = async (
  page: Page
): Promise<CanonicalDrawingSummary> =>
  page.evaluate(async () => {
    const sceneTree = (await import('../src/testing/runtime-access')).core?.deps
      ?.sceneTree
    if (!sceneTree) {
      throw new Error('Design App scene tree is unavailable')
    }

    let groupCount = 0
    let totalCount = 0
    let vectorCount = 0
    for (const element of sceneTree.getAllElements().values()) {
      const type = String(element.get('type'))
      if (type === 'workspace') continue
      totalCount += 1
      if (type === 'group') groupCount += 1
      if (type === 'vector') vectorCount += 1
    }
    return {
      groupCount,
      totalCount,
      vectorCount
    }
  })

const selectFirstEditableFill = async (
  page: Page
): Promise<{ readonly color: string; readonly elementId: string }> =>
  page.evaluate(async () => {
    const core = (await import('../src/testing/runtime-access')).core
    const sceneTree = core?.deps.sceneTree
    if (!core || !sceneTree) {
      throw new Error('Design App canonical state is unavailable')
    }

    for (const element of sceneTree.getAllElements().values()) {
      if (element.get('type') !== 'vector') continue
      const computed = element.getAllComputedData() as {
        fills?: readonly { readonly color?: unknown }[]
      }
      const color = computed.fills?.[0]?.color
      if (typeof color !== 'string') continue
      const elementId = String(element.get('id'))
      core.selectElements([elementId], { undoable: false })
      return { color, elementId }
    }

    throw new Error('The prepared drawing has no editable fill')
  })

const readElementFillProjection = async (
  page: Page,
  elementId: string
): Promise<{
  readonly computed: string | null
  readonly rendered: string | null
}> =>
  page.evaluate(async (targetElementId) => {
    const core = (await import('../src/testing/runtime-access')).core
    const element = core?.deps.sceneTree.getElementById(targetElementId)
    const renderElement = core?.deps.render.getElementById(targetElementId)
    const computed = element?.getAllComputedData() as
      | { fills?: readonly { readonly color?: unknown }[] }
      | undefined
    const rendered = renderElement?.__renderDataSnapshot as
      | { fills?: readonly { readonly color?: unknown }[] }
      | undefined
    const computedColor = computed?.fills?.[0]?.color
    const renderedColor = rendered?.fills?.[0]?.color
    return {
      computed: typeof computedColor === 'string' ? computedColor : null,
      rendered: typeof renderedColor === 'string' ? renderedColor : null
    }
  }, elementId)

test.describe('Conversational AI drawing', () => {
  test('executes the file-scoped server action batch through the production Agent flow', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const identity = createTestDocumentIdentity()
    await installGeneratedActionBatchInterceptor(page.context(), {
      appUrl: identity.url,
      fileId: identity.fileId,
      itemCount: 16
    })

    await page.goto(identity.url)
    await waitForAppReady(page)
    await expect(page.getByTestId('ai-agent-toolbar-button')).toBeVisible()
    expect(await readCanonicalDrawingSummary(page)).toEqual({
      groupCount: 0,
      totalCount: 0,
      vectorCount: 0
    })

    const historyBefore = await getUndoHistoryDepth(page)
    await page.getByTestId('ai-agent-toolbar-button').click()
    await expect(page.getByTestId('ai-agent-panel')).toBeVisible()
    await page
      .getByLabel('Message Agent')
      .fill('Create an editable vector drawing of the reference cat.')
    await page.getByRole('button', { name: 'Send' }).click()

    const message = page.getByTestId('ai-agent-message').last()
    await expect(message).toHaveAttribute('data-outcome', 'success', {
      timeout: 30_000
    })
    await expect(
      message.getByText('Drawing updated successfully.')
    ).toBeVisible()
    await expect
      .poll(() => readCanonicalDrawingSummary(page))
      .toEqual({
        groupCount: 1,
        totalCount: 17,
        vectorCount: 16
      })
    expect(await getUndoHistoryDepth(page)).toBe(historyBefore + 1)

    const editableFill = await selectFirstEditableFill(page)
    const fillBefore = await readElementFillProjection(
      page,
      editableFill.elementId
    )
    expect(fillBefore).toEqual({
      computed: editableFill.color,
      rendered: editableFill.color
    })
    const editHistoryBefore = await getUndoHistoryDepth(page)
    const nextColor =
      editableFill.color.toLowerCase() === '#ff0000' ? '00FF00' : 'FF0000'
    await page.getByRole('button', { name: 'Close Agent panel' }).click()
    await expect(
      page.getByTestId('prop-fill-color-picker-0-trigger')
    ).toBeVisible()
    await page.getByTestId('prop-fill-color-picker-0-trigger').click()
    const colorHexInput = page.getByTestId('prop-fill-color-picker-0-hex')
    await colorHexInput.fill(nextColor)
    await colorHexInput.press('Enter')
    expect(pageErrors).toEqual([])

    await expect
      .poll(() => readElementFillProjection(page, editableFill.elementId))
      .toEqual({
        computed: `#${nextColor.toLowerCase()}`,
        rendered: `#${nextColor.toLowerCase()}`
      })
    expect(await getUndoHistoryDepth(page)).toBe(editHistoryBefore + 1)

    await undo(page)
    await expect
      .poll(() => readElementFillProjection(page, editableFill.elementId))
      .toEqual(fillBefore)

    await redo(page)
    await expect
      .poll(() => readElementFillProjection(page, editableFill.elementId))
      .toEqual({
        computed: `#${nextColor.toLowerCase()}`,
        rendered: `#${nextColor.toLowerCase()}`
      })

    const finalDocumentDigest = await getCoreDocumentDigest(page)
    await expect
      .poll(async () => ({
        current: await getCoreDocumentDigest(page),
        persisted: await getPersistedDocumentDigest(page, identity.fileId)
      }))
      .toEqual({
        current: finalDocumentDigest,
        persisted: finalDocumentDigest
      })

    await page.reload()
    await waitForAppReady(page)
    await expect
      .poll(() => readCanonicalDrawingSummary(page))
      .toEqual({
        groupCount: 1,
        totalCount: 17,
        vectorCount: 16
      })
    await expect
      .poll(() => readElementFillProjection(page, editableFill.elementId))
      .toEqual({
        computed: `#${nextColor.toLowerCase()}`,
        rendered: `#${nextColor.toLowerCase()}`
      })
  })
})
