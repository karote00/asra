import { writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  createVectorPath,
  fillStrokeDashGap,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  waitForAppReady
} from './test-utils'

type DragTarget =
  | 'anchor'
  | 'in-control'
  | 'out-control'
  | 'first-anchor-in-control'
type StrokeCase =
  | { label: string; style: 'solid'; position: 'center'; cap: 'round' }
  | {
      label: string
      style: 'dashed'
      position: 'inside'
      cap: 'butt' | 'square' | 'round'
    }

interface ClientPoint {
  x: number
  y: number
}

interface DragMetrics {
  label: string
  frameCount: number
  paintFrameCount: number
  averageMs: number
  p95Ms: number
  maxMs: number
  droppedFrameCount: number
  dominantPhase: string
  productRenderObserved: boolean
  computedPatchFrameCount: number
  sceneTreeVectorRenderFrameCount: number
  productVectorRenderFrameCount: number
  pixiRenderFrameCount: number
  productRenderLatencyP95Ms: number
  pixiRenderLatencyP95Ms: number
  renderFlushFrameCount: number
  directRenderPropertyFrameCount: number
  overlayRenderFrameCount: number
  overlayOnlyFrameCount: number
  lateProductRenderFrameCount: number
  paintSchedulingP95MinusBaseline: number
  instrumentationGaps: string[]
  instrumentationErrors: { phaseName: string; message: string }[]
  freshnessProbe: FreshnessProbe | null
  phaseP95Ms: Record<string, number>
  phaseAverageMs: Record<string, number>
  phaseTotalMs: Record<string, number>
  counters: Record<string, number>
}

interface SchedulingBaselineMetrics {
  frameCount: number
  averageMs: number
  p95Ms: number
  maxMs: number
}

interface FrameProfile {
  dragFrameId: string
  paintIndex: number
  browserStartMs: number
  elapsedMs: number
  phases: {
    phaseName: string
    durationMs: number
    startMs?: number
    endMs?: number
  }[]
  counters: Record<string, number>
  errors: { phaseName: string; message: string }[]
}

interface FreshnessProbe {
  sourceDeltaPx: number
  visualSignalDelta: number
  sourceMoved: boolean
  visualChanged: boolean
}

interface StrokeRasterCapture {
  base64: string
  clipX: number
  clipY: number
  width: number
  height: number
  zoom: number
  viewport: ClientPoint
  rect: { x: number; y: number; width: number; height: number }
}

interface LocalProbePoint {
  label: string
  point: ClientPoint
  radius: number
}

interface RuleDrivenStrokeProbes {
  body: LocalProbePoint[]
  gap: LocalProbePoint[]
  rejected: LocalProbePoint[]
}

interface BurstDragMetrics {
  label: string
  moveEventCount: number
  paintFrameCount: number
  elapsedToFirstPaintMs: number
  elapsedToLastObservedPaintMs: number
  productRenderPhaseCount: number
  pixiRenderPhaseCount: number
  renderFlushPhaseCount: number
  vectorCommitCount: number
  computedPatchCount: number
  computedMirrorCommitCount: number
  productRenderPerObservedPaint: number
  pixiRenderPerObservedPaint: number
  freshnessProbe: FreshnessProbe
  phaseTotalMs: Record<string, number>
  counters: Record<string, number>
}

const FRAME_BUDGET_120FPS_MS = 8.33
const VECTOR_POINT_DRAG_RESOLVED_GEOMETRY_P95_BUDGET_MS = Number(
  process.env.ASYRA_VECTOR_POINT_DRAG_RESOLVED_GEOMETRY_P95_BUDGET_MS ??
    FRAME_BUDGET_120FPS_MS
)
const DRAG_STEP_COUNT = Number(process.env.ASYRA_STROKE_DRAG_E2E_STEPS ?? 24)
const DEBUG_SCENARIO_FILTER =
  process.env.ASYRA_STROKE_DRAG_E2E_SCENARIO_FILTER ?? ''
const SHOULD_ENFORCE_120FPS =
  process.env.ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS === '1'
const STROKE_OPACITY_PERCENT = '50'
const STROKE_WIDTH = 10
const PERFORMANCE_STROKE_COLOR = '#18d42a'
const PERFORMANCE_FILL_COLOR = '#cccccc'

const STROKE_CASES: StrokeCase[] = [
  {
    label: 'inside-dashed-butt',
    style: 'dashed',
    position: 'inside',
    cap: 'butt'
  },
  {
    label: 'inside-dashed-square',
    style: 'dashed',
    position: 'inside',
    cap: 'square'
  },
  {
    label: 'inside-dashed-round',
    style: 'dashed',
    position: 'inside',
    cap: 'round'
  },
  {
    label: 'center-solid-round',
    style: 'solid',
    position: 'center',
    cap: 'round'
  }
]

