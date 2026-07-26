import { expect, test, type Page } from '@playwright/test'
import { performance } from 'node:perf_hooks'
import { getPersistedDocumentDigest, waitForAppReady } from './test-utils'

const RUN_PROFILE = process.env.ASYRA_DESIGN_RUN_AI_DRAWING_PERFORMANCE === '1'
const RUN_HIGH_DETAIL =
  process.env.ASYRA_DESIGN_RUN_AI_DRAWING_HIGH_DETAIL_PROFILE === '1'
const RUN_CONTENTS_RENDER_ATTRIBUTION =
  process.env.ASYRA_DESIGN_RUN_CONTENTS_RENDER_ATTRIBUTION === '1'
const RUN_OWNER_BASELINE =
  process.env.ASYRA_DESIGN_RUN_AI_DRAWING_OWNER_BASELINE === '1'

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
  harnessWallMs: number
  productDurationMs: number
  snapshot: ProfileSnapshot
}

const summarizeProfiledTurn = ({
  harnessWallMs,
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
  return {
    harnessWallMs: Math.round(harnessWallMs),
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

const loadFixedCanonicalState = async (
  page: Page,
  contentsMode: 'omitted' | 'present'
) => {
  const harnessStart = performance.now()
  await page.goto(
    `/?ai=mock&aiDelivery=atomic&aiPerformance=profile&aiPerformanceContents=${contentsMode}`
  )
  await waitForAppReady(page)
  const harnessWallMs = performance.now() - harnessStart
  const snapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  if (!snapshot) {
    throw new Error('AI drawing performance profile is unavailable')
  }
  const phaseTotals = new Map<string, number>()
  for (const { durationMs, name } of snapshot.phases) {
    phaseTotals.set(name, (phaseTotals.get(name) ?? 0) + durationMs)
  }
  const sumPrefix = (prefix: string) =>
    [...phaseTotals.entries()]
      .filter(([name]) => name.startsWith(prefix))
      .reduce((total, [, durationMs]) => total + durationMs, 0)
  return {
    harnessWallMs: Math.round(harnessWallMs),
    lastProductSampleAtMs: Math.round(
      Math.max(
        0,
        ...snapshot.phases.map(({ atMs, durationMs }) => atMs + durationMs)
      )
    ),
    renderPhaseMs: Math.round(sumPrefix('render')),
    uiContextPhaseMs: Math.round(phaseTotals.get('ui-context:flush') ?? 0)
  }
}

const runProfiledTurn = async (
  page: Page,
  {
    contentsMode,
    deliveryMode,
    intent,
    timeout
  }: {
    contentsMode: 'omitted' | 'present'
    deliveryMode: 'atomic' | 'progressive'
    intent: string
    timeout: number
  }
): Promise<ProfiledTurn> => {
  await page.goto(
    `/?ai=mock&aiDelivery=${deliveryMode}&aiPerformance=profile&aiPerformanceContents=${contentsMode}`
  )
  await waitForAppReady(page)
  await expect(page.getByTestId('mock-ai-toolbar-button')).toBeVisible()
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
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
  const settledTurn = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
    .last()
  await expect(settledTurn).toHaveAttribute('data-outcome', 'success', {
    timeout
  })
  const harnessWallMs = performance.now() - harnessStart
  const snapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  expect(snapshot).not.toBeNull()
  const exactSnapshot = snapshot as ProfileSnapshot
  const productSample = exactSnapshot.phases.find(
    ({ name }) => name === 'ai-turn:accepted-to-settled'
  )
  expect(productSample).toBeDefined()
  expect(
    exactSnapshot.counters.some(
      ({ name, value }) => name === 'ai-turn:outcome:success' && value === 1
    )
  ).toBe(true)
  expect(
    exactSnapshot.phases.some(({ name }) => name === 'ui-context:flush')
  ).toBe(true)

  return {
    harnessWallMs,
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
      timeout: 30_000
    })

    expect(result.snapshot.runtime).toBe('production')
    expect(result.snapshot.releaseEvidenceEligible).toBe(true)
    expect(result.productDurationMs).toBeGreaterThan(0)
    expect(result.harnessWallMs).toBeGreaterThanOrEqual(
      result.productDurationMs
    )
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
        const page = await context.newPage()
        const result = await runProfiledTurn(page, {
          contentsMode,
          deliveryMode: 'atomic',
          intent: 'draw a detailed cat face',
          timeout: 120_000
        })
        if (run > 0) {
          results[contentsMode].push(result)
        }
        await context.close()
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

  test('reports three production owner-span samples after one warm-up', async ({
    browser
  }) => {
    test.skip(!RUN_OWNER_BASELINE, 'explicit owner baseline only')
    test.setTimeout(6 * 60_000)
    const measured: ProfiledTurn[] = []

    for (let run = 0; run < 4; run += 1) {
      const context = await browser.newContext()
      const page = await context.newPage()
      const result = await runProfiledTurn(page, {
        contentsMode: 'present',
        deliveryMode: 'atomic',
        intent: 'draw a detailed cat face',
        timeout: 120_000
      })
      if (run > 0) {
        measured.push(result)
      }
      await context.close()
    }

    expect(measured).toHaveLength(3)
    expect(
      measured.every(({ snapshot }) => snapshot.releaseEvidenceEligible)
    ).toBe(true)
    // eslint-disable-next-line no-console
    console.log(
      `AI_DRAWING_OWNER_BASELINE ${JSON.stringify(
        measured.map(summarizeProfiledTurn)
      )}`
    )
  })

  test('compares only fixed 7112-element load and render with Contents present or omitted', async ({
    page
  }) => {
    test.skip(
      !RUN_CONTENTS_RENDER_ATTRIBUTION,
      'explicit fixed-state Contents attribution only'
    )
    test.setTimeout(6 * 60_000)

    await page.goto(
      '/?ai=mock&aiDelivery=atomic&aiPerformance=profile&aiPerformanceContents=present'
    )
    await waitForAppReady(page)
    await page.getByRole('button', { name: 'Open Mock AI' }).click()
    const input = page.getByLabel('Message Agent')
    await input.fill('draw a detailed cat face')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(
      page.getByTestId('mock-ai-panel').locator('article[data-turn-id]').last()
    ).toHaveAttribute('data-outcome', 'success', { timeout: 120_000 })

    const canonicalDigest = await expect
      .poll(async () => getPersistedDocumentDigest(page), {
        timeout: 30_000
      })
      .not.toBeNull()
      .then(() => getPersistedDocumentDigest(page))
    expect(canonicalDigest).not.toBeNull()

    await loadFixedCanonicalState(page, 'present')
    await loadFixedCanonicalState(page, 'omitted')

    const results: Record<
      'omitted' | 'present',
      Awaited<ReturnType<typeof loadFixedCanonicalState>>[]
    > = {
      omitted: [],
      present: []
    }
    for (let run = 0; run < 3; run += 1) {
      for (const contentsMode of ['present', 'omitted'] as const) {
        results[contentsMode].push(
          await loadFixedCanonicalState(page, contentsMode)
        )
        expect(await getPersistedDocumentDigest(page)).toEqual(canonicalDigest)
      }
    }

    // eslint-disable-next-line no-console
    console.log(`CONTENTS_FIXED_7112_RENDER_SUMMARY ${JSON.stringify(results)}`)
  })
})
