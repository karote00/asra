import { expect, test } from '@playwright/test'

import { resetCanvas, waitForAppReady } from './test-utils'

interface BrowserTestInfo {
  browserErrors?: string[]
}

interface PhaseBudget {
  count: number
  totalMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
}

type PhaseBudgetLimit = Pick<PhaseBudget, 'totalMs' | 'p95Ms' | 'maxMs'>

interface RenderDeltaProfileSummary {
  sampleFrames: number
  fullRehydrateCallsDuringDelta: number
  renderSnapshotDeltaApplies: number
  elementSaveCallsDuringDelta: number
  computedSnapshotCallsDuringDelta: number
  sceneTree: PhaseBudget
  fullRehydrateReference: PhaseBudget
  renderSnapshot: PhaseBudget
  strategyGeometry: PhaseBudget
  engineHandoff: PhaseBudget
}

const SAMPLE_FRAMES = 12
const DENSE_POINT_COUNT = 56
const SELF_INTERSECTION_STEP = 3
const PHASE_BUDGETS = {
  sceneTree: { totalMs: 24, p95Ms: 4, maxMs: 6 },
  renderSnapshot: { totalMs: 6, p95Ms: 1, maxMs: 2 },
  strategyGeometry: { totalMs: 24, p95Ms: 4, maxMs: 6 },
  engineHandoff: { totalMs: 18, p95Ms: 3, maxMs: 5 }
} satisfies Record<string, PhaseBudgetLimit>
const CRITICAL_PATH_P95_BUDGET_MS = 12

const summarize = (samples: number[]): PhaseBudget => {
  const ordered = [...samples].sort((left, right) => left - right)
  const percentile = (ratio: number): number => {
    if (ordered.length === 0) return 0
    const index = Math.min(
      ordered.length - 1,
      Math.max(0, Math.ceil(ordered.length * ratio) - 1)
    )
    return ordered[index]
  }

  return {
    count: ordered.length,
    totalMs: Number(
      ordered.reduce((total, sample) => total + sample, 0).toFixed(3)
    ),
    p50Ms: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    maxMs: Number((ordered.at(-1) ?? 0).toFixed(3))
  }
}

const expectPhaseWithinBudget = (
  phase: PhaseBudget,
  budget: PhaseBudgetLimit
) => {
  expect(phase.count).toBe(SAMPLE_FRAMES)
  expect(phase.totalMs).toBeLessThanOrEqual(budget.totalMs)
  expect(phase.p95Ms).toBeLessThanOrEqual(budget.p95Ms)
  expect(phase.maxMs).toBeLessThanOrEqual(budget.maxMs)
}