const DRAG_TARGETS: DragTarget[] = [
  'anchor',
  'in-control',
  'out-control',
  'first-anchor-in-control'
]

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const installFrameProfiler = (page: Page, dragFrameId: string) =>
  page.evaluate((frameId) => {
    interface FrameProfileState {
      phases: {
        phaseName: string
        durationMs: number
        startMs?: number
        endMs?: number
      }[]
      counters: Record<string, number>
      dragFrameId: string
      errors: { phaseName: string; message: string }[]
    }

    const state: FrameProfileState = {
      phases: [],
      counters: {},
      dragFrameId: frameId,
      errors: []
    }
    ;(
      window as typeof window & {
        __asyraStrokeDragFrameProfile?: FrameProfileState
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokeDragFrameProfile = state

    const recordPhase = (phaseName: string, durationMs: number) => {
      const endMs = performance.now()
      state.phases.push({
        phaseName,
        durationMs,
        startMs: endMs - durationMs,
        endMs
      })
    }
    const recordCounter = (counterName: string, value = 1) => {
      state.counters[counterName] = (state.counters[counterName] ?? 0) + value
    }

    ;(
      window as typeof window & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraBrowserDragPhaseSink = recordPhase
    ;(
      window as typeof window & {
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraVectorRenderPhaseSink = recordPhase
    ;(
      window as typeof window & {
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraStrokePipelineCounterSink = recordCounter
  }, dragFrameId)

const collectPaintFrameProfiler = (
  page: Page,
  dragFrameId: string,
  paintIndex: number,
  browserStartMs: number,
  elapsedMs: number
): Promise<FrameProfile> =>
  page.evaluate(
    ({ frameId, index, frameStartMs, durationMs }) => {
      interface FrameProfileState {
        phases: {
          phaseName: string
          durationMs: number
          startMs?: number
          endMs?: number
        }[]
        counters: Record<string, number>
        dragFrameId: string
        errors: { phaseName: string; message: string }[]
      }
      const win = window as typeof window & {
        __asyraStrokeDragFrameProfile?: FrameProfileState
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
      const profile = win.__asyraStrokeDragFrameProfile ?? {
        phases: [],
        counters: {},
        dragFrameId: frameId,
        errors: []
      }
      const collectEndMs = frameStartMs + durationMs
      const timedPhases = profile.phases.filter(
        (phase) =>
          typeof phase.startMs === 'number' && typeof phase.endMs === 'number'
      )
      const clippedPhaseIntervals = timedPhases
        .map((phase) => ({
          startMs: Math.max(frameStartMs, phase.startMs as number),
          endMs: Math.min(collectEndMs, phase.endMs as number)
        }))
        .filter((interval) => interval.endMs > interval.startMs)
        .sort((left, right) => left.startMs - right.startMs)
      let coveredPhaseMs = 0
      let currentStartMs: number | null = null
      let currentEndMs: number | null = null
      clippedPhaseIntervals.forEach((interval) => {
        if (currentStartMs === null || currentEndMs === null) {
          currentStartMs = interval.startMs
          currentEndMs = interval.endMs
          return
        }

        if (interval.startMs <= currentEndMs) {
          currentEndMs = Math.max(currentEndMs, interval.endMs)
          return
        }

        coveredPhaseMs += currentEndMs - currentStartMs
        currentStartMs = interval.startMs
        currentEndMs = interval.endMs
      })
      if (currentStartMs !== null && currentEndMs !== null) {
        coveredPhaseMs += currentEndMs - currentStartMs
      }
      const firstPhaseStartMs =
        clippedPhaseIntervals[0]?.startMs ?? frameStartMs
      const lastPhaseEndMs =
        clippedPhaseIntervals[clippedPhaseIntervals.length - 1]?.endMs ??
        frameStartMs
      profile.phases.push({
        phaseName: 'browser:pre-work-wait',
        durationMs: Math.max(0, firstPhaseStartMs - frameStartMs),
        startMs: frameStartMs,
        endMs: firstPhaseStartMs
      })
      profile.phases.push({
        phaseName: 'browser:post-work-wait',
        durationMs: Math.max(0, collectEndMs - lastPhaseEndMs),
        startMs: lastPhaseEndMs,
        endMs: collectEndMs
      })
      profile.phases.push({
        phaseName: 'browser:paint-wait',
        durationMs: Math.max(0, durationMs - coveredPhaseMs),
        startMs: frameStartMs,
        endMs: collectEndMs
      })
      const paintProfile = {
        dragFrameId: profile.dragFrameId,
        paintIndex: index,
        browserStartMs: frameStartMs,
        elapsedMs: durationMs,
        phases: profile.phases,
        counters: profile.counters,
        errors: profile.errors ?? []
      }
      profile.phases = []
      profile.counters = {}
      profile.errors = []
      return paintProfile
    },
    {
      frameId: dragFrameId,
      index: paintIndex,
      frameStartMs: browserStartMs,
      durationMs: elapsedMs
    }
  )

const uninstallFrameProfiler = (page: Page) =>
  page.evaluate(() => {
    const win = window as typeof window & {
      __asyraStrokeDragFrameProfile?: unknown
      __asyraBrowserDragPhaseSink?: unknown
      __asyraVectorRenderPhaseSink?: unknown
      __asyraStrokePipelineCounterSink?: unknown
    }
    win.__asyraBrowserDragPhaseSink = undefined
    win.__asyraVectorRenderPhaseSink = undefined
    win.__asyraStrokePipelineCounterSink = undefined
    win.__asyraStrokeDragFrameProfile = undefined
  })

const summarizeFrameProfiles = (
  frameProfiles: FrameProfile[],
  frameCount: number,
  schedulingBaseline: SchedulingBaselineMetrics
) => {
  const phaseValues = new Map<string, number[]>()
  const counters: Record<string, number> = {}
  const instrumentationErrors: { phaseName: string; message: string }[] = []
  const firstPaintProfiles = frameProfiles.filter(
    (profile) => profile.paintIndex === 0
  )
  const latencyProfiles =
    firstPaintProfiles.length > 0 ? firstPaintProfiles : frameProfiles

  latencyProfiles.forEach((profile) => {
    profile.phases.forEach(({ phaseName, durationMs }) => {
      const values = phaseValues.get(phaseName) ?? []
      values.push(durationMs)
      phaseValues.set(phaseName, values)
    })
    Object.entries(profile.counters).forEach(([counterName, value]) => {
      counters[counterName] = (counters[counterName] ?? 0) + value
    })
  })
  frameProfiles.forEach((profile) => {
    instrumentationErrors.push(...profile.errors)
  })

  const phaseP95Ms: Record<string, number> = {}
  const phaseAverageMs: Record<string, number> = {}
  const phaseTotalMs: Record<string, number> = {}
  phaseValues.forEach((values, phaseName) => {
    const total = values.reduce((sum, value) => sum + value, 0)
    phaseP95Ms[phaseName] = getPercentile(values, 0.95)
    phaseAverageMs[phaseName] = total / frameCount
    phaseTotalMs[phaseName] = total
  })

  const dominantPhase =
    Object.entries(phaseP95Ms).sort(
      (left, right) => right[1] - left[1]
    )[0]?.[0] ?? 'none'
  const uniqueFrameIds = [
    ...new Set(frameProfiles.map((profile) => profile.dragFrameId))
  ]
  const profilesForFrame = (frameId: string) =>
    frameProfiles.filter((profile) => profile.dragFrameId === frameId)
  const frameHasPhase = (predicate: (phaseName: string) => boolean) =>
    uniqueFrameIds.filter((frameId) =>
      profilesForFrame(frameId).some((profile) =>
        profile.phases.some((phase) => predicate(phase.phaseName))
      )
    ).length
  const frameHasCounter = (counterName: string) =>
    uniqueFrameIds.filter((frameId) =>
      profilesForFrame(frameId).some((profile) =>
        Object.prototype.hasOwnProperty.call(profile.counters, counterName)
      )
    ).length
  const isProductVectorRenderPhase = (phaseName: string) =>
    phaseName === 'render-layer:strategy:vector' ||
    phaseName.startsWith('path/topology') ||
    phaseName.startsWith('constrained dashed final coverage:') ||
    phaseName === 'mesh render'
  const productRenderFrameIds = uniqueFrameIds.filter((frameId) =>
    profilesForFrame(frameId).some((profile) =>
      profile.phases.some((phase) =>
        isProductVectorRenderPhase(phase.phaseName)
      )
    )
  )
  const getFramePhaseEndLatencyMs = (
    frameId: string,
    predicate: (phaseName: string) => boolean
  ) => {
    const profiles = profilesForFrame(frameId)
    const frameStartMs = Math.min(
      ...profiles.map((profile) => profile.browserStartMs)
    )
    const phaseEndTimes = profiles.flatMap((profile) =>
      profile.phases
        .filter(
          (phase) =>
            predicate(phase.phaseName) && typeof phase.endMs === 'number'
        )
        .map((phase) => phase.endMs as number)
        .filter((endMs) => endMs >= frameStartMs)
    )
    if (phaseEndTimes.length === 0) {
      return null
    }
    return Math.min(...phaseEndTimes) - frameStartMs
  }
  const productRenderLatencyValues = uniqueFrameIds
    .map((frameId) =>
      getFramePhaseEndLatencyMs(frameId, isProductVectorRenderPhase)
    )
    .filter((value): value is number => value !== null)
  const pixiRenderLatencyValues = uniqueFrameIds
    .map((frameId) =>
      getFramePhaseEndLatencyMs(frameId, (phaseName) =>
        phaseName.startsWith('render:pixi-')
      )
    )
    .filter((value): value is number => value !== null)
  const lateProductRenderFrameCount = productRenderFrameIds.filter((frameId) =>
    profilesForFrame(frameId)
      .filter((profile) => profile.paintIndex > 0)
      .some((profile) =>
        profile.phases.some((phase) =>
          isProductVectorRenderPhase(phase.phaseName)
        )
      )
  ).length
  const overlayOnlyFrameCount = uniqueFrameIds.filter((frameId) => {
    const profiles = profilesForFrame(frameId)
    const hasOverlay = profiles.some((profile) =>
      profile.phases.some((phase) =>
        phase.phaseName.startsWith('editing-overlay:')
      )
    )
    const hasProductRender = profiles.some((profile) =>
      profile.phases.some((phase) =>
        isProductVectorRenderPhase(phase.phaseName)
      )
    )
    return hasOverlay && !hasProductRender
  }).length
  const instrumentationGaps: string[] = []
  if (
    frameHasCounter('vector-api-commit-transient-count') > 0 &&
    frameHasCounter('vector-api-commit-patch-key-count-observed') === 0
  ) {
    instrumentationGaps.push('missing-vector-commit-patch-key-count')
  }
  if (frameHasCounter('vector-api-commit-build-patch-error-count') > 0) {
    instrumentationGaps.push('vector-api-commit-build-patch-error')
  }

  return {
    dominantPhase,
    productRenderObserved: productRenderFrameIds.length > 0,
    computedPatchFrameCount:
      frameHasPhase(
        (phaseName) => phaseName === 'computed:changeComputedData'
      ) || frameHasCounter('vector-api-commit-patch-key-count-observed'),
    sceneTreeVectorRenderFrameCount: frameHasPhase(
      (phaseName) =>
        phaseName === 'render-scene-tree:update-element' ||
        phaseName === 'render-layer:strategy:vector'
    ),
    productVectorRenderFrameCount: productRenderFrameIds.length,
    directRenderPropertyFrameCount: frameHasPhase(
      (phaseName) => phaseName === 'render-layer:update-property'
    ),
    pixiRenderFrameCount: frameHasPhase((phaseName) =>
      phaseName.startsWith('render:pixi-')
    ),
    productRenderLatencyP95Ms: getPercentile(productRenderLatencyValues, 0.95),
    pixiRenderLatencyP95Ms: getPercentile(pixiRenderLatencyValues, 0.95),
    renderFlushFrameCount: frameHasPhase(
      (phaseName) =>
        phaseName === 'render:update-layers' ||
        phaseName === 'render-scene-tree:flush'
    ),
    overlayRenderFrameCount: frameHasPhase((phaseName) =>
      phaseName.startsWith('editing-overlay:')
    ),
    overlayOnlyFrameCount,
    lateProductRenderFrameCount,
    paintSchedulingP95MinusBaseline:
      (phaseP95Ms['browser:paint-wait'] ?? 0) - schedulingBaseline.p95Ms,
    instrumentationGaps,
    instrumentationErrors,
    phaseP95Ms,
    phaseAverageMs,
    phaseTotalMs,
    counters
  }
}

const aggregateProfiles = (frameProfiles: FrameProfile[]) => {
  const phaseTotalMs: Record<string, number> = {}
  const counters: Record<string, number> = {}
  frameProfiles.forEach((profile) => {
    profile.phases.forEach(({ phaseName, durationMs }) => {
      phaseTotalMs[phaseName] = (phaseTotalMs[phaseName] ?? 0) + durationMs
    })
    Object.entries(profile.counters).forEach(([counterName, value]) => {
      counters[counterName] = (counters[counterName] ?? 0) + value
    })
  })

  const countPhase = (predicate: (phaseName: string) => boolean) =>
    frameProfiles.reduce(
      (count, profile) =>
        count +
        profile.phases.filter((phase) => predicate(phase.phaseName)).length,
      0
    )

  return {
    phaseTotalMs,
    counters,
    productRenderPhaseCount: countPhase(
      (phaseName) => phaseName === 'render-layer:strategy:vector'
    ),
    pixiRenderPhaseCount: countPhase((phaseName) =>
      phaseName.startsWith('render:pixi-')
    ),
    renderFlushPhaseCount: countPhase(
      (phaseName) => phaseName === 'render-scene-tree:flush'
    )
  }
}

const assertRequiredPhaseCoverage = (metric: DragMetrics) => {
  const requiresEditingOverlay = !metric.label.startsWith('move-vector:')
  const phaseNames = Object.keys(metric.phaseP95Ms)
  const hasPhase = (predicate: (phaseName: string) => boolean) =>
    phaseNames.some(predicate)

  expect(
    hasPhase((phaseName) => phaseName.startsWith('input:pointer')),
    `${metric.label} should include pointer input phases`
  ).toBe(true)
  expect(
    hasPhase(
      (phaseName) =>
        phaseName.startsWith('feature:event:') ||
        phaseName.startsWith('feature-session:')
    ),
    `${metric.label} should include feature/session phases`
  ).toBe(true)
  expect(
    hasPhase(
      (phaseName) =>
        phaseName.startsWith('render:') ||
        phaseName.startsWith('render-layer:') ||
        phaseName.startsWith('path/topology') ||
        phaseName.startsWith('constrained dashed final coverage:') ||
        phaseName === 'mesh render'
    ),
    `${metric.label} should include render phases; got ${phaseNames.join(', ')}`
  ).toBe(true)
  if (requiresEditingOverlay) {
    expect(
      hasPhase((phaseName) => phaseName.startsWith('editing-overlay:')),
      `${metric.label} should include editing overlay phases`
    ).toBe(true)
  }
  expect(
    hasPhase((phaseName) => phaseName === 'browser:paint-wait'),
    `${metric.label} should include browser paint wait`
  ).toBe(true)
  if (metric.label.startsWith('move-vector:')) {
    expect(
      metric.productRenderObserved || metric.directRenderPropertyFrameCount > 0,
      `${metric.label} should observe product vector render or direct transform update`
    ).toBe(true)
    return
  }
  expect(
    metric.freshnessProbe,
    `${metric.label} should include path editing freshness probe`
  ).not.toBeNull()
  expect(
    metric.computedPatchFrameCount,
    `${metric.label} should apply computed data patches during path editing drag`
  ).toBeGreaterThan(0)
  expect(
    metric.productRenderObserved,
    `${metric.label} should observe product vector render during path editing drag`
  ).toBe(true)
  expect(
    metric.freshnessProbe?.sourceMoved,
    `${metric.label} should actually move the edited source point`
  ).toBe(true)
  expect(
    metric.freshnessProbe?.visualChanged,
    `${metric.label} should visibly update the product stroke during drag`
  ).toBe(true)
}

const assertVectorPointDragPerformanceBudget = (metrics: DragMetrics[]) => {
  const pointDragMetrics = metrics.filter(
    (metric) => !metric.label.startsWith('move-vector:')
  )
  const resolvedGeometryP95Values = pointDragMetrics.map(
    (metric) => metric.phaseP95Ms['resolved vector geometry model'] ?? 0
  )
  const maxResolvedGeometryP95 = Math.max(...resolvedGeometryP95Values)

  if (!SHOULD_ENFORCE_120FPS) {
    return
  }

  expect(
    maxResolvedGeometryP95,
    `vector point/control drag resolved geometry p95 should stay below ${VECTOR_POINT_DRAG_RESOLVED_GEOMETRY_P95_BUDGET_MS}ms`
  ).toBeLessThan(VECTOR_POINT_DRAG_RESOLVED_GEOMETRY_P95_BUDGET_MS)

  const maxVectorRenderPhaseP95 = Math.max(
    ...pointDragMetrics.map(
      (metric) => metric.phaseP95Ms['render-layer:strategy:vector'] ?? 0
    )
  )
  const maxRenderFlushPhaseP95 = Math.max(
    ...pointDragMetrics.map(
      (metric) => metric.phaseP95Ms['render:flush-frame'] ?? 0
    )
  )
  const maxRenderFlushAverageMs = Math.max(
    ...pointDragMetrics.map(
      (metric) => metric.phaseAverageMs['render:flush-frame'] ?? 0
    )
  )
  const worstVectorRenderMetric = pointDragMetrics.reduce(
    (worst, metric) =>
      (metric.phaseP95Ms['render-layer:strategy:vector'] ?? 0) >
      (worst.phaseP95Ms['render-layer:strategy:vector'] ?? 0)
        ? metric
        : worst,
    pointDragMetrics[0]
  )
  const worstRenderFlushMetric = pointDragMetrics.reduce(
    (worst, metric) =>
      (metric.phaseP95Ms['render:flush-frame'] ?? 0) >
      (worst.phaseP95Ms['render:flush-frame'] ?? 0)
        ? metric
        : worst,
    pointDragMetrics[0]
  )

  console.log(
    `STROKE_DRAG_E2E_BUDGET_SUMMARY ${JSON.stringify({
      frameBudgetMs: FRAME_BUDGET_120FPS_MS,
      maxResolvedGeometryP95,
      maxVectorRenderPhaseP95,
      maxRenderFlushPhaseP95,
      maxRenderFlushAverageMs,
      worstVectorRender: {
        label: worstVectorRenderMetric.label,
        phaseP95Ms: worstVectorRenderMetric.phaseP95Ms,
        phaseAverageMs: worstVectorRenderMetric.phaseAverageMs,
        counters: worstVectorRenderMetric.counters
      },
      worstRenderFlush: {
        label: worstRenderFlushMetric.label,
        phaseP95Ms: worstRenderFlushMetric.phaseP95Ms,
        phaseAverageMs: worstRenderFlushMetric.phaseAverageMs,
        counters: worstRenderFlushMetric.counters
      }
    })}`
  )

  expect(
    maxVectorRenderPhaseP95,
    'vector point/control drag product render phase p95 should stay within the 120fps frame budget'
  ).toBeLessThan(FRAME_BUDGET_120FPS_MS)
  expect(
    maxRenderFlushAverageMs,
    'vector point/control drag sustained render flush average should stay within the 120fps frame budget'
  ).toBeLessThan(FRAME_BUDGET_120FPS_MS)
}

const waitForPaintFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(performance.now()))
        })
      })
  )

const waitForNextPaintFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => resolve(performance.now()))
      })
  )

