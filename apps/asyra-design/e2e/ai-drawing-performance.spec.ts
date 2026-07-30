import { expect, test, type Page } from '@playwright/test'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
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
const RUN_HIGH_DETAIL =
  process.env.ASYRA_DESIGN_RUN_AI_DRAWING_HIGH_DETAIL_PROFILE === '1'
const RUN_OWNER_BASELINE =
  process.env.ASYRA_DESIGN_RUN_AI_DRAWING_OWNER_BASELINE === '1'
const exactCatOnlyPrompt =
  'Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo.'
const referenceImagePath = fileURLToPath(
  new URL(
    '../visual-review-records/research/research-02-original-tabby-source.png',
    import.meta.url
  )
)

interface ProfileSnapshot {
  configuration: {
    contentsMode: 'omitted' | 'present'
    deliveryMode: 'atomic' | 'progressive'
  }
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
    preparedResponseItemCount: AsyraDesignServerResponseItemCount | null
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

const summarizeProfiledTurn = ({
  bootstrap,
  canonical,
  harnessWallMs,
  historyDelta,
  productDurationMs,
  snapshot
}: ProfiledTurn) => {
  const phaseTotals = new Map<string, number>()
  for (const { durationMs, name } of snapshot.phases) {
    phaseTotals.set(name, (phaseTotals.get(name) ?? 0) + durationMs)
  }
  const counterTotals = new Map<string, number>()
  for (const { name, value } of snapshot.counters) {
    counterTotals.set(name, (counterTotals.get(name) ?? 0) + value)
  }
  const roundedPhaseTotal = (...names: readonly string[]) =>
    names.every((name) => phaseTotals.has(name))
      ? Math.round(
          names.reduce((total, name) => total + (phaseTotals.get(name) ?? 0), 0)
        )
      : null
  return {
    bootstrap,
    canonical,
    harnessWallMs: Math.round(harnessWallMs),
    historyDelta,
    ownerSpans: {
      appBulkRequestMs: roundedPhaseTotal(
        'ai-app:prepare-composition-bulk-request'
      ),
      canonicalBatchMs: roundedPhaseTotal('ai-app:create-composition-batch'),
      factoryArtifactFinalizeMs: roundedPhaseTotal(
        'factory:finalize-mutation-batch-artifact'
      ),
      factoryPublicationDeliveryMs: roundedPhaseTotal(
        'factory:flush-shared-channels'
      ),
      factoryPublicationPlanMs: roundedPhaseTotal(
        'factory:select-delivery-plan-boundaries',
        'factory:create-shared-publication'
      ),
      harnessOverheadMs: Math.round(
        Math.max(0, harnessWallMs - productDurationMs)
      ),
      inboundDispatchMs: roundedPhaseTotal(
        'collaboration:inbound-receive-to-dispatch'
      ),
      outboundEncodeMs: roundedPhaseTotal('collaboration:outbound-encode'),
      persistenceCaptureMs: roundedPhaseTotal('core:persistence-capture'),
      persistenceSaveMs: roundedPhaseTotal('core:persistence-save'),
      remoteApplyMs: roundedPhaseTotal(
        'collaboration:remote-transaction-apply'
      ),
      renderFlushMs: roundedPhaseTotal('render:flush-frame'),
      uiFlushMs: roundedPhaseTotal('ui-context:flush'),
      workerDecodeMs: roundedPhaseTotal('collaboration:codec-worker-decode'),
      workerEncodeMs: roundedPhaseTotal('collaboration:codec-worker-encode')
    },
    productDurationMs: Math.round(productDurationMs),
    topCounters: [...counterTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value })),
    topPhases: [...phaseTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, valueMs: Math.round(value) }))
  }
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

const summarizeDurations = (samples: readonly number[]) => {
  const ordered = [...samples].sort((left, right) => left - right)
  if (ordered.length !== 3) {
    throw new Error('Performance gate requires exactly three measured samples')
  }
  return {
    medianMs: ordered[1] as number,
    worstMs: ordered[2] as number
  }
}

