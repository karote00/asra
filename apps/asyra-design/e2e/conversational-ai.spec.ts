import { expect, test, type Page } from '@playwright/test'
import {
  createTestDocumentIdentity,
  getUndoHistoryDepth,
  waitForAppReady
} from './test-utils'
import { seedAsyraDesignServerResponse } from './server-response-inbox'

interface CanonicalDrawingSummary {
  readonly groupCount: number
  readonly totalCount: number
  readonly vectorCount: number
}

const readCanonicalDrawingSummary = async (
  page: Page
): Promise<CanonicalDrawingSummary> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneTree = (window as any).__Core__?.deps?.sceneTree
    if (!sceneTree) {
      throw new Error('Asyra Design scene tree is unavailable')
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
  page.evaluate(() => {
    const core = window.__Core__
    const sceneTree = core?.deps.sceneTree
    if (!core || !sceneTree) {
      throw new Error('Asyra Design canonical state is unavailable')
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

const readElementFillColor = async (
  page: Page,
  elementId: string
): Promise<string | null> =>
  page.evaluate((targetElementId) => {
    const element =
      window.__Core__?.deps.sceneTree.getElementById(targetElementId)
    const computed = element?.getAllComputedData() as
      | { fills?: readonly { readonly color?: unknown }[] }
      | undefined
    const color = computed?.fills?.[0]?.color
    return typeof color === 'string' ? color : null
  }, elementId)

test.describe('Conversational AI drawing', () => {
  test('executes the file-scoped server action batch through the production Agent flow', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const identity = createTestDocumentIdentity()
    await seedAsyraDesignServerResponse(page.context(), {
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
      .poll(() => readElementFillColor(page, editableFill.elementId))
      .toBe(`#${nextColor.toLowerCase()}`)
  })
})