const collectAlignedPaintProfiles = async (
  page: Page,
  dragFrameId: string,
  browserStart: number,
  paintCount = 3
): Promise<FrameProfile[]> => {
  const profiles: FrameProfile[] = []
  let previousPaint = browserStart
  let previousFrameStart = browserStart
  for (let paintIndex = 0; paintIndex < paintCount; paintIndex += 1) {
    const browserPaint = await waitForNextPaintFrame(page)
    profiles.push(
      await collectPaintFrameProfiler(
        page,
        dragFrameId,
        paintIndex,
        previousFrameStart,
        browserPaint - previousPaint
      )
    )
    previousPaint = browserPaint
    previousFrameStart = browserPaint
  }
  await uninstallFrameProfiler(page)
  return profiles
}

const patchSelectedVectorToReportedClosedStar = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementApis = (window as any).__AsyraE2E__?.elementApis
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      'tp-56': {
        id: 'tp-56',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 246.91886685202462,
        y: 0
      },
      'tp-57': {
        id: 'tp-57',
        kind: 'anchor',
        anchorType: 'smooth',
        x: 75.04396933738008,
        y: 457.5261356375752
      },
      'tp-56:out': {
        id: 'tp-56:out',
        kind: 'control',
        controlForId: 'tp-56',
        controlRole: 'out',
        x: 195.9809570843745,
        y: 149.61104635348715
      },
      'tp-56:in': {
        id: 'tp-56:in',
        kind: 'control',
        controlForId: 'tp-56',
        controlRole: 'in',
        x: 226.91886685202462,
        y: -38
      },
      'tp-57:in': {
        id: 'tp-57:in',
        kind: 'control',
        controlForId: 'tp-57',
        controlRole: 'in',
        x: -46.963000165973426,
        y: 476.8923212730281
      },
      'tp-57:out': {
        id: 'tp-57:out',
        kind: 'control',
        controlForId: 'tp-57',
        controlRole: 'out',
        x: 227.55268121657173,
        y: 433.3184035932593
      },
      'tp-58': {
        id: 'tp-58',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 423.6353107755326,
        y: 198.5034027633924
      },
      'tp-59': {
        id: 'tp-59',
        kind: 'anchor',
        anchorType: 'sharp',
        x: 0,
        y: 91.98938176840147
      },
      'tp-60': {
        id: 'tp-60',
        kind: 'anchor',
        anchorType: 'smooth',
        x: 307.43819696281525,
        y: 428.4768571843963
      },
      'tp-59:out': {
        id: 'tp-59:out',
        kind: 'control',
        controlForId: 'tp-59',
        controlRole: 'out',
        x: 0,
        y: 91.98938176840147
      },
      'tp-60:in': {
        id: 'tp-60:in',
        kind: 'control',
        controlForId: 'tp-60',
        controlRole: 'in',
        x: 275.9681453052044,
        y: 498.6792801129134
      },
      'tp-60:out': {
        id: 'tp-60:out',
        kind: 'control',
        controlForId: 'tp-60',
        controlRole: 'out',
        x: 338.9082486204261,
        y: 358.2744342558792
      }
    }

    const nextSegments = {
      'seg-56-57': {
        id: 'seg-56-57',
        startId: 'tp-56',
        endId: 'tp-57',
        outControlId: 'tp-56:out',
        inControlId: 'tp-57:in'
      },
      'seg-57-58': {
        id: 'seg-57-58',
        startId: 'tp-57',
        endId: 'tp-58',
        outControlId: 'tp-57:out',
        inControlId: null
      },
      'seg-58-59': {
        id: 'seg-58-59',
        startId: 'tp-58',
        endId: 'tp-59',
        outControlId: null,
        inControlId: null
      },
      'seg-59-60': {
        id: 'seg-59-60',
        startId: 'tp-59',
        endId: 'tp-60',
        outControlId: 'tp-59:out',
        inControlId: 'tp-60:in'
      },
      'seg-60-56': {
        id: 'seg-60-56',
        startId: 'tp-60',
        endId: 'tp-56',
        outControlId: 'tp-60:out',
        inControlId: 'tp-56:in'
      }
    }

    const changeComputedData =
      elementApis?.changeComputedData ?? core?.changeComputedData
    changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
            segmentIds: [
              'seg-56-57',
              'seg-57-58',
              'seg-58-59',
              'seg-59-60',
              'seg-60-56'
            ],
            closed: true
          }
        },
        closed: true,
        width: 423.6353107755326,
        height: 457.5261356375752
      },
      { undoable: false }
    )
  })
  await page.waitForTimeout(180)
}

const configureStroke = async (page: Page, strokeCase: StrokeCase) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }
  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption(strokeCase.style)
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(strokeCase.position)
  await propertiesPanel.getByTestId('prop-stroke-join-0').selectOption('miter')
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(strokeCase.cap)
  await propertiesPanel
    .getByTestId('prop-stroke-width-0')
    .fill(String(STROKE_WIDTH))
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await propertiesPanel
    .getByTestId('prop-stroke-opacity-0')
    .fill(STROKE_OPACITY_PERCENT)
  await propertiesPanel.getByTestId('prop-stroke-opacity-0').press('Enter')

  if (strokeCase.style === 'dashed') {
    await fillStrokeDashGap(propertiesPanel, 0, '20, 20')
  }
  await page.evaluate(
    ({ fillColor, strokeColor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!selectedId) {
        throw new Error('No selected element available for stroke paint patch')
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const strokes = Array.isArray(computed.strokes)
        ? computed.strokes.map((stroke: Record<string, unknown>, index) =>
            index === 0
              ? {
                  ...stroke,
                  color: strokeColor,
                  colorFormat: 'hex',
                  defaultColorFormat: 'hex',
                  fill: null,
                  gradient: null,
                  opacity: 0.5,
                  visible: true
                }
              : stroke
          )
        : []
      const fills =
        Array.isArray(computed.fills) && computed.fills.length > 0
          ? computed.fills.map((fill: Record<string, unknown>, index) =>
              index === 0
                ? {
                    ...fill,
                    color: fillColor,
                    colorFormat: 'hex',
                    defaultColorFormat: 'hex',
                    gradient: null,
                    opacity: 1,
                    visible: true
                  }
                : fill
            )
          : [
              {
                id: 'stroke-drag-performance-fill',
                kind: 'solid',
                defaultColorFormat: 'hex',
                colorFormat: 'hex',
                color: fillColor,
                opacity: 1,
                visible: true,
                gradient: null
              }
            ]

      const changeComputedData =
        elementApis?.changeComputedData ?? core?.changeComputedData
      changeComputedData?.(
        [selectedId],
        {
          fills,
          strokes
        },
        { undoable: false }
      )
    },
    {
      fillColor: PERFORMANCE_FILL_COLOR,
      strokeColor: PERFORMANCE_STROKE_COLOR
    }
  )
  await page.waitForTimeout(180)
}