const runProfiledTurn = async (
  page: Page,
  {
    contentsMode,
    deliveryMode,
    intent,
    preparedResponseItemCount,
    referenceImage,
    timeout
  }: {
    contentsMode: 'omitted' | 'present'
    deliveryMode: 'atomic' | 'progressive'
    intent: string
    preparedResponseItemCount: AsyraDesignServerResponseItemCount | null
    referenceImage?: boolean
    timeout: number
  }
): Promise<ProfiledTurn> => {
  const identity = createTestDocumentIdentity(
    `aiDelivery=${deliveryMode}&aiPerformance=profile&aiPerformanceContents=${contentsMode}`
  )
  if (preparedResponseItemCount !== null) {
    await seedAsyraDesignServerResponse(page.context(), {
      appUrl: identity.url,
      fileId: identity.fileId,
      itemCount: preparedResponseItemCount
    })
  }
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
  if (referenceImage) {
    await page.getByLabel('Choose images').setInputFiles(referenceImagePath)
    await expect(
      page.getByRole('img', {
        name: 'research-02-original-tabby-source.png'
      })
    ).toBeVisible()
  }
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
    .toMatch(/^(cancelled|failed|no-change|partial|success|unavailable)$/)
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

  test('separates a production 16-item product span from harness wall time', async ({
    page
  }, testInfo) => {
    const result = await runProfiledTurn(page, {
      contentsMode: 'present',
      deliveryMode: 'progressive',
      intent: 'create the fast CRDT performance fixture',
      preparedResponseItemCount: 16,
      timeout: 30_000
    })

    expect(result.snapshot.runtime).toBe('production')
    expect(result.snapshot.releaseEvidenceEligible).toBe(true)
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

  test('profiles the high-detail Contents attribution with one warm-up and three measured runs', async ({
    browser
  }, testInfo) => {
    test.skip(!RUN_HIGH_DETAIL, 'independent high-detail profiling opt-in')
    test.setTimeout(12 * 60_000)
    const results: Record<'omitted' | 'present', ProfiledTurn[]> = {
      omitted: [],
      present: []
    }

    for (const contentsMode of ['present', 'omitted'] as const) {
      for (let run = 0; run < 4; run += 1) {
        const context = await browser.newContext()
        try {
          const page = await context.newPage()
          const result = await runProfiledTurn(page, {
            contentsMode,
            deliveryMode: 'atomic',
            intent: 'draw a detailed cat face',
            preparedResponseItemCount: 7075,
            timeout: 120_000
          })
          if (run > 0) {
            results[contentsMode].push(result)
          }
        } finally {
          await context.close()
        }
      }
    }

    expect(results.present).toHaveLength(3)
    expect(results.omitted).toHaveLength(3)
    expect(
      results.present.every(({ snapshot }) => snapshot.releaseEvidenceEligible)
    ).toBe(true)
    expect(
      results.omitted.every(({ snapshot }) => !snapshot.releaseEvidenceEligible)
    ).toBe(true)
    // eslint-disable-next-line no-console
    console.log(
      `AI_DRAWING_PROFILE_SUMMARY ${JSON.stringify(
        Object.fromEntries(
          Object.entries(results).map(([contentsMode, samples]) => [
            contentsMode,
            samples.map(summarizeProfiledTurn)
          ])
        )
      )}`
    )
    await testInfo.attach('high-detail-profile-summary.json', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    })
  })

  for (const budget of [
    {
      deliveryMode: 'atomic',
      medianMs: 12_000,
      worstMs: 20_000
    },
    {
      deliveryMode: 'progressive',
      medianMs: 20_000,
      worstMs: 30_000
    }
  ] as const) {
    test(`meets the ${budget.deliveryMode} high-detail budget after one warm-up and three measured runs`, async ({
      browser
    }, testInfo) => {
      test.skip(!RUN_OWNER_BASELINE, 'explicit owner baseline only')
      test.setTimeout(6 * 60_000)
      const measured: ProfiledTurn[] = []

      for (let run = 0; run < 4; run += 1) {
        const context = await browser.newContext()
        try {
          const page = await context.newPage()
          const result = await runProfiledTurn(page, {
            contentsMode: 'present',
            deliveryMode: budget.deliveryMode,
            intent: exactCatOnlyPrompt,
            preparedResponseItemCount: 7075,
            referenceImage: true,
            timeout: 120_000
          })
          expect(result.snapshot.releaseEvidenceEligible).toBe(true)
          expect(result.harnessWallMs).toBeGreaterThanOrEqual(
            result.productDurationMs
          )
          expect(result.canonical).toMatchObject({
            groupCount: 1,
            renderedCount: 7076,
            totalCount: 7076,
            uniqueIdCount: 7076,
            vectorCount: 7075
          })
          expect(result.canonical.pointCount).toBeGreaterThan(100_000)
          expect(result.historyDelta).toBe(1)
          if (run > 0) {
            measured.push(result)
          }
        } finally {
          await context.close()
        }
      }

      const durationSummary = summarizeDurations(
        measured.map(({ productDurationMs }) => productDurationMs)
      )
      expect(durationSummary.medianMs).toBeLessThanOrEqual(budget.medianMs)
      expect(durationSummary.worstMs).toBeLessThanOrEqual(budget.worstMs)
      const report = {
        budget,
        durationSummary,
        samples: measured.map(summarizeProfiledTurn)
      }
      // eslint-disable-next-line no-console
      console.log(
        `AI_DRAWING_PERFORMANCE_GATE ${JSON.stringify({
          deliveryMode: budget.deliveryMode,
          ...durationSummary
        })}`
      )
      await testInfo.attach(
        `${budget.deliveryMode}-performance-gate-summary.json`,
        {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json'
        }
      )
    })
  }
})
