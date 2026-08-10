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
  strategyGeometryColdStartMs: number
  strategyGeometrySteadyState: PhaseBudget
  engineHandoff: PhaseBudget
}

const SAMPLE_FRAMES = 12
const DENSE_POINT_COUNT = 56
const DENSE_TRANSFORM_POINT_COUNT = 7_001
const SELF_INTERSECTION_STEP = 3
const PHASE_BUDGETS = {
  sceneTree: { totalMs: 24, p95Ms: 4, maxMs: 6 },
  renderSnapshot: { totalMs: 6, p95Ms: 1, maxMs: 2 },
  strategyGeometry: { totalMs: 24, p95Ms: 4, maxMs: 8 },
  strategyGeometrySteadyState: { totalMs: 18, p95Ms: 4, maxMs: 6 },
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

const summarizeStrategyGeometry = (samples: number[]) => ({
  overall: summarize(samples),
  coldStartMs: Number((samples[0] ?? 0).toFixed(3)),
  steadyState: summarize(samples.slice(1))
})

const expectPhaseWithinBudget = (
  phase: PhaseBudget,
  budget: PhaseBudgetLimit,
  expectedCount = SAMPLE_FRAMES
) => {
  expect(phase.count).toBe(expectedCount)
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

test('separates the first cold strategy frame from the steady-state max', () => {
  const profile = summarizeStrategyGeometry([
    6.6, 0.3, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3, 0.5, 0.3, 0.4, 0.3
  ])

  expect(profile).toMatchObject({
    overall: { count: 12, maxMs: 6.6 },
    coldStartMs: 6.6,
    steadyState: { count: 11, maxMs: 0.5 }
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

    await page.exposeFunction('__requestPerformanceTestGarbageCollection', () =>
      page.requestGC()
    )

    const rawProfile = await page.evaluate(
      async ({ pointCount, sampleFrames, intersectionStep }) => {
        // E2E-only access to the currently composed framework runtime.

        const {
          core,
          elementApis,
          getActiveCollaborationHandle,
          subscribeToBrowserDragPhases,
          subscribeToDiagnosticCounters
        } = await import('../src/testing/runtime-access')
        if (!core || !elementApis) {
          throw new Error('Asyra Design E2E runtime is unavailable')
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

        const collaboration = getActiveCollaborationHandle()
        if (!collaboration) {
          throw new Error(
            'Collaboration runtime is unavailable for isolated profiling'
          )
        }
        await collaboration.whenIdle()
        if (collaboration.getStatus() !== 'connected') {
          throw new Error(
            'Collaboration runtime did not settle before isolated profiling'
          )
        }

        const requestTestGarbageCollection = (
          globalThis as typeof globalThis & {
            __requestPerformanceTestGarbageCollection?: () => Promise<void>
          }
        ).__requestPerformanceTestGarbageCollection
        if (typeof requestTestGarbageCollection !== 'function') {
          throw new Error(
            'Performance test garbage-collection control is unavailable'
          )
        }
        await requestTestGarbageCollection()

        const renderForStabilization = core.deps?.render
        if (!renderForStabilization) {
          throw new Error(
            'Render runtime is unavailable for performance stabilization'
          )
        }
        renderForStabilization.requestRender()
        renderForStabilization.flushFrame()

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

        const unsubscribeFromPhases = subscribeToBrowserDragPhases(pushSample)
        const counters = new Map<string, number>()
        const unsubscribeFromCounters = subscribeToDiagnosticCounters(
          (counterName, value) => {
            counters.set(counterName, (counters.get(counterName) ?? 0) + value)
          }
        )

        const sceneTreeSamples: number[] = []
        const engineSamples: number[] = []
        const engineFrameSamples: number[] = []
        let elementSaveCallsDuringDelta = 0
        let computedSnapshotCallsDuringDelta = 0

        const originalPatchLocalComputedData =
          sceneTree.patchLocalComputedData.bind(sceneTree)
        const originalEngineExecute = engine.execute.bind(engine)
        const originalElementSave = element.save.bind(element)
        const originalGetAllComputedData =
          element.getAllComputedData.bind(element)

        core.setSystemProperty('pathEditingMode', true)
        core.setSystemProperty('mouseDown', true)
        core.setSystemProperty('mouseDragging', true)

        sceneTree.patchLocalComputedData = (...args: unknown[]) => {
          const start = performance.now()
          try {
            return originalPatchLocalComputedData(...args)
          } finally {
            sceneTreeSamples.push(performance.now() - start)
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
            const strategySampleStart =
              phaseSamples.get('render-layer:strategy:vector')?.length ?? 0
            elementApis.updateVectorAnchorPointPosition(
              elementId,
              movingPointId,
              {
                x: movingPoint.x + Math.cos(angle) * 8,
                y: movingPoint.y + Math.sin(angle) * 8
              },
              {
                undoable: false,
                skipResult: true,
                transientPreview: true
              }
            )
            await new Promise<void>((resolve, reject) => {
              let remainingFrames = 4
              const waitForStrategy = () => {
                const strategySampleCount =
                  phaseSamples.get('render-layer:strategy:vector')?.length ?? 0
                if (strategySampleCount > strategySampleStart) {
                  resolve()
                  return
                }
                remainingFrames -= 1
                if (remainingFrames === 0) {
                  reject(
                    new Error(
                      `Render strategy did not consume delta sample ${index + 1}`
                    )
                  )
                  return
                }
                requestAnimationFrame(waitForStrategy)
              }
              requestAnimationFrame(waitForStrategy)
            })
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
          sceneTree.patchLocalComputedData = originalPatchLocalComputedData
          engine.execute = originalEngineExecute
          element.save = originalElementSave
          element.getAllComputedData = originalGetAllComputedData
          unsubscribeFromPhases()
          unsubscribeFromCounters()
          core.setSystemProperty('mouseDragging', false)
          core.setSystemProperty('mouseDown', false)
          core.setSystemProperty('pathEditingMode', false)
        }

        const fullRehydrateReference: number[] = []
        for (let index = 0; index < sampleFrames; index += 1) {
          const referenceIterations = 32
          const start = performance.now()
          for (
            let referenceIndex = 0;
            referenceIndex < referenceIterations;
            referenceIndex += 1
          ) {
            originalElementSave()
            originalGetAllComputedData()
          }
          fullRehydrateReference.push(
            (performance.now() - start) / referenceIterations
          )
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
          renderSnapshotSamples:
            phaseSamples.get('render-scene-tree:apply-computed-patch') ?? [],
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

    const strategyGeometry = summarizeStrategyGeometry(
      rawProfile.strategyGeometrySamples
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
      strategyGeometry: strategyGeometry.overall,
      strategyGeometryColdStartMs: strategyGeometry.coldStartMs,
      strategyGeometrySteadyState: strategyGeometry.steadyState,
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
    expect(summary.strategyGeometryColdStartMs).toBeLessThanOrEqual(
      PHASE_BUDGETS.strategyGeometry.maxMs
    )
    expectPhaseWithinBudget(
      summary.strategyGeometrySteadyState,
      PHASE_BUDGETS.strategyGeometrySteadyState,
      SAMPLE_FRAMES - 1
    )
    expectPhaseWithinBudget(summary.engineHandoff, PHASE_BUDGETS.engineHandoff)
    expect(
      summary.sceneTree.p95Ms +
        summary.renderSnapshot.p95Ms +
        summary.strategyGeometry.p95Ms +
        summary.engineHandoff.p95Ms
    ).toBeLessThanOrEqual(CRITICAL_PATH_P95_BUDGET_MS)

    const visualReviewState = await page.evaluate(async (elementId) => {
      // E2E-only access to the currently composed framework runtime.

      const core = (await import('../src/testing/runtime-access')).core
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const renderElement = core?.deps?.render?.getElementById?.(elementId)
      const renderedSnapshot = renderElement?.__renderDataSnapshot ?? {}
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

  test('moves a 7001-point Vector without geometry mutation or strategy execution', async ({
    page
  }, testInfo) => {
    test.setTimeout(120_000)

    const fixture = await page.evaluate(async (pointCount) => {
      const { core, elementApis } = await import(
        '../src/testing/runtime-access'
      )
      if (!core || !elementApis) {
        throw new Error('Asyra Design E2E runtime is unavailable')
      }

      const center = { x: 420, y: 300 }
      const radius = 135
      const pointIds = Array.from(
        { length: pointCount },
        (_, index) => `dense-transform-point-${index}`
      )
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
        pointIds.map((pointId, index) => {
          const id = `dense-transform-segment-${index}`
          return [
            id,
            {
              id,
              startId: pointId,
              endId: pointIds[(index + 1) % pointCount],
              outControlId: null,
              inControlId: null
            }
          ]
        })
      )
      const networks = {
        'dense-transform-network': {
          id: 'dense-transform-network',
          pointIds,
          segmentIds: pointIds.map(
            (_, index) => `dense-transform-segment-${index}`
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
        throw new Error('Failed to create dense Vector transform fixture')
      }

      elementApis.patchElementProperties(
        [
          {
            elementId,
            records: [
              {
                key: 'fills',
                set: {
                  'dense-transform-fill': {
                    kind: 'solid',
                    defaultColorFormat: 'hex',
                    colorFormat: 'hex',
                    color: '#2563eb',
                    opacity: 0.86,
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

      const computed =
        core.deps?.sceneTree
          ?.getElementById?.(elementId)
          ?.getAllComputedData?.() ?? {}
      const zoom = core.getSystemProperty?.('zoom') ?? 1
      const viewport = core.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      return {
        elementId,
        pointCount: Object.keys(computed.points ?? {}).length,
        centerClient: {
          x:
            ((computed.x ?? 0) + (computed.width ?? 0) / 2) * zoom + viewport.x,
          y:
            ((computed.y ?? 0) + (computed.height ?? 0) / 2) * zoom + viewport.y
        }
      }
    }, DENSE_TRANSFORM_POINT_COUNT)

    expect(fixture.pointCount).toBe(DENSE_TRANSFORM_POINT_COUNT)

    const captureStage = async (label: string) => {
      const screenshotPath = testInfo.outputPath(`dense-transform-${label}.png`)
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: 'disabled'
      })
      await testInfo.attach(`dense-transform-${label}`, {
        path: screenshotPath,
        contentType: 'image/png'
      })
    }

    await captureStage('initial')

    await page.evaluate(async (elementId) => {
      const { core } = await import('../src/testing/runtime-access')
      core.selectElements?.([elementId], { undoable: false })
    }, fixture.elementId)
    await page.waitForTimeout(100)
    await captureStage('selected')

    await page.evaluate(async (elementId) => {
      const {
        core,
        startSharedPublicationCapture,
        subscribeToBrowserDragPhases,
        testRuntimeState
      } = await import('../src/testing/runtime-access')
      const element = core.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const phases: { name: string; durationMs: number }[] = []
      const unsubscribe = subscribeToBrowserDragPhases((name, durationMs) => {
        phases.push({ name, durationMs })
      })
      startSharedPublicationCapture('dense-transform-publications')
      testRuntimeState.set('dense-transform-probe', {
        beforePoints: computed.points,
        beforePointSamples: [
          computed.points?.['dense-transform-point-0'],
          computed.points?.['dense-transform-point-3500'],
          computed.points?.['dense-transform-point-7000']
        ].map((point) => ({ x: point?.x, y: point?.y })),
        phases,
        unsubscribe
      })
    }, fixture.elementId)

    await page.mouse.move(fixture.centerClient.x, fixture.centerClient.y)
    await page.mouse.down()
    await page.mouse.move(
      fixture.centerClient.x + 72,
      fixture.centerClient.y + 48,
      { steps: 12 }
    )
    await page.mouse.up()
    await page.waitForTimeout(150)

    const moveProfile = await page.evaluate(async (elementId) => {
      const { core, readTestCapture, stopTestCapture, testRuntimeState } =
        await import('../src/testing/runtime-access')
      const probe = testRuntimeState.get<{
        beforePoints: unknown
        beforePointSamples: { x: number; y: number }[]
        phases: { name: string; durationMs: number }[]
        unsubscribe: () => void
      }>('dense-transform-probe')
      if (!probe) {
        throw new Error('Dense transform probe was not installed')
      }
      probe.unsubscribe()

      const publications = readTestCapture(
        'dense-transform-publications'
      ) as readonly unknown[]
      const canonicalPropertyKeys = new Set<string>()
      const canonicalRecordTypes = new Set<string>()
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(visit)
          return
        }
        if (!value || typeof value !== 'object') {
          return
        }
        const record = value as Record<string, unknown>
        const eventName =
          typeof record.eventName === 'string' ? record.eventName : record.type
        if (
          eventName === 'addProperty' ||
          eventName === 'removeProperty' ||
          eventName === 'updateProperty'
        ) {
          const payload =
            record.payload && typeof record.payload === 'object'
              ? (record.payload as Record<string, unknown>)
              : {}
          if (typeof payload.key === 'string') {
            canonicalPropertyKeys.add(payload.key)
          }
          if (
            eventName === 'updateProperty' &&
            typeof payload.id === 'string'
          ) {
            const propertyType = payload.propertyType
            if (typeof propertyType === 'string') {
              canonicalRecordTypes.add(propertyType)
            }
          }
          if (Array.isArray(payload.data)) {
            payload.data.forEach((entry) => {
              if (
                entry &&
                typeof entry === 'object' &&
                typeof (entry as { type?: unknown }).type === 'string'
              ) {
                canonicalRecordTypes.add((entry as { type: string }).type)
              }
            })
          }
        }
        Object.values(record).forEach(visit)
      }
      publications.forEach(visit)

      const computed =
        core.deps?.sceneTree
          ?.getElementById?.(elementId)
          ?.getAllComputedData?.() ?? {}
      const afterPointSamples = [
        computed.points?.['dense-transform-point-0'],
        computed.points?.['dense-transform-point-3500'],
        computed.points?.['dense-transform-point-7000']
      ].map((point) => ({ x: point?.x, y: point?.y }))
      const moveSamples = probe.phases
        .filter(({ name }) => name === 'move-elements:apply-positions')
        .map(({ durationMs }) => durationMs)
      const geometryStrategySamples = probe.phases.filter(
        ({ name }) => name === 'render-layer:strategy:vector'
      )

      stopTestCapture('dense-transform-publications')
      testRuntimeState.delete('dense-transform-probe')

      return {
        pointCount: Object.keys(computed.points ?? {}).length,
        pointsIdentityPreserved: computed.points === probe.beforePoints,
        pointSamplesPreserved:
          JSON.stringify(afterPointSamples) ===
          JSON.stringify(probe.beforePointSamples),
        canonicalPropertyKeys: [...canonicalPropertyKeys].sort(),
        canonicalRecordTypes: [...canonicalRecordTypes].sort(),
        moveSamples,
        geometryStrategyCount: geometryStrategySamples.length,
        x: computed.x,
        y: computed.y
      }
    }, fixture.elementId)

    expect(moveProfile.pointCount).toBe(DENSE_TRANSFORM_POINT_COUNT)
    expect(moveProfile.pointsIdentityPreserved).toBe(true)
    expect(moveProfile.pointSamplesPreserved).toBe(true)
    expect(moveProfile.canonicalPropertyKeys).toEqual(['x', 'y'])
    expect(moveProfile.canonicalRecordTypes).not.toContain('vectorPoint')
    expect(moveProfile.canonicalRecordTypes).not.toContain('vectorSegment')
    expect(moveProfile.canonicalRecordTypes).not.toContain('vectorNetwork')
    expect(moveProfile.moveSamples.length).toBeGreaterThan(0)
    expect(moveProfile.geometryStrategyCount).toBe(0)

    // One bounded line is the reviewable performance artifact for the exact
    // 7,001-point pointer-drag state used by the screenshots below.
    // eslint-disable-next-line no-console
    console.info(
      `DENSE_VECTOR_TRANSFORM_PROFILE ${JSON.stringify({
        pointCount: moveProfile.pointCount,
        moveUpdates: moveProfile.moveSamples.length,
        moveTotalMs: Number(
          moveProfile.moveSamples
            .reduce((total, sample) => total + sample, 0)
            .toFixed(3)
        ),
        moveMaxMs: Number(Math.max(...moveProfile.moveSamples, 0).toFixed(3)),
        geometryStrategyCount: moveProfile.geometryStrategyCount,
        canonicalPropertyKeys: moveProfile.canonicalPropertyKeys
      })}`
    )

    await captureStage('moved')

    await page.evaluate(async (elementId) => {
      const { core, elementApis } = await import(
        '../src/testing/runtime-access'
      )
      const computed =
        core.deps?.sceneTree
          ?.getElementById?.(elementId)
          ?.getAllComputedData?.() ?? {}
      elementApis.changeElementGeometry(
        elementId,
        {
          width: (computed.width ?? 1) * 1.15,
          height: (computed.height ?? 1) * 0.9,
          rotation: 0.14
        },
        { undoable: false }
      )
    }, fixture.elementId)
    await page.waitForTimeout(150)
    await captureStage('transformed-selected')

    await page.evaluate(async (elementId) => {
      const { core } = await import('../src/testing/runtime-access')
      core.setSystemProperty?.('pathEditingVectorId', elementId)
      core.setSystemProperty?.('pathEditingMode', true)
    }, fixture.elementId)
    await page.waitForTimeout(150)
    await captureStage('path-edit')
  })

  test('preserves fresh snapshot equivalence through action replay and load', async ({
    page
  }) => {
    test.setTimeout(120_000)

    const result = await page.evaluate(async () => {
      // E2E-only access to the currently composed framework runtime.

      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const factory = core?.deps?.factory
      if (
        !core ||
        !elementApis ||
        typeof factory?.undo !== 'function' ||
        typeof factory?.redo !== 'function'
      ) {
        throw new Error('Asyra Design replay runtime is unavailable')
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
        const rendered = renderElement.__renderDataSnapshot
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