const enterPathEditing = async (page: Page) => {
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        return core?.getSystemProperty?.('pathEditingMode') ?? false
      })
    )
    .toBe(true)
}

const getPointClientPosition = async (
  page: Page,
  pointId: string
): Promise<ClientPoint> =>
  page.evaluate((targetPointId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
    const element = vectorId
      ? core?.deps?.sceneTree?.getElementById?.(vectorId)
      : undefined
    const computed = element?.getAllComputedData?.() ?? {}
    const point = computed.points?.[targetPointId]
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      throw new Error(`Missing point ${targetPointId}`)
    }

    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const offsetX = typeof computed.x === 'number' ? computed.x : 0
    const offsetY = typeof computed.y === 'number' ? computed.y : 0

    return {
      x: (offsetX + point.x) * zoom + viewport.x,
      y: (offsetY + point.y) * zoom + viewport.y
    }
  }, pointId)

const getDragStartPoint = async (
  page: Page,
  target: DragTarget
): Promise<ClientPoint> => {
  if (target === 'anchor') {
    return getPointClientPosition(page, 'tp-56')
  }
  if (target === 'in-control') {
    return getPointClientPosition(page, 'tp-60:out')
  }
  if (target === 'first-anchor-in-control') {
    return getPointClientPosition(page, 'tp-56:in')
  }
  return getPointClientPosition(page, 'tp-56:out')
}

const getDragPointId = (target: DragTarget) => {
  if (target === 'anchor') {
    return 'tp-56'
  }
  if (target === 'in-control') {
    return 'tp-60:out'
  }
  if (target === 'first-anchor-in-control') {
    return 'tp-56:in'
  }
  return 'tp-56:out'
}

const getExpectedDragSelection = (
  target: DragTarget
): { pointId: string; target: 'anchor' | 'inHandle' | 'outHandle' } => {
  if (target === 'anchor') {
    return { pointId: 'tp-56', target: 'anchor' }
  }
  if (target === 'in-control') {
    return { pointId: 'tp-60', target: 'outHandle' }
  }
  if (target === 'first-anchor-in-control') {
    return { pointId: 'tp-56', target: 'inHandle' }
  }
  return { pointId: 'tp-56', target: 'outHandle' }
}

const assertSelectedDragTarget = async (page: Page, target: DragTarget) => {
  const expected = getExpectedDragSelection(target)
  const selected = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return core?.getSystemProperty?.('selectedVectorPoint') ?? null
  })
  expect(
    selected?.pointId,
    `${target} should select expected vector point`
  ).toBe(expected.pointId)
  expect(
    selected?.target,
    `${target} should select expected vector target`
  ).toBe(expected.target)
}

const getDragDelta = (target: DragTarget): ClientPoint => {
  if (target === 'anchor') {
    return { x: 32, y: 18 }
  }
  if (target === 'in-control') {
    return { x: -28, y: 22 }
  }
  if (target === 'first-anchor-in-control') {
    return { x: -26, y: 20 }
  }
  return { x: 26, y: -24 }
}

const getDistance = (first: ClientPoint, second: ClientPoint) =>
  Math.hypot(first.x - second.x, first.y - second.y)

