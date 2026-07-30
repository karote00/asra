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

test.describe('Conversational AI drawing', () => {
  test('executes the file-scoped server action batch through the production Agent flow', async ({
    page
  }) => {
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
  })
})
