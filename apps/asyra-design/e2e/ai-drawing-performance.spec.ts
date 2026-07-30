import { expect, test, type Page } from '@playwright/test'
import { performance } from 'node:perf_hooks'
import {
  createTestDocumentIdentity,
  getUndoHistoryDepth,
  waitForAppReady
} from './test-utils'
import {
  seedAsyraDesignServerResponse,
  type AsyraDesignServerResponseItemCount
} from './server-response-inbox'

const RUN_PROFILE = process.env.ASYRA_DESIGN_RUN_AI_DRAWING_PERFORMANCE === '1'

interface ProfileSnapshot {
  counters: readonly {
    atMs: number
    name: string
    value: number
  }[]
  phases: readonly {
    atMs: number
    durationMs: number
    name: string
  }[]
  releaseEvidenceEligible: boolean
  runtime: 'development' | 'production'
}

interface ProfiledTurn {
  bootstrap: {
    preparedResponseItemCount: AsyraDesignServerResponseItemCount
    responseInboxPreload: ProfileSnapshot['phases'][number]
  }
  canonical: {
    groupCount: number
    pointCount: number
    renderedCount: number
    totalCount: number
    uniqueIdCount: number
    vectorCount: number
  }
  harnessWallMs: number
  historyDelta: number
  productDurationMs: number
  snapshot: ProfileSnapshot
}

const readProfileCanonicalSummary = (page: Page) =>
  page.evaluate(() => {
    const elements =
      window.__AsyraAiDrawingPerformance__?.readCanonicalElements()
    if (!elements) {
      throw new Error(
        'AI drawing performance canonical evidence is unavailable'
      )
    }
    const ids: string[] = []
    let groupCount = 0
    let pointCount = 0
    let renderedCount = 0
    let vectorCount = 0
    for (const element of elements) {
      if (element.type === 'workspace') continue
      ids.push(element.id)
      if (element.rendered) renderedCount += 1
      if (element.type === 'group') groupCount += 1
      if (element.type !== 'vector') continue
      vectorCount += 1
      const computed = element.computed as {
        points?: Readonly<Record<string, unknown>>
      }
      pointCount += Object.keys(computed.points ?? {}).length
    }
    return {
      groupCount,
      pointCount,
      renderedCount,
      totalCount: ids.length,
      uniqueIdCount: new Set(ids).size,
      vectorCount
    }
  })

const expectProfileOwnerPhases = (
  snapshot: ProfileSnapshot,
  requiredNames: readonly string[]
) => {
  const observedNames = new Set(snapshot.phases.map(({ name }) => name))
  expect(
    requiredNames.filter((name) => !observedNames.has(name)),
    'AI drawing profile is missing required owner phases'
  ).toEqual([])
}