const buildRuleDrivenStrokeProbes = async (
  page: Page,
  strokeCase: StrokeCase,
  preferExportPackets = false
): Promise<RuleDrivenStrokeProbes> => {
  if (strokeCase.style !== 'dashed' || strokeCase.position !== 'inside') {
    return { body: [], gap: [], rejected: [] }
  }

  return page.evaluate(
    ({ strokeWidth, preferExportPackets }) => {
      interface Point {
        id: string
        kind: 'anchor' | 'control'
        x: number
        y: number
      }
      interface Segment {
        id: string
        startId: string
        endId: string
        outControlId?: string | null
        inControlId?: string | null
      }
      interface Network {
        pointIds: string[]
        segmentIds: string[]
        closed?: boolean
      }
      interface Sample {
        x: number
        y: number
        distance: number
      }
      interface ExportPacket {
        geometryId?: string
        polygons?: ClientPoint[][]
        intervalIds?: string[]
        debugMeta?: {
          geometryFamily?: string
          strokePosition?: string
          intervalId?: string
        }
      }

      const distance = (a: ClientPoint, b: ClientPoint) =>
        Math.hypot(a.x - b.x, a.y - b.y)
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t
      const cubic = (a: Point, b: Point, c: Point, d: Point, t: number) => {
        const mt = 1 - t
        const mt2 = mt * mt
        const t2 = t * t
        return {
          x:
            a.x * mt2 * mt +
            3 * b.x * mt2 * t +
            3 * c.x * mt * t2 +
            d.x * t2 * t,
          y:
            a.y * mt2 * mt +
            3 * b.y * mt2 * t +
            3 * c.y * mt * t2 +
            d.y * t2 * t
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const renderElement =
        core?.deps?.render?.getElementById?.(vectorId ?? selectedId) ?? null
      const exportPackets =
        (renderElement?.__asyraSolidCenterStrokeExportPackets ??
          []) as ExportPacket[]
      const pointInPolygon = (point: ClientPoint, polygon: ClientPoint[]) => {
        let inside = false
        for (
          let index = 0, previousIndex = polygon.length - 1;
          index < polygon.length;
          previousIndex = index, index += 1
        ) {
          const current = polygon[index]
          const previous = polygon[previousIndex]
          if (!current || !previous) {
            continue
          }
          const intersects =
            current.y > point.y !== previous.y > point.y &&
            point.x <
              ((previous.x - current.x) * (point.y - current.y)) /
                (previous.y - current.y || 1e-9) +
                current.x
          if (intersects) {
            inside = !inside
          }
        }
        return inside
      }
      const getPolygonBounds = (polygon: ClientPoint[]) =>
        polygon.reduce(
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
      const getPolygonCentroid = (polygon: ClientPoint[]) => {
        let signedArea = 0
        let centroidX = 0
        let centroidY = 0
        for (let index = 0; index < polygon.length; index += 1) {
          const current = polygon[index]
          const next = polygon[(index + 1) % polygon.length]
          if (!current || !next) {
            continue
          }
          const cross = current.x * next.y - next.x * current.y
          signedArea += cross
          centroidX += (current.x + next.x) * cross
          centroidY += (current.y + next.y) * cross
        }
        if (Math.abs(signedArea) < 1e-6) {
          const bounds = getPolygonBounds(polygon)
          return {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
          }
        }
        return {
          x: centroidX / (3 * signedArea),
          y: centroidY / (3 * signedArea)
        }
      }
      const getPolygonAbsArea = (polygon: ClientPoint[]) => {
        let signedArea = 0
        for (let index = 0; index < polygon.length; index += 1) {
          const current = polygon[index]
          const next = polygon[(index + 1) % polygon.length]
          if (!current || !next) {
            continue
          }
          signedArea += current.x * next.y - next.x * current.y
        }
        return Math.abs(signedArea / 2)
      }
      const findInteriorProbePoint = (polygon: ClientPoint[]) => {
        const bounds = getPolygonBounds(polygon)
        const centroid = getPolygonCentroid(polygon)
        const center = {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2
        }
        const candidates = [centroid, center]
        for (let yStep = 1; yStep < 8; yStep += 1) {
          for (let xStep = 1; xStep < 8; xStep += 1) {
            candidates.push({
              x: bounds.minX + ((bounds.maxX - bounds.minX) * xStep) / 8,
              y: bounds.minY + ((bounds.maxY - bounds.minY) * yStep) / 8
            })
          }
        }
        return candidates.find((point) => pointInPolygon(point, polygon))
      }
      const projectedBodyProbes = (preferExportPackets ? exportPackets : [])
        .filter(
          (packet) =>
            (packet.debugMeta === undefined ||
              (packet.debugMeta.geometryFamily === 'constrained-dashed' &&
                packet.debugMeta.strokePosition === 'inside')) &&
            (packet.polygons?.length ?? 0) > 0
        )
        .flatMap((packet, packetIndex) =>
          (packet.polygons ?? [])
            .map((polygon, polygonIndex) => ({
              polygon,
              packet,
              packetIndex,
              polygonIndex
            }))
            .filter(({ polygon }) => polygon.length >= 3)
        )
        .map((entry) => ({
          ...entry,
          area: getPolygonAbsArea(entry.polygon)
        }))
        .sort((left, right) => right.area - left.area)
        .map(({ polygon, packet, packetIndex, polygonIndex }) => {
          const point = findInteriorProbePoint(polygon)
          if (!point) {
            return null
          }
          return {
            label:
              packet.intervalIds?.[0] ??
              packet.debugMeta?.intervalId ??
              packet.geometryId ??
              `packet-${packetIndex}:polygon-${polygonIndex}`,
            point,
            radius: 5
          }
        })
        .filter((probe): probe is LocalProbePoint => probe !== null)
        .slice(0, 4)

      if (projectedBodyProbes.length > 0) {
        return { body: projectedBodyProbes, gap: [], rejected: [] }
      }

      const element = vectorId
        ? core?.deps?.sceneTree?.getElementById?.(vectorId)
        : undefined
      const computed = element?.getAllComputedData?.() ?? {}
      const network = Object.values(computed.networks ?? {})[0] as
        | Network
        | undefined
      const points = computed.points ?? {}
      const segments = computed.segments ?? {}

      if (!network) {
        return { body: [], gap: [], rejected: [] }
      }

      const samples: Sample[] = []
      const boundaryDistances: number[] = []
      const pushSample = (point: ClientPoint) => {
        const previous = samples[samples.length - 1]
        const nextDistance = previous
          ? previous.distance + distance(previous, point)
          : 0
        if (!previous || distance(previous, point) > 0.01) {
          samples.push({ ...point, distance: nextDistance })
        }
      }

      for (const segmentId of network.segmentIds) {
        const segment = segments[segmentId] as Segment | undefined
        if (!segment) {
          continue
        }
        const start = points[segment.startId] as Point | undefined
        const end = points[segment.endId] as Point | undefined
        if (!start || !end) {
          continue
        }
        const out = segment.outControlId
          ? (points[segment.outControlId] as Point | undefined)
          : undefined
        const input = segment.inControlId
          ? (points[segment.inControlId] as Point | undefined)
          : undefined
        const steps = out && input ? 14 : 1
        for (let step = 0; step <= steps; step += 1) {
          const t = step / steps
          pushSample(
            out && input
              ? cubic(start, out, input, end, t)
              : {
                  x: lerp(start.x, end.x, t),
                  y: lerp(start.y, end.y, t)
                }
          )
        }
        boundaryDistances.push(samples[samples.length - 1]?.distance ?? 0)
      }

      const totalLength = samples[samples.length - 1]?.distance ?? 0
      if (samples.length < 2 || totalLength <= 0) {
        return { body: [], gap: [], rejected: [] }
      }

      const isInsideEvenOdd = (point: ClientPoint) => {
        let inside = false
        for (let index = 0; index < samples.length - 1; index += 1) {
          const start = samples[index]
          const end = samples[index + 1]
          const crosses =
            start.y > point.y !== end.y > point.y &&
            point.x <
              ((end.x - start.x) * (point.y - start.y)) /
                (end.y - start.y || 1e-9) +
                start.x
          if (crosses) {
            inside = !inside
          }
        }
        return inside
      }

      const sampleAtDistance = (rawDistance: number) => {
        const target = ((rawDistance % totalLength) + totalLength) % totalLength
        let sampleIndex = 1
        while (
          sampleIndex < samples.length &&
          samples[sampleIndex].distance < target
        ) {
          sampleIndex += 1
        }
        const next = samples[Math.min(sampleIndex, samples.length - 1)]
        const previous = samples[Math.max(0, sampleIndex - 1)]
        const span = Math.max(0.0001, next.distance - previous.distance)
        const t = Math.min(1, Math.max(0, (target - previous.distance) / span))
        const point = {
          x: lerp(previous.x, next.x, t),
          y: lerp(previous.y, next.y, t)
        }
        const tangent = {
          x: next.x - previous.x,
          y: next.y - previous.y
        }
        const tangentLength = Math.max(0.0001, Math.hypot(tangent.x, tangent.y))
        return {
          point,
          normal: {
            x: -tangent.y / tangentLength,
            y: tangent.x / tangentLength
          }
        }
      }

      const body: LocalProbePoint[] = []
      const gap: LocalProbePoint[] = []
      const rejected: LocalProbePoint[] = []
      const visibleLength = 20
      const gapLength = 20
      const period = visibleLength + gapLength
      const selectedOffset = strokeWidth * 0.42
      const rejectedOffset = strokeWidth * 0.9
      const isVisible = (distanceValue: number) =>
        ((distanceValue % period) + period) % period < visibleLength
      const makePoint = (
        distanceValue: number,
        offset: number,
        side: 1 | -1
      ) => {
        const { point, normal } = sampleAtDistance(distanceValue)
        return {
          x: point.x + normal.x * side * offset,
          y: point.y + normal.y * side * offset
        }
      }
      const makeLegalProbePoint = (distanceValue: number, offset: number) =>
        ([1, -1] as const)
          .map((side) => makePoint(distanceValue, offset, side))
          .find((point) => isInsideEvenOdd(point))
      const makeRejectedProbePoint = (distanceValue: number, offset: number) =>
        ([1, -1] as const)
          .map((side) => makePoint(distanceValue, offset, side))
          .find((point) => !isInsideEvenOdd(point))
      const hasNearbyUnrelatedSource = (
        distanceValue: number,
        point: ClientPoint
      ) =>
        samples.some((sample) => {
          const distanceDelta = Math.abs(sample.distance - distanceValue)
          const loopDistanceDelta = Math.min(
            distanceDelta,
            totalLength - distanceDelta
          )
          return (
            loopDistanceDelta > period &&
            distance(point, sample) < strokeWidth * 3
          )
        })
      const addBodyProbe = (label: string, distanceValue: number) => {
        if (!isVisible(distanceValue) || body.length >= 10) {
          return
        }
        const bodyPoint = makeLegalProbePoint(distanceValue, selectedOffset)
        const rejectedPoint = makeRejectedProbePoint(
          distanceValue,
          rejectedOffset
        )
        if (!bodyPoint) {
          return
        }
        body.push({
          label,
          point: bodyPoint,
          radius: 5
        })
        if (
          rejectedPoint &&
          !hasNearbyUnrelatedSource(distanceValue, rejectedPoint)
        ) {
          rejected.push({
            label: `${label}:rejected`,
            point: rejectedPoint,
            radius: 4
          })
        }
      }
      for (
        let intervalStart = 0;
        intervalStart < totalLength && body.length < 7;
        intervalStart += period
      ) {
        addBodyProbe(
          `interval-${body.length}`,
          intervalStart + visibleLength / 2
        )
      }
      addBodyProbe('seam-first-dash', visibleLength / 2)
      addBodyProbe('seam-final-dash', totalLength - visibleLength / 2)

      for (const [index, boundaryDistance] of boundaryDistances.entries()) {
        if (body.length >= 10) {
          break
        }
        addBodyProbe(`source-boundary-${index}:before`, boundaryDistance - 4)
        addBodyProbe(`source-boundary-${index}:after`, boundaryDistance + 4)
      }

      return { body, gap, rejected }
    },
    { strokeWidth: STROKE_WIDTH, preferExportPackets }
  )
}

const assertRuleDrivenStrokeProbes = async (
  page: Page,
  label: string,
  strokeCase: StrokeCase
) => {
  const isDuringDragProbe = label.includes(':during-drag')
  const probes = await buildRuleDrivenStrokeProbes(
    page,
    strokeCase,
    !isDuringDragProbe
  )
  if (probes.body.length === 0) {
    return
  }
  const raster = await captureSelectedElementRaster(page, 72)
  const [bodyCoverages, gapCoverages, rejectedCoverages] = await Promise.all([
    Promise.all(
      probes.body.map((probe) => getLocalStrokeCoverage(page, raster, probe))
    ),
    Promise.all(
      probes.gap.map((probe) => getLocalStrokeCoverage(page, raster, probe))
    ),
    Promise.all(
      probes.rejected.map((probe) =>
        getLocalStrokeCoverage(page, raster, probe)
      )
    )
  ])

  const minBodyCoverage = 0.015
  const maxRejectedCoverage = 0.75
  if (isDuringDragProbe) {
    expect(
      Math.max(...bodyCoverages),
      `${label} should keep at least one rule-driven body probe visible while the source curve is moving`
    ).toBeGreaterThan(minBodyCoverage)
    return
  }

  const visibleBodyProbeCount = bodyCoverages.filter(
    (coverage) => coverage > minBodyCoverage
  ).length
  expect(
    visibleBodyProbeCount,
    `${label} should keep most rule-driven body probes visible`
  ).toBeGreaterThanOrEqual(Math.max(1, Math.ceil(bodyCoverages.length * 0.5)))
  for (const [index, coverage] of rejectedCoverages.entries()) {
    expect(
      coverage,
      `${label} rejected-side probe ${
        probes.rejected[index]?.label ?? index
      } should stay clipped`
    ).toBeLessThanOrEqual(maxRejectedCoverage)
  }
  for (const [index, coverage] of gapCoverages.entries()) {
    expect(
      coverage,
      `${label} gap probe ${probes.gap[index]?.label ?? index} should stay empty`
    ).toBeLessThan(0.22)
  }
}

const analyzeGreenRaster = async (
  page: Page,
  screenshotBase64: string
): Promise<{
  strokeCoverage: number
  doubleAlphaCoverage: number
  visualSignal: number
}> =>
  page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D context unavailable')
    }
    context.drawImage(bitmap, 0, 0)
    const image = context.getImageData(0, 0, canvas.width, canvas.height).data
    let strokePixels = 0
    let doubleAlphaPixels = 0
    let visualSignal = 0
    const totalPixels = canvas.width * canvas.height
    for (let index = 0; index < image.length; index += 4) {
      const red = image[index]
      const green = image[index + 1]
      const blue = image[index + 2]
      const isPerformanceStrokePixel =
        green > 80 && green > red + 35 && green > blue + 25
      if (isPerformanceStrokePixel) {
        strokePixels += 1
        visualSignal += green
      }
      if (isPerformanceStrokePixel && green > 200 && red < 80 && blue < 110) {
        doubleAlphaPixels += 1
      }
    }

    return {
      strokeCoverage: strokePixels / totalPixels,
      doubleAlphaCoverage: doubleAlphaPixels / totalPixels,
      visualSignal: visualSignal / totalPixels
    }
  }, screenshotBase64)

const captureSelectedElementRaster = async (
  page: Page,
  padding = 64
): Promise<StrokeRasterCapture> => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element rect available')
  }
  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const clipX = Math.max(
    0,
    Math.floor(rect.x * viewportState.zoom + viewportState.viewport.x - padding)
  )
  const clipY = Math.max(
    0,
    Math.floor(rect.y * viewportState.zoom + viewportState.viewport.y - padding)
  )
  const width = Math.max(
    1,
    Math.min(
      viewportSize.width - clipX,
      Math.ceil(rect.width * viewportState.zoom + padding * 2)
    )
  )
  const height = Math.max(
    1,
    Math.min(
      viewportSize.height - clipY,
      Math.ceil(rect.height * viewportState.zoom + padding * 2)
    )
  )
  const screenshot = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width,
      height
    }
  })

  return {
    base64: screenshot.toString('base64'),
    clipX,
    clipY,
    width,
    height,
    zoom: viewportState.zoom,
    viewport: viewportState.viewport,
    rect
  }
}

