import { expect, test } from '@playwright/test'

import {
  captureBrowserErrors,
  createTestDocumentURL,
  getCapturedBrowserErrors,
  resetCanvas,
  waitForAppReady
} from './test-utils'

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
    // The bounded profile budgets p95 and max separately. Use the lower sample
    // quantile so one maximum sample does not make those two oracles identical.
    const index = Math.min(
      ordered.length - 1,
      Math.max(0, Math.floor((ordered.length - 1) * ratio))
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

test('keeps the bounded p95 sample distinct from the separately budgeted max', () => {
  expect(summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toMatchObject({
    p95Ms: 11,
    maxMs: 12
  })
})

test.describe('Render delta performance budget', () => {
  test.beforeEach(async ({ page }) => {
    captureBrowserErrors(page)

    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(async ({ page }) => {
    expect(getCapturedBrowserErrors(page)).toEqual([])
  })

  test('profiles the current dense-vector owner phases without adding cache semantics', async ({
    page
  }, testInfo) => {
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
        elementApis.patchElementProperties(
          [
            {
              elementId,
              records: [
                {
                  key: 'fills',
                  set: {
                    'dense-vector-fill': {
                      kind: 'solid',
                      defaultColorFormat: 'hex',
                      colorFormat: 'hex',
                      color: '#64748b',
                      opacity: 1,
                      visible: true,
                      gradient: null
                    }
                  }
                }
              ]
            }
          ],
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
        const previousCounterSink = runtimeGlobal.__asyraDiagnosticCounterSink
        const counters = new Map<string, number>()
        runtimeGlobal.__asyraDiagnosticCounterSink = (
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

        const originalPatchComputedDataForElements =
          sceneTree.patchComputedDataForElements.bind(sceneTree)
        const originalCommitSceneTreeTransaction =
          sceneTree.commitSceneTreeTransaction.bind(sceneTree)
        const originalEngineExecute = engine.execute.bind(engine)
        const originalElementSave = element.save.bind(element)
        const originalGetAllComputedData =
          element.getAllComputedData.bind(element)

        core.setSystemProperty('pathEditingMode', true)
        core.setSystemProperty('mouseDown', true)
        core.setSystemProperty('mouseDragging', true)

        sceneTree.patchComputedDataForElements = (...args: unknown[]) => {
          const start = performance.now()
          try {
            return originalPatchComputedDataForElements(...args)
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
          sceneTree.patchComputedDataForElements =
            originalPatchComputedDataForElements
          sceneTree.commitSceneTreeTransaction =
            originalCommitSceneTreeTransaction
          engine.execute = originalEngineExecute
          element.save = originalElementSave
          element.getAllComputedData = originalGetAllComputedData
          runtimeGlobal.__asyraBrowserDragPhaseSink = previousPhaseSink
          runtimeGlobal.__asyraDiagnosticCounterSink = previousCounterSink
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
          elementId,
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
    // These all-owner counts include canonical/UI consumers. Render's own
    // authoritative read is the separately instrumented seed count above.
    expect(summary.elementSaveCallsDuringDelta).toBeLessThanOrEqual(
      SAMPLE_FRAMES
    )
    expect(summary.computedSnapshotCallsDuringDelta).toBeLessThanOrEqual(
      SAMPLE_FRAMES + 1
    )
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

    const visualReviewState = await page.evaluate((elementId) => {
      // E2E-only access to the currently composed framework runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const renderElement = core?.deps?.render?.getElementById?.(elementId)
      const renderedSnapshot =
        renderElement?.__asyraLastRenderDataSnapshot ?? {}
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewportPosition = core?.getSystemProperty?.(
        'viewportPosition'
      ) ?? {
        x: 0,
        y: 0
      }
      const usesWorkspacePoints = computed.pointCoordinateSpace === 'workspace'
      const clientPoints = Object.values(computed.points ?? {}).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (point: any) => ({
          x:
            (point.x + (usesWorkspacePoints ? 0 : (computed.x ?? 0))) * zoom +
            viewportPosition.x,
          y:
            (point.y + (usesWorkspacePoints ? 0 : (computed.y ?? 0))) * zoom +
            viewportPosition.y
        })
      )
      const clientBounds = clientPoints.reduce(
        (bounds, point) => ({
          minX: Math.min(bounds.minX, point.x),
          minY: Math.min(bounds.minY, point.y),
          maxX: Math.max(bounds.maxX, point.x),
          maxY: Math.max(bounds.maxY, point.y)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        }
      )
      const cropMargin = 40

      return {
        elementId,
        computed: {
          points: computed.points ?? {},
          segments: computed.segments ?? {},
          networks: computed.networks ?? {},
          fills: computed.fills ?? []
        },
        rendered: {
          points: renderedSnapshot.points ?? {},
          segments: renderedSnapshot.segments ?? {},
          networks: renderedSnapshot.networks ?? {},
          fills: renderedSnapshot.fills ?? []
        },
        pointCount: Object.keys(computed.points ?? {}).length,
        segmentCount: Object.keys(computed.segments ?? {}).length,
        networkCount: Object.keys(computed.networks ?? {}).length,
        pathEditingMode: core?.getSystemProperty?.('pathEditingMode') ?? false,
        mouseDown: core?.getSystemProperty?.('mouseDown') ?? false,
        mouseDragging: core?.getSystemProperty?.('mouseDragging') ?? false,
        zoom,
        viewportPosition,
        screenshotClip: {
          x: Math.max(0, Math.floor(clientBounds.minX - cropMargin)),
          y: Math.max(0, Math.floor(clientBounds.minY - cropMargin)),
          width: Math.ceil(
            clientBounds.maxX - clientBounds.minX + cropMargin * 2
          ),
          height: Math.ceil(
            clientBounds.maxY - clientBounds.minY + cropMargin * 2
          )
        }
      }
    }, rawProfile.elementId)

    expect(visualReviewState.pointCount).toBe(DENSE_POINT_COUNT)
    expect(visualReviewState.segmentCount).toBe(DENSE_POINT_COUNT)
    expect(visualReviewState.networkCount).toBe(1)
    expect(visualReviewState.rendered).toEqual(visualReviewState.computed)
    expect(visualReviewState.pathEditingMode).toBe(false)
    expect(visualReviewState.mouseDown).toBe(false)
    expect(visualReviewState.mouseDragging).toBe(false)

    const screenshotPath = testInfo.outputPath('dense-vector-final.png')
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: 'disabled'
    })
    await testInfo.attach('dense-vector-final', {
      path: screenshotPath,
      contentType: 'image/png'
    })
    const screenshotCropPath = testInfo.outputPath(
      'dense-vector-final-crop.png'
    )
    await page.screenshot({
      path: screenshotCropPath,
      clip: visualReviewState.screenshotClip,
      animations: 'disabled'
    })
    await testInfo.attach('dense-vector-final-crop', {
      path: screenshotCropPath,
      contentType: 'image/png'
    })

    // This bounded line records the exact live state used by screenshot review.
    // eslint-disable-next-line no-console
    console.info(
      `RENDER_DELTA_VISUAL_STATE ${JSON.stringify({
        elementId: visualReviewState.elementId,
        pointCount: visualReviewState.pointCount,
        segmentCount: visualReviewState.segmentCount,
        networkCount: visualReviewState.networkCount,
        fillCount: visualReviewState.computed.fills.length,
        zoom: visualReviewState.zoom,
        viewportPosition: visualReviewState.viewportPosition,
        screenshotClip: visualReviewState.screenshotClip,
        pathEditingMode: visualReviewState.pathEditingMode
      })}`
    )
  })

  test('preserves fresh snapshot equivalence through action replay and load', async ({
    page
  }) => {
    test.setTimeout(120_000)

    const result = await page.evaluate(async () => {
      // E2E-only access to the currently composed framework runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const factory = core?.deps?.factory
      if (
        !core ||
        !elementApis ||
        typeof factory?.undo !== 'function' ||
        typeof factory?.redo !== 'function'
      ) {
        throw new Error('Asyra replay runtime is unavailable')
      }

      const waitForStableFrame = () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      const initialPoints = {
        A: {
          id: 'A',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 100,
          y: 100
        },
        B: {
          id: 'B',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 220,
          y: 100
        },
        C: {
          id: 'C',
          kind: 'anchor',
          anchorType: 'sharp',
          x: 160,
          y: 220
        }
      }
      const elementId = elementApis.createElement(
        {
          type: 'vector',
          points: initialPoints,
          segments: {
            AB: {
              id: 'AB',
              startId: 'A',
              endId: 'B',
              outControlId: null,
              inControlId: null
            },
            BC: {
              id: 'BC',
              startId: 'B',
              endId: 'C',
              outControlId: null,
              inControlId: null
            },
            CA: {
              id: 'CA',
              startId: 'C',
              endId: 'A',
              outControlId: null,
              inControlId: null
            }
          },
          networks: {
            triangle: {
              id: 'triangle',
              pointIds: ['A', 'B', 'C'],
              segmentIds: ['AB', 'BC', 'CA'],
              closed: true
            }
          },
          closed: true
        },
        { undoable: false }
      )
      if (!elementId) {
        throw new Error('Failed to create replay equivalence fixture')
      }
      await waitForStableFrame()

      const clone = (value: unknown) =>
        JSON.parse(JSON.stringify(value)) as Record<string, unknown>
      const capture = (phase: string) => {
        const element = core.deps.sceneTree.getElementById(elementId)
        const renderElement = core.deps.render.getElementById(elementId)
        if (!element || !renderElement) {
          throw new Error(`Missing projection during ${phase}`)
        }
        const fresh = {
          ...element.save(),
          ...element.getAllComputedData()
        }
        const rendered = renderElement.__asyraLastRenderDataSnapshot
        if (!rendered) {
          throw new Error(`Missing strategy snapshot during ${phase}`)
        }
        const normalizedFresh = clone(fresh)
        return {
          phase,
          pointAX: Number(
            (normalizedFresh.points as Record<string, { x?: unknown }>)?.A?.x ??
              Number.NaN
          ),
          fresh: normalizedFresh,
          rendered: clone(rendered)
        }
      }

      elementApis.patchElementProperties(
        [
          {
            elementId,
            records: [
              {
                key: 'points',
                set: {
                  A: { x: 140 }
                }
              }
            ]
          }
        ],
        { undoable: true }
      )
      await waitForStableFrame()
      const action = capture('action')

      factory.undo()
      await waitForStableFrame()
      const undo = capture('undo')

      factory.redo()
      await waitForStableFrame()
      const redo = capture('redo')
      const persisted = await core.save()

      elementApis.patchElementProperties(
        [
          {
            elementId,
            records: [
              {
                key: 'points',
                set: {
                  A: { x: 180 }
                }
              }
            ]
          }
        ],
        { undoable: false }
      )
      await waitForStableFrame()
      core.load(persisted)
      await waitForStableFrame()
      const load = capture('load')

      return [action, undo, redo, load]
    })

    expect(result.map(({ pointAX }) => pointAX)).toEqual([140, 100, 140, 140])
    result.forEach(({ rendered, fresh }) => {
      expect(rendered).toEqual(fresh)
    })
  })
})