test.describe('Render delta performance budget', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const browserErrors: string[] = []
    const extendedTestInfo = testInfo as typeof testInfo & BrowserTestInfo
    extendedTestInfo.browserErrors = browserErrors
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })

    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(async ({ page: _page }, testInfo) => {
    const browserErrors =
      (testInfo as typeof testInfo & BrowserTestInfo).browserErrors ?? []
    expect(browserErrors).toEqual([])
  })

  test('profiles the current dense-vector owner phases without adding cache semantics', async ({
    page
  }) => {
    test.setTimeout(120_000)

    const rawProfile = await page.evaluate(
      async ({ pointCount, sampleFrames, intersectionStep }) => {
        // E2E-only access to the currently composed framework runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const elementApis = (window as any).__AsyraE2E__?.elementApis
        if (!core || !elementApis) {
          throw new Error('Asyra E2E runtime is unavailable')
        }

        const center = { x: 420, y: 300 }
        const radius = 150
        const pointIds = Array.from(
          { length: pointCount },
          (_, index) => `dense-point-${index}`
        )
        const traversalIds = Array.from(
          { length: pointCount },
          (_, index) => pointIds[(index * intersectionStep) % pointCount]
        )
        if (new Set(traversalIds).size !== pointCount) {
          throw new Error('Dense vector traversal must visit every point once')
        }

        const points = Object.fromEntries(
          pointIds.map((id, index) => {
            const angle = (Math.PI * 2 * index) / pointCount
            return [
              id,
              {
                id,
                kind: 'anchor',
                anchorType: 'sharp',
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius
              }
            ]
          })
        )
        const segments = Object.fromEntries(
          traversalIds.map((pointId, index) => {
            const nextPointId = traversalIds[(index + 1) % traversalIds.length]
            const segmentId = `dense-segment-${index}`
            return [
              segmentId,
              {
                id: segmentId,
                startId: pointId,
                endId: nextPointId,
                outControlId: null,
                inControlId: null
              }
            ]
          })
        )
        const networks = {
          'dense-network': {
            id: 'dense-network',
            pointIds: traversalIds,
            segmentIds: traversalIds.map(
              (_, index) => `dense-segment-${index}`
            ),
            closed: true
          }
        }

        const elementId = elementApis.createElement(
          {
            type: 'vector',
            points,
            segments,
            networks,
            closed: true
          },
          { undoable: false }
        )
        if (!elementId) {
          throw new Error('Failed to create dense vector profiling fixture')
        }
        elementApis.changeComputedData(
          [elementId],
          {
            fills: [
              {
                id: 'dense-vector-fill',
                kind: 'solid',
                fillType: 'color',
                color: '#64748b',
                opacity: 1,
                visible: true
              }
            ]
          },
          { undoable: false }
        )

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )

        const sceneTree = core.deps?.sceneTree
        const render = core.deps?.render
        const engine = render?.getEngine?.()
        const element = sceneTree?.getElementById?.(elementId)
        if (!sceneTree || !render || !engine || !element) {
          throw new Error('Composed owner runtime is unavailable for profiling')
        }

        const phaseSamples = new Map<string, number[]>()
        const pushSample = (phaseName: string, durationMs: number) => {
          const samples = phaseSamples.get(phaseName) ?? []
          samples.push(durationMs)
          phaseSamples.set(phaseName, samples)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runtimeGlobal = globalThis as any
        const previousPhaseSink = runtimeGlobal.__asyraBrowserDragPhaseSink
        runtimeGlobal.__asyraBrowserDragPhaseSink = pushSample
        const previousCounterSink =
          runtimeGlobal.__asyraStrokePipelineCounterSink
        const counters = new Map<string, number>()
        runtimeGlobal.__asyraStrokePipelineCounterSink = (
          counterName: string,
          value: number
        ) => {
          counters.set(counterName, (counters.get(counterName) ?? 0) + value)
        }

        const sceneTreeSamples: number[] = []
        const renderSnapshotSamples: number[] = []
        const engineSamples: number[] = []
        const engineFrameSamples: number[] = []
        let elementSaveCallsDuringDelta = 0
        let computedSnapshotCallsDuringDelta = 0

        const originalPatchComputedData =
          sceneTree.patchComputedData.bind(sceneTree)
        const originalCommitSceneTreeTransaction =
          sceneTree.commitSceneTreeTransaction.bind(sceneTree)
        const originalEngineExecute = engine.execute.bind(engine)
        const originalElementSave = element.save.bind(element)
        const originalGetAllComputedData =
          element.getAllComputedData.bind(element)

        core.setSystemProperty('pathEditingMode', true)
        core.setSystemProperty('mouseDown', true)
        core.setSystemProperty('mouseDragging', true)

        sceneTree.patchComputedData = (...args: unknown[]) => {
          const start = performance.now()
          try {
            return originalPatchComputedData(...args)
          } finally {
            sceneTreeSamples.push(performance.now() - start)
          }
        }
        sceneTree.commitSceneTreeTransaction = (...args: unknown[]) => {
          const start = performance.now()
          try {
            return originalCommitSceneTreeTransaction(...args)
          } finally {
            renderSnapshotSamples.push(performance.now() - start)
          }
        }
        engine.execute = (...args: unknown[]) => {
          const start = performance.now()
          try {
            return originalEngineExecute(...args)
          } finally {
            engineSamples.push(performance.now() - start)
          }
        }
        element.save = (...args: unknown[]) => {
          elementSaveCallsDuringDelta += 1
          return originalElementSave(...args)
        }
        element.getAllComputedData = (...args: unknown[]) => {
          computedSnapshotCallsDuringDelta += 1
          return originalGetAllComputedData(...args)
        }

        try {
          const movingPointId = traversalIds[1]
          const movingPoint = points[movingPointId]
          for (let index = 0; index < sampleFrames; index += 1) {
            const angle = (Math.PI * 2 * index) / sampleFrames
            const engineSampleStart = engineSamples.length
            elementApis.updateVectorAnchorPointPosition(
              elementId,
              movingPointId,
              {
                x: movingPoint.x + Math.cos(angle) * 8,
                y: movingPoint.y + Math.sin(angle) * 8
              },
              { undoable: false, skipResult: true }
            )
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve())
            )
            engineFrameSamples.push(
              engineSamples
                .slice(engineSampleStart)
                .reduce((total, sample) => total + sample, 0)
            )
          }
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
        } finally {
          sceneTree.patchComputedData = originalPatchComputedData
          sceneTree.commitSceneTreeTransaction =
            originalCommitSceneTreeTransaction
          engine.execute = originalEngineExecute
          element.save = originalElementSave
          element.getAllComputedData = originalGetAllComputedData
          runtimeGlobal.__asyraBrowserDragPhaseSink = previousPhaseSink
          runtimeGlobal.__asyraStrokePipelineCounterSink = previousCounterSink
          core.setSystemProperty('mouseDragging', false)
          core.setSystemProperty('mouseDown', false)
          core.setSystemProperty('pathEditingMode', false)
        }

        const fullRehydrateReference: number[] = []
        for (let index = 0; index < sampleFrames; index += 1) {
          const start = performance.now()
          originalElementSave()
          originalGetAllComputedData()
          fullRehydrateReference.push(performance.now() - start)
        }

        return {
          sampleFrames,
          fullRehydrateCallsDuringDelta:
            counters.get('computed-mirror-seed') ?? 0,
          renderSnapshotDeltaApplies:
            counters.get('computed-mirror-patch-apply-count') ?? 0,
          elementSaveCallsDuringDelta,
          computedSnapshotCallsDuringDelta,
          sceneTreeSamples,
          fullRehydrateReference,
          renderSnapshotSamples,
          strategyGeometrySamples:
            phaseSamples.get('render-layer:strategy:vector') ?? [],
          engineSamples: engineFrameSamples
        }
      },
      {
        pointCount: DENSE_POINT_COUNT,
        sampleFrames: SAMPLE_FRAMES,
        intersectionStep: SELF_INTERSECTION_STEP
      }
    )

    const summary: RenderDeltaProfileSummary = {
      sampleFrames: rawProfile.sampleFrames,
      fullRehydrateCallsDuringDelta: rawProfile.fullRehydrateCallsDuringDelta,
      renderSnapshotDeltaApplies: rawProfile.renderSnapshotDeltaApplies,
      elementSaveCallsDuringDelta: rawProfile.elementSaveCallsDuringDelta,
      computedSnapshotCallsDuringDelta:
        rawProfile.computedSnapshotCallsDuringDelta,
      sceneTree: summarize(rawProfile.sceneTreeSamples),
      fullRehydrateReference: summarize(rawProfile.fullRehydrateReference),
      renderSnapshot: summarize(rawProfile.renderSnapshotSamples),
      strategyGeometry: summarize(rawProfile.strategyGeometrySamples),
      engineHandoff: summarize(rawProfile.engineSamples)
    }

    // This single bounded line is the formal profiling artifact consumed in CI.
    // eslint-disable-next-line no-console
    console.info(`RENDER_DELTA_PROFILE ${JSON.stringify(summary)}`)

    expect(summary.sampleFrames).toBe(SAMPLE_FRAMES)
    expect(summary.fullRehydrateReference.count).toBe(SAMPLE_FRAMES)
    expect(summary.fullRehydrateReference.totalMs).toBeGreaterThan(0)
    expect(summary.fullRehydrateCallsDuringDelta).toBe(0)
    expect(summary.renderSnapshotDeltaApplies).toBe(SAMPLE_FRAMES)
    expectPhaseWithinBudget(summary.sceneTree, PHASE_BUDGETS.sceneTree)
    expectPhaseWithinBudget(
      summary.renderSnapshot,
      PHASE_BUDGETS.renderSnapshot
    )
    expectPhaseWithinBudget(
      summary.strategyGeometry,
      PHASE_BUDGETS.strategyGeometry
    )
    expectPhaseWithinBudget(summary.engineHandoff, PHASE_BUDGETS.engineHandoff)
    expect(
      summary.sceneTree.p95Ms +
        summary.renderSnapshot.p95Ms +
        summary.strategyGeometry.p95Ms +
        summary.engineHandoff.p95Ms
    ).toBeLessThanOrEqual(CRITICAL_PATH_P95_BUDGET_MS)
  })
})