const captureSelectedElementStrokeStats = async (page: Page) => {
  const raster = await captureSelectedElementRaster(page, 48)
  return analyzeGreenRaster(page, raster.base64)
}

const captureSelectedElementStrokeDiagnostics = async (page: Page) => {
  const rect = await getSelectedElementRect(page)
  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : undefined
    const computed = element?.getAllComputedData?.() ?? {}
    const renderLayer =
      core?.deps?.render?.viewport?.renderLayer ??
      core?.deps?.render?.viewportLayer?.renderLayer
    const graphic = selectedId
      ? renderLayer?.getAllElements?.()?.get?.(selectedId)
      : undefined
    const cacheEntries = Array.from(
      graphic?.__asyraStrokeMeshCache?.entries?.() ?? []
    ).map(([key, entry]: [string, Record<string, any>]) => ({
      key,
      kind: entry?.kind,
      visible:
        entry?.container?.visible ??
        entry?.graphics?.visible ??
        entry?.projection?.mesh?.visible ??
        null,
      childCount: entry?.container?.children?.length ?? null
    }))
    return {
      selectedId,
      pathEditingVectorId: core?.getSystemProperty?.('pathEditingVectorId'),
      pathEditingMode: core?.getSystemProperty?.('pathEditingMode'),
      mouseDragging: core?.getSystemProperty?.('mouseDragging'),
      mouseDown: core?.getSystemProperty?.('mouseDown'),
      selectedVectorPoint: core?.getSystemProperty?.('selectedVectorPoint'),
      vectorPointSelection: Array.from(
        core?.getUIProperty?.('vectorPointSelection') ?? []
      ),
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      },
      computed: {
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height,
        closed: computed.closed,
        visible: computed.visible,
        strokes: computed.strokes,
        fills: computed.fills,
        pointCount: Object.keys(computed.points ?? {}).length,
        segmentCount: Object.keys(computed.segments ?? {}).length,
        networkCount: Object.keys(computed.networks ?? {}).length,
        points: computed.points,
        segments: computed.segments,
        networks: computed.networks,
        point: computed.points?.['tp-56']
      },
      graphic: graphic
        ? {
            visible: graphic.visible,
            childCount: graphic.children?.length ?? null,
            exportPacketCount:
              graphic.__asyraSolidCenterStrokeExportPackets?.length ?? null,
            nativeCenterSolidStrokeRenderCount:
              graphic.__asyraNativeCenterSolidStrokeRenderCount ?? null,
            cacheEntries
          }
        : null,
      renderKeys: Object.keys(core?.deps?.render ?? {}),
      renderLayerKeys: Object.keys(renderLayer ?? {})
    }
  })
  return { rect, viewportState }
}

const startRenderPipelineDiagnostics = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = window as any
    target.__asyraE2EStrokePipelineDiagnostics = {
      phases: {},
      counters: {}
    }
    target.__asyraVectorRenderPhaseSink = (
      phaseName: string,
      durationMs: number
    ) => {
      const diagnostics = target.__asyraE2EStrokePipelineDiagnostics
      diagnostics.phases[phaseName] =
        (diagnostics.phases[phaseName] ?? 0) + durationMs
    }
    target.__asyraStrokePipelineCounterSink = (
      counterName: string,
      value: number
    ) => {
      const diagnostics = target.__asyraE2EStrokePipelineDiagnostics
      diagnostics.counters[counterName] =
        (diagnostics.counters[counterName] ?? 0) + value
    }
  })
}

const readRenderPipelineDiagnostics = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = window as any
    const diagnostics = target.__asyraE2EStrokePipelineDiagnostics ?? null
    target.__asyraVectorRenderPhaseSink = undefined
    target.__asyraStrokePipelineCounterSink = undefined
    return diagnostics
  })

const getLocalProbeRegion = (
  raster: StrokeRasterCapture,
  point: ClientPoint,
  radius: number
) => {
  const centerX =
    (raster.rect.x + point.x) * raster.zoom + raster.viewport.x - raster.clipX
  const centerY =
    (raster.rect.y + point.y) * raster.zoom + raster.viewport.y - raster.clipY
  return {
    x: Math.max(0, Math.floor(centerX - radius)),
    y: Math.max(0, Math.floor(centerY - radius)),
    width: Math.max(
      1,
      Math.min(
        raster.width - Math.max(0, Math.floor(centerX - radius)),
        radius * 2
      )
    ),
    height: Math.max(
      1,
      Math.min(
        raster.height - Math.max(0, Math.floor(centerY - radius)),
        radius * 2
      )
    )
  }
}

const getLocalStrokeCoverage = async (
  page: Page,
  raster: StrokeRasterCapture,
  probe: LocalProbePoint
) =>
  page.evaluate(
    async ({ base64, region }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }
      context.drawImage(bitmap, 0, 0)
      const left = Math.max(0, Math.floor(region.x))
      const top = Math.max(0, Math.floor(region.y))
      const width = Math.max(
        1,
        Math.min(canvas.width - left, Math.floor(region.width))
      )
      const height = Math.max(
        1,
        Math.min(canvas.height - top, Math.floor(region.height))
      )
      const image = context.getImageData(left, top, width, height).data
      let strokePixels = 0
      for (let index = 0; index < image.length; index += 4) {
        const red = image[index]
        const green = image[index + 1]
        const blue = image[index + 2]
        if (green > 80 && green > red + 35 && green > blue + 25) {
          strokePixels += 1
        }
      }
      return strokePixels / Math.max(1, width * height)
    },
    {
      base64: raster.base64,
      region: getLocalProbeRegion(raster, probe.point, probe.radius)
    }
  )

const buildFreshnessProbe = (
  initialPoint: ClientPoint,
  currentPoint: ClientPoint,
  initialVisualSignal: number,
  currentVisualSignal: number
): FreshnessProbe => {
  const sourceDeltaPx = getDistance(initialPoint, currentPoint)
  const visualSignalDelta = Math.abs(currentVisualSignal - initialVisualSignal)
  return {
    sourceDeltaPx,
    visualSignalDelta,
    sourceMoved: sourceDeltaPx > 0.5,
    visualChanged: visualSignalDelta > 0.0001
  }
}

const centerSelectedVectorInViewport = async (page: Page) => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected vector rect available')
  }
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const zoom = 1.15
  await page.evaluate(
    ({ rect, zoom, viewportSize }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core?.setSystemProperty?.('zoom', zoom)
      core?.setSystemProperty?.('viewportPosition', {
        x: viewportSize.width / 2 - (rect.x + rect.width / 2) * zoom,
        y: viewportSize.height / 2 - (rect.y + rect.height / 2) * zoom
      })
    },
    { rect, zoom, viewportSize }
  )
  await page.waitForTimeout(120)
}

const clearVectorEditingState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
    core?.setSystemProperty?.('mouseDragging', false)
    core?.setSystemProperty?.('mouseDown', false)
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setUIProperty?.('vectorPointSelection', new Set())
    core?.setUIProperty?.('vectorSegmentSelection', new Set())
  })
  await page.waitForTimeout(80)
}

const ensureVectorElementSelected = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (selectedId) {
      return
    }

    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) {
      return
    }

    const vectorId = Array.from(elements.keys()).find(
      (id) => id !== 'workspace'
    )
    if (vectorId) {
      core?.deps?.selection?.selectElements?.([vectorId], { undoable: false })
    }
  })
}

const setupReportedStar = async (page: Page, strokeCase: StrokeCase) => {
  await resetCanvas(page)
  await createVectorPath(page, 0.32, 0.28, 0.16, 0.12)
  await clearVectorEditingState(page)
  await ensureVectorElementSelected(page)
  await patchSelectedVectorToReportedClosedStar(page)
  await centerSelectedVectorInViewport(page)
  await configureStroke(page, strokeCase)
  await enterPathEditing(page)
}

const setupReportedStarForMove = async (page: Page) => {
  await resetCanvas(page)
  await createVectorPath(page, 0.32, 0.28, 0.16, 0.12)
  await clearVectorEditingState(page)
  await ensureVectorElementSelected(page)
  await patchSelectedVectorToReportedClosedStar(page)
  await centerSelectedVectorInViewport(page)
  await configureStroke(page, {
    label: 'center-solid-round',
    style: 'solid',
    position: 'center',
    cap: 'round'
  })
  await clearVectorEditingState(page)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('primaryTool', 'select')
  })
  await page.waitForTimeout(120)
}

const measureSchedulingBaseline = async (
  page: Page
): Promise<SchedulingBaselineMetrics> => {
  const frameTimes: number[] = []
  const frameCount = Math.min(8, Math.max(3, Math.floor(DRAG_STEP_COUNT / 3)))

  for (let step = 0; step < frameCount; step += 1) {
    const dragFrameId = `baseline:${step}`
    await installFrameProfiler(page, dragFrameId)
    const browserStart = await page.evaluate(() => performance.now())
    await page.mouse.move(10 + step, 10 + step)
    const profiles = await collectAlignedPaintProfiles(
      page,
      dragFrameId,
      browserStart,
      1
    )
    frameTimes.push(profiles[0]?.elapsedMs ?? 0)
  }

  return {
    frameCount,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes)
  }
}