const runProfiledTurn = async (
  page: Page,
  {
    intent,
    preparedResponseItemCount,
    timeout
  }: {
    intent: string
    preparedResponseItemCount: AsyraDesignServerResponseItemCount
    timeout: number
  }
): Promise<ProfiledTurn> => {
  const identity = createTestDocumentIdentity('aiPerformance=profile')
  await seedAsyraDesignServerResponse(page.context(), {
    appUrl: identity.url,
    fileId: identity.fileId,
    itemCount: preparedResponseItemCount
  })
  await page.goto(identity.url)
  await waitForAppReady(page)
  const bootstrapSnapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  if (!bootstrapSnapshot) {
    throw new Error('AI drawing performance bootstrap profile is unavailable')
  }
  const responseInboxPreloadSamples = bootstrapSnapshot.phases.filter(
    ({ name }) => name === 'ai-server-response-inbox:preload-file-response'
  )
  expect(responseInboxPreloadSamples).toHaveLength(1)
  const responseInboxPreload = responseInboxPreloadSamples[0]
  if (!responseInboxPreload) {
    throw new Error('Server response inbox preload phase is unavailable')
  }
  await expect(page.getByTestId('ai-agent-toolbar-button')).toBeVisible()
  await page.getByTestId('ai-agent-toolbar-button').click()
  await expect(page.getByRole('complementary')).toBeVisible()
  const historyBefore = await getUndoHistoryDepth(page)
  await page.evaluate(() => {
    if (!window.__AsyraAiDrawingPerformance__) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    window.__AsyraAiDrawingPerformance__.reset()
  })

  const harnessStart = performance.now()
  const input = page.getByLabel('Message Agent')
  await input.fill(intent)
  await page.getByRole('button', { name: 'Send' }).click()
  const settledTurn = page.getByTestId('ai-agent-message').last()
  await expect
    .poll(() => settledTurn.getAttribute('data-outcome'), { timeout })
    .toMatch(/^(cancelled|failed|no-change|partial|success)$/)
  const outcome = await settledTurn.getAttribute('data-outcome')
  if (outcome !== 'success') {
    const conversation = await page.evaluate(() => {
      return (
        window.__AsyraAiDrawingPerformance__?.readConversationSnapshot() ?? null
      )
    })
    throw new Error(
      `Profiled AI turn settled as ${outcome}: ${JSON.stringify(conversation)}`
    )
  }
  const harnessWallMs = performance.now() - harnessStart
  const snapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  expect(snapshot).not.toBeNull()
  const exactSnapshot = snapshot as ProfileSnapshot
  expect(
    exactSnapshot.phases.some(
      ({ name }) => name === 'ai-server-response-inbox:preload-file-response'
    )
  ).toBe(false)
  const productSamples = exactSnapshot.phases.filter(
    ({ name }) => name === 'ai-turn:accepted-to-settled'
  )
  expect(productSamples).toHaveLength(1)
  const productSample = productSamples[0]
  expect(
    exactSnapshot.counters.some(
      ({ name, value }) => name === 'ai-turn:outcome:success' && value === 1
    )
  ).toBe(true)
  expect(
    exactSnapshot.phases.some(({ name }) => name === 'ui-context:flush')
  ).toBe(true)
  expectProfileOwnerPhases(exactSnapshot, [
    'ai-app:prepare-composition-bulk-request',
    'ai-app:create-composition-batch',
    'factory:finalize-mutation-batch-artifact',
    'factory:flush-shared-channels',
    'factory:select-delivery-plan-boundaries',
    'factory:create-shared-publication',
    'render:flush-frame',
    'ui-context:flush'
  ])
  const [canonical, historyAfter] = await Promise.all([
    readProfileCanonicalSummary(page),
    getUndoHistoryDepth(page)
  ])

  return {
    bootstrap: {
      preparedResponseItemCount,
      responseInboxPreload
    },
    canonical,
    harnessWallMs,
    historyDelta: historyAfter - historyBefore,
    productDurationMs: productSample?.durationMs ?? Number.NaN,
    snapshot: exactSnapshot
  }
}

test.describe('Conversational AI drawing performance profile', () => {
  test.skip(!RUN_PROFILE, 'explicit performance profiling only')

  test('separates a 16-item product span from harness wall time', async ({
    page
  }, testInfo) => {
    const result = await runProfiledTurn(page, {
      intent: 'create the fast CRDT performance fixture',
      preparedResponseItemCount: 16,
      timeout: 30_000
    })

    expect(['development', 'production']).toContain(result.snapshot.runtime)
    expect(result.snapshot.releaseEvidenceEligible).toBe(
      result.snapshot.runtime === 'production'
    )
    expect(result.productDurationMs).toBeGreaterThan(0)
    expect(result.harnessWallMs).toBeGreaterThanOrEqual(
      result.productDurationMs
    )
    expect(result.canonical).toMatchObject({
      groupCount: 1,
      renderedCount: 17,
      totalCount: 17,
      uniqueIdCount: 17,
      vectorCount: 16
    })
    expect(result.historyDelta).toBe(1)
    await testInfo.attach('fast-profile-summary.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json'
    })
  })
})