const measureMoveVectorElement = async (
  page: Page,
  schedulingBaseline: SchedulingBaselineMetrics
): Promise<DragMetrics> => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected vector rect available for move baseline')
  }
  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const startPoint = {
    x:
      (rect.x + rect.width / 2) * viewportState.zoom + viewportState.viewport.x,
    y:
      (rect.y + rect.height / 2) * viewportState.zoom + viewportState.viewport.y
  }
  const delta = { x: 36, y: 28 }
  const frameTimes: number[] = []
  const frameProfiles: FrameProfile[] = []
  let droppedFrameCount = 0

  await page.mouse.move(startPoint.x, startPoint.y)
  await page.mouse.down()
  for (let step = 1; step <= DRAG_STEP_COUNT; step += 1) {
    const progress = step / DRAG_STEP_COUNT
    const nextPoint = {
      x: startPoint.x + delta.x * progress,
      y: startPoint.y + delta.y * progress
    }
    const dragFrameId = `move-vector:center-solid-round:${step}`
    await installFrameProfiler(page, dragFrameId)
    const browserStart = await page.evaluate(() => performance.now())
    await page.mouse.move(nextPoint.x, nextPoint.y)
    const profiles = await collectAlignedPaintProfiles(
      page,
      dragFrameId,
      browserStart
    )
    const frameMs = profiles[0]?.elapsedMs ?? 0
    frameProfiles.push(...profiles)
    frameTimes.push(frameMs)
    if (frameMs > FRAME_BUDGET_120FPS_MS) {
      droppedFrameCount += 1
    }

    if (step === Math.ceil(DRAG_STEP_COUNT / 2)) {
      const stats = await captureSelectedElementStrokeStats(page)
      expect(stats.strokeCoverage).toBeGreaterThan(0.0005)
      expect(stats.doubleAlphaCoverage).toBeLessThan(0.08)
    }
  }
  await page.mouse.up()
  await waitForPaintFrame(page)
  const finalStats = await captureSelectedElementStrokeStats(page)
  expect(
    finalStats.strokeCoverage,
    'move-vector should keep stroke coverage after mouseup'
  ).toBeGreaterThan(0.0005)
  expect(
    finalStats.doubleAlphaCoverage,
    'move-vector should not show product double-alpha overlap after mouseup'
  ).toBeLessThan(0.08)
  const phaseSummary = summarizeFrameProfiles(
    frameProfiles,
    frameTimes.length,
    schedulingBaseline
  )

  return {
    label: 'move-vector:center-solid-round',
    frameCount: frameTimes.length,
    paintFrameCount: frameProfiles.length,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    droppedFrameCount,
    freshnessProbe: null,
    ...phaseSummary
  }
}

const measureDrag = async (
  page: Page,
  strokeCase: StrokeCase,
  target: DragTarget,
  schedulingBaseline: SchedulingBaselineMetrics,
  validateRuleDrivenProbes: boolean
): Promise<DragMetrics> => {
  const label = strokeCase.label
  const startPoint = await getDragStartPoint(page, target)
  const dragPointId = getDragPointId(target)
  const initialPoint = await getPointClientPosition(page, dragPointId)
  const initialStats = await captureSelectedElementStrokeStats(page)
  const delta = getDragDelta(target)
  const frameTimes: number[] = []
  const frameProfiles: FrameProfile[] = []
  let freshnessProbe: FreshnessProbe | null = null
  let droppedFrameCount = 0

  await page.mouse.move(startPoint.x, startPoint.y)
  await page.mouse.down()
  await assertSelectedDragTarget(page, target)
  for (let step = 1; step <= DRAG_STEP_COUNT; step += 1) {
    const progress = step / DRAG_STEP_COUNT
    const nextPoint = {
      x: startPoint.x + delta.x * progress,
      y: startPoint.y + delta.y * progress
    }
    const dragFrameId = `${label}:${target}:${step}`
    await installFrameProfiler(page, dragFrameId)
    const browserStart = await page.evaluate(() => performance.now())
    await page.mouse.move(nextPoint.x, nextPoint.y)
    const profiles = await collectAlignedPaintProfiles(
      page,
      dragFrameId,
      browserStart
    )
    const frameMs = profiles[0]?.elapsedMs ?? 0
    frameProfiles.push(...profiles)
    frameTimes.push(frameMs)
    if (frameMs > FRAME_BUDGET_120FPS_MS) {
      droppedFrameCount += 1
    }

    if (step === Math.ceil(DRAG_STEP_COUNT / 2)) {
      const stats = await captureSelectedElementStrokeStats(page)
      const currentPoint = await getPointClientPosition(page, dragPointId)
      freshnessProbe = buildFreshnessProbe(
        initialPoint,
        currentPoint,
        initialStats.visualSignal,
        stats.visualSignal
      )
      expect(
        stats.strokeCoverage,
        `${label}:${target} should keep stroke coverage during drag`
      ).toBeGreaterThan(0.0005)
      expect(
        stats.doubleAlphaCoverage,
        `${label}:${target} should not show product double-alpha overlap during drag`
      ).toBeLessThan(0.08)
      if (validateRuleDrivenProbes) {
        await assertRuleDrivenStrokeProbes(
          page,
          `${label}:${target}:during-drag`,
          strokeCase
        )
      }
    }
  }
  await startRenderPipelineDiagnostics(page)
  await page.mouse.up()
  await waitForPaintFrame(page)
  const finalPipelineDiagnostics = await readRenderPipelineDiagnostics(page)
  const finalStats = await captureSelectedElementStrokeStats(page)
  const finalDiagnostics =
    finalStats.strokeCoverage <= 0.0005
      ? await captureSelectedElementStrokeDiagnostics(page)
      : null
  expect(
    finalStats.strokeCoverage,
    `${label}:${target} should keep stroke coverage after mouseup ${JSON.stringify(
      { finalStats, finalPipelineDiagnostics, finalDiagnostics },
      null,
      2
    )}`
  ).toBeGreaterThan(0.0005)
  expect(
    finalStats.doubleAlphaCoverage,
    `${label}:${target} should not show product double-alpha overlap after mouseup`
  ).toBeLessThan(0.08)
  if (validateRuleDrivenProbes) {
    await assertRuleDrivenStrokeProbes(
      page,
      `${label}:${target}:after-mouseup`,
      strokeCase
    )
  }
  const phaseSummary = summarizeFrameProfiles(
    frameProfiles,
    frameTimes.length,
    schedulingBaseline
  )

  return {
    label: `${label}:${target}`,
    frameCount: frameTimes.length,
    paintFrameCount: frameProfiles.length,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    droppedFrameCount,
    freshnessProbe,
    ...phaseSummary
  }
}

const measureBurstDrag = async (
  page: Page,
  label: string,
  target: DragTarget
): Promise<BurstDragMetrics> => {
  const startPoint = await getDragStartPoint(page, target)
  const dragPointId = getDragPointId(target)
  const initialPoint = await getPointClientPosition(page, dragPointId)
  const initialStats = await captureSelectedElementStrokeStats(page)
  const delta = getDragDelta(target)
  const endPoint = {
    x: startPoint.x + delta.x,
    y: startPoint.y + delta.y
  }
  const dragFrameId = `burst:${label}:${target}`

  await page.mouse.move(startPoint.x, startPoint.y)
  await page.mouse.down()
  await installFrameProfiler(page, dragFrameId)
  const browserStart = await page.evaluate(() => performance.now())
  await page.mouse.move(endPoint.x, endPoint.y, { steps: DRAG_STEP_COUNT })
  const frameProfiles = await collectAlignedPaintProfiles(
    page,
    dragFrameId,
    browserStart
  )
  await page.mouse.up()
  await waitForPaintFrame(page)

  const currentStats = await captureSelectedElementStrokeStats(page)
  expect(
    currentStats.strokeCoverage,
    `burst:${label}:${target} should keep stroke coverage after burst drag`
  ).toBeGreaterThan(0.0005)
  expect(
    currentStats.doubleAlphaCoverage,
    `burst:${label}:${target} should not show product double-alpha overlap after burst drag`
  ).toBeLessThan(0.08)
  await assertRuleDrivenStrokeProbes(
    page,
    `burst:${label}:${target}:after-burst`,
    {
      label,
      style: 'dashed',
      position: 'inside',
      cap: 'round'
    }
  )
  const currentPoint = await getPointClientPosition(page, dragPointId)
  const freshnessProbe = buildFreshnessProbe(
    initialPoint,
    currentPoint,
    initialStats.visualSignal,
    currentStats.visualSignal
  )
  const aggregate = aggregateProfiles(frameProfiles)
  const elapsedToFirstPaintMs = frameProfiles[0]?.elapsedMs ?? 0
  const elapsedToLastObservedPaintMs =
    frameProfiles.reduce((total, profile) => total + profile.elapsedMs, 0) ?? 0

  return {
    label: `burst:${label}:${target}`,
    moveEventCount: DRAG_STEP_COUNT,
    paintFrameCount: frameProfiles.length,
    elapsedToFirstPaintMs,
    elapsedToLastObservedPaintMs,
    productRenderPhaseCount: aggregate.productRenderPhaseCount,
    pixiRenderPhaseCount: aggregate.pixiRenderPhaseCount,
    renderFlushPhaseCount: aggregate.renderFlushPhaseCount,
    vectorCommitCount: aggregate.counters['vector-api-commit-enter-count'] ?? 0,
    computedPatchCount:
      aggregate.counters['vector-api-commit-patch-key-count-observed'] ?? 0,
    computedMirrorCommitCount:
      aggregate.counters['computed-mirror-commit-count'] ?? 0,
    productRenderPerObservedPaint:
      aggregate.productRenderPhaseCount / Math.max(1, frameProfiles.length),
    pixiRenderPerObservedPaint:
      aggregate.pixiRenderPhaseCount / Math.max(1, frameProfiles.length),
    freshnessProbe,
    phaseTotalMs: aggregate.phaseTotalMs,
    counters: aggregate.counters
  }
}

test.describe('stroke drag render performance UX gate', () => {
  test.setTimeout(300000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('measures real browser point and handle drag rendering with complete stroke render probes', async ({
    page
  }, testInfo) => {
    const metrics: DragMetrics[] = []
    const schedulingBaseline = await measureSchedulingBaseline(page)

    for (const strokeCase of STROKE_CASES) {
      for (const target of DRAG_TARGETS) {
        const scenarioLabel = `${strokeCase.label}:${target}`
        if (
          DEBUG_SCENARIO_FILTER &&
          !scenarioLabel.includes(DEBUG_SCENARIO_FILTER)
        ) {
          continue
        }
        await setupReportedStar(page, strokeCase)
        metrics.push(
          await measureDrag(
            page,
            strokeCase,
            target,
            schedulingBaseline,
            target === 'in-control'
          )
        )
      }
    }
    if (!DEBUG_SCENARIO_FILTER) {
      await setupReportedStarForMove(page)
      metrics.push(await measureMoveVectorElement(page, schedulingBaseline))
    }
    const burstMetrics = !DEBUG_SCENARIO_FILTER
      ? await (async () => {
          await setupReportedStar(page, {
            label: 'inside-dashed-round',
            style: 'dashed',
            position: 'inside',
            cap: 'round'
          })
          return measureBurstDrag(page, 'inside-dashed-round', 'out-control')
        })()
      : null
    metrics.forEach(assertRequiredPhaseCoverage)
    assertVectorPointDragPerformanceBudget(metrics)
    if (burstMetrics) {
      expect(
        burstMetrics.productRenderPhaseCount,
        'burst drag should observe vector renders'
      ).toBeGreaterThan(0)
      expect(
        (burstMetrics.counters['product-render-per-render-frame'] ?? 0) /
          Math.max(1, burstMetrics.counters['render-frame-count'] ?? 0),
        'burst drag should not perform more than one complete product render per render frame for the selected vector'
      ).toBeLessThanOrEqual(1)
      expect(
        burstMetrics.freshnessProbe.sourceMoved,
        'burst drag should move the edited source point'
      ).toBe(true)
      expect(
        burstMetrics.freshnessProbe.visualChanged,
        'burst drag should visibly update the product stroke'
      ).toBe(true)
    }
    const visualReviewRaster = await captureSelectedElementRaster(page, 72)
    const visualReviewRasterBuffer = Buffer.from(
      visualReviewRaster.base64,
      'base64'
    )
    const visualReviewPath = testInfo.outputPath(
      'stroke-drag-visual-review.png'
    )
    await writeFile(visualReviewPath, visualReviewRasterBuffer)
    await testInfo.attach('stroke-drag-visual-review.png', {
      path: visualReviewPath,
      contentType: 'image/png'
    })

    const maxP95Ms = Math.max(...metrics.map((metric) => metric.p95Ms))
    const pointDragMetrics = metrics.filter(
      (metric) => !metric.label.startsWith('move-vector:')
    )
    const maxVectorRenderPhaseP95 = Math.max(
      ...pointDragMetrics.map(
        (metric) => metric.phaseP95Ms['render-layer:strategy:vector'] ?? 0
      )
    )
    const maxRenderFlushPhaseP95 = Math.max(
      ...pointDragMetrics.map(
        (metric) => metric.phaseP95Ms['render:flush-frame'] ?? 0
      )
    )
    const totalDroppedFrameCount = metrics.reduce(
      (total, metric) => total + metric.droppedFrameCount,
      0
    )
    if (burstMetrics) {
      console.log(
        `STROKE_DRAG_E2E_BURST_METRICS ${JSON.stringify({
          measurementScope: 'browser-ux',
          rendererCoverage: 'real',
          paintObservationWindow: 3,
          burstMetrics: {
            label: burstMetrics.label,
            moveEventCount: burstMetrics.moveEventCount,
            paintFrameCount: burstMetrics.paintFrameCount,
            elapsedToFirstPaintMs: burstMetrics.elapsedToFirstPaintMs,
            elapsedToLastObservedPaintMs:
              burstMetrics.elapsedToLastObservedPaintMs,
            productRenderPhaseCount: burstMetrics.productRenderPhaseCount,
            pixiRenderPhaseCount: burstMetrics.pixiRenderPhaseCount,
            renderFlushPhaseCount: burstMetrics.renderFlushPhaseCount,
            vectorCommitCount: burstMetrics.vectorCommitCount,
            computedPatchCount: burstMetrics.computedPatchCount,
            computedMirrorCommitCount: burstMetrics.computedMirrorCommitCount,
            productRenderPerObservedPaint:
              burstMetrics.productRenderPerObservedPaint,
            pixiRenderPerObservedPaint:
              burstMetrics.pixiRenderPerObservedPaint,
            frameCoordinatorCounters: {
              renderFrameCount:
                burstMetrics.counters['render-frame-count'] ?? 0,
              renderFrameIdCount:
                burstMetrics.counters['render-frame-id'] ?? 0,
              dirtyChangeCount:
                burstMetrics.counters['dirty-change-count'] ?? 0,
              dirtyElementCount:
                burstMetrics.counters['dirty-element-count'] ?? 0,
              dirtyChangeCoalescedCount:
                burstMetrics.counters['dirty-change-coalesced-count'] ?? 0,
              productRenderPerRenderFrame:
                burstMetrics.counters['product-render-per-render-frame'] ?? 0
            },
            freshnessProbe: burstMetrics.freshnessProbe,
            selectedPhaseTotals: {
              'feature:event:input.drag.update':
                burstMetrics.phaseTotalMs[
                  'feature:event:input.drag.update'
                ] ?? 0,
              'render-scene-tree:flush':
                burstMetrics.phaseTotalMs['render-scene-tree:flush'] ?? 0,
              'render-layer:strategy:vector':
                burstMetrics.phaseTotalMs['render-layer:strategy:vector'] ?? 0,
              'render:pixi-app-render':
                burstMetrics.phaseTotalMs['render:pixi-app-render'] ?? 0,
              'browser:paint-wait':
                burstMetrics.phaseTotalMs['browser:paint-wait'] ?? 0
            }
          }
        })}`
      )
    }
    console.log(
      `STROKE_DRAG_E2E_METRICS ${JSON.stringify({
        measurementScope: 'browser-ux',
        rendererCoverage: 'real',
        phaseMeasurementPaintIndex: 0,
        paintObservationWindow: 3,
        frameBudgetMs: FRAME_BUDGET_120FPS_MS,
        vectorPointDragResolvedGeometryP95BudgetMs:
          VECTOR_POINT_DRAG_RESOLVED_GEOMETRY_P95_BUDGET_MS,
        enforce120fps: SHOULD_ENFORCE_120FPS,
        schedulingBaseline,
        maxP95Ms,
        maxVectorRenderPhaseP95,
        maxRenderFlushPhaseP95,
        totalDroppedFrameCount,
        metrics,
        burstMetrics
      })}`
    )
    console.log(
      `STROKE_DRAG_E2E_PHASE_METRICS ${JSON.stringify({
        measurementScope: 'browser-ux',
        rendererCoverage: 'real',
        phaseMeasurementPaintIndex: 0,
        paintObservationWindow: 3,
        schedulingBaseline,
        maxP95Ms,
        maxVectorRenderPhaseP95,
        maxRenderFlushPhaseP95,
        totalDroppedFrameCount,
        scenarios: metrics.map((metric) => ({
          label: metric.label,
          frameCount: metric.frameCount,
          paintFrameCount: metric.paintFrameCount,
          p95Ms: metric.p95Ms,
          maxMs: metric.maxMs,
          droppedFrameCount: metric.droppedFrameCount,
          dominantPhase: metric.dominantPhase,
          productRenderObserved: metric.productRenderObserved,
          computedPatchFrameCount: metric.computedPatchFrameCount,
          sceneTreeVectorRenderFrameCount:
            metric.sceneTreeVectorRenderFrameCount,
          productVectorRenderFrameCount: metric.productVectorRenderFrameCount,
          pixiRenderFrameCount: metric.pixiRenderFrameCount,
          productRenderLatencyP95Ms: metric.productRenderLatencyP95Ms,
          pixiRenderLatencyP95Ms: metric.pixiRenderLatencyP95Ms,
          renderFlushFrameCount: metric.renderFlushFrameCount,
          directRenderPropertyFrameCount: metric.directRenderPropertyFrameCount,
          overlayRenderFrameCount: metric.overlayRenderFrameCount,
          overlayOnlyFrameCount: metric.overlayOnlyFrameCount,
          lateProductRenderFrameCount: metric.lateProductRenderFrameCount,
          paintSchedulingP95MinusBaseline:
            metric.paintSchedulingP95MinusBaseline,
          instrumentationGaps: metric.instrumentationGaps,
          instrumentationErrors: metric.instrumentationErrors,
          freshnessProbe: metric.freshnessProbe,
          phaseP95Ms: metric.phaseP95Ms,
          phaseAverageMs: metric.phaseAverageMs,
          counters: metric.counters
        }))
      })}`
    )
    console.log(
      `STROKE_DRAG_E2E_FRAME_ALIGNED_METRICS ${JSON.stringify({
        measurementScope: 'browser-ux',
        rendererCoverage: 'real',
        paintObservationWindow: 3,
        schedulingBaseline,
        scenarios: metrics.map((metric) => ({
          label: metric.label,
          frameCount: metric.frameCount,
          paintFrameCount: metric.paintFrameCount,
          productRenderObserved: metric.productRenderObserved,
          computedPatchFrameCount: metric.computedPatchFrameCount,
          sceneTreeVectorRenderFrameCount:
            metric.sceneTreeVectorRenderFrameCount,
          productVectorRenderFrameCount: metric.productVectorRenderFrameCount,
          pixiRenderFrameCount: metric.pixiRenderFrameCount,
          productRenderLatencyP95Ms: metric.productRenderLatencyP95Ms,
          pixiRenderLatencyP95Ms: metric.pixiRenderLatencyP95Ms,
          directRenderPropertyFrameCount: metric.directRenderPropertyFrameCount,
          overlayOnlyFrameCount: metric.overlayOnlyFrameCount,
          lateProductRenderFrameCount: metric.lateProductRenderFrameCount,
          paintSchedulingP95MinusBaseline:
            metric.paintSchedulingP95MinusBaseline,
          dominantPhase: metric.dominantPhase,
          freshnessProbe: metric.freshnessProbe,
          frameCoordinatorCounters: {
            renderFrameCount: metric.counters['render-frame-count'] ?? 0,
            renderFrameIdCount: metric.counters['render-frame-id'] ?? 0,
            dirtyChangeCount: metric.counters['dirty-change-count'] ?? 0,
            dirtyElementCount: metric.counters['dirty-element-count'] ?? 0,
            dirtyChangeCoalescedCount:
              metric.counters['dirty-change-coalesced-count'] ?? 0,
            productRenderPerRenderFrame:
              metric.counters['product-render-per-render-frame'] ?? 0
          },
          instrumentationGaps: metric.instrumentationGaps,
          instrumentationErrors: metric.instrumentationErrors
        }))
      })}`
    )

    expect(maxP95Ms).toBeGreaterThan(0)
    expect(maxVectorRenderPhaseP95).toBeGreaterThan(0)
    expect(maxRenderFlushPhaseP95).toBeGreaterThan(0)
  })
})
