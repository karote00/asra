import { expect, test, type Page } from '@playwright/test'
import { resetCanvas, waitForAppReady } from './test-utils'

interface ParameterSwitchSample {
  label: string
  elapsedMs: number
  requestedValue: unknown
  appliedValue: unknown
  renderedValue: unknown
  visible: boolean
  productOutputCount: number
  renderEntryCount: number
  exportPacketCount: number
  hitAreaPresent: boolean
  phaseSamples: { phaseName: string; durationMs: number }[]
  counters: Record<string, number>
  revisionChanges: {
    cacheKey: string
    changedRevisionKeys: string[]
    previousSourcePathRevision: unknown
    nextSourcePathRevision: unknown
    previousSharedGeometryRevision: unknown
    nextSharedGeometryRevision: unknown
    previousIntervalAllocationRevision: unknown
    nextIntervalAllocationRevision: unknown
  }[]
}

const SHOULD_ENFORCE_PARAMETER_E2E =
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_ENFORCE === '1'
const PARAMETER_E2E_P95_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_P95_BUDGET_MS ?? 50
)
const PARAMETER_E2E_ACTION_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_E2E_ACTION_BUDGET_MS ?? 100
)
const CONTINUOUS_PARAMETER_FRAME_COUNT = Number(
  process.env.ASYRA_STROKE_PARAMETER_CONTINUOUS_E2E_FRAMES ?? 120
)
const CONTINUOUS_PARAMETER_FRAME_BUDGET_MS = Number(
  process.env.ASYRA_STROKE_PARAMETER_CONTINUOUS_E2E_BUDGET_MS ?? 8.33
)
const CONTINUOUS_PARAMETER_MINIMUM_GEOMETRY_SAMPLE_RATIO = 0.9
const SHOULD_ENFORCE_CONTINUOUS_PARAMETER_BUDGET =
  process.env.ASYRA_STROKE_PARAMETER_CONTINUOUS_E2E_ENFORCE === '1'
const SHOULD_COLLECT_PARAMETER_E2E_DIAGNOSTICS =
  process.env.ASYRA_STROKE_PARAMETER_E2E_DIAGNOSTICS === '1'
const RESOLVED_STROKE_GEOMETRY_PHASE_NAMES = new Set([
  'resolved vector geometry model',
  'constrained dashed packets',
  'constrained solid diagnostics',
  'stroke packets',
  'final faces',
  'legal domains',
  'visual overlap collapse'
])

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const installCounterSink = async (page: Page) => {
  await page.evaluate(
    ({ collectDetailedDiagnostics, resolvedStrokeGeometryPhaseNames }) => {
      const target = window as typeof window & {
        __asyraStrokeParameterSwitchCounters?: Record<string, number>
        __asyraStrokeParameterSwitchPhases?: {
          phaseName: string
          durationMs: number
        }[]
        __asyraStrokeParameterDetailedDiagnostics?: boolean
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraVectorRenderPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraResolvedVectorGeometryPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokeProductGeometryPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
        __asyraStrokePipelineCounterSink?: (
          counterName: string,
          value?: number
        ) => void
      }
      target.__asyraStrokeParameterSwitchCounters = {}
      target.__asyraStrokeParameterSwitchPhases = []
      target.__asyraStrokeParameterDetailedDiagnostics =
        collectDetailedDiagnostics
      const recordPhase = (phaseName: string, durationMs: number) => {
        target.__asyraStrokeParameterSwitchPhases?.push({
          phaseName,
          durationMs
        })
      }
      const requiredPhaseNames = new Set([
        ...resolvedStrokeGeometryPhaseNames,
        'render-layer:strategy:vector',
        'render:flush-frame'
      ])
      const recordRequiredPhase = (phaseName: string, durationMs: number) => {
        if (requiredPhaseNames.has(phaseName)) {
          recordPhase(phaseName, durationMs)
        }
      }
      target.__asyraBrowserDragPhaseSink = collectDetailedDiagnostics
        ? recordPhase
        : recordRequiredPhase
      target.__asyraVectorRenderPhaseSink = collectDetailedDiagnostics
        ? recordPhase
        : undefined
      target.__asyraResolvedVectorGeometryPhaseSink = collectDetailedDiagnostics
        ? undefined
        : recordRequiredPhase
      target.__asyraStrokeProductGeometryPhaseSink = collectDetailedDiagnostics
        ? undefined
        : recordRequiredPhase
      target.__asyraStrokePipelineCounterSink = (counterName, value = 1) => {
        const recordsRequiredEvidence =
          counterName === 'render-frame-count' ||
          counterName.startsWith('stroke-stage-cache:') ||
          counterName.startsWith('stroke-revision-change:') ||
          counterName.startsWith('stroke-dirty-key:') ||
          counterName.startsWith('stroke-cache:')
        if (!collectDetailedDiagnostics && !recordsRequiredEvidence) {
          return
        }
        const counters = target.__asyraStrokeParameterSwitchCounters ?? {}
        counters[counterName] = (counters[counterName] ?? 0) + value
        target.__asyraStrokeParameterSwitchCounters = counters
      }
    },
    {
      collectDetailedDiagnostics: SHOULD_COLLECT_PARAMETER_E2E_DIAGNOSTICS,
      resolvedStrokeGeometryPhaseNames: [
        ...RESOLVED_STROKE_GEOMETRY_PHASE_NAMES
      ]
    }
  )
}

const createSelfIntersectingStrokeVector = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementApis = (window as any).__AsyraE2E__?.elementApis
    if (!core || !elementApis) {
      throw new Error('Missing E2E core or element APIs')
    }
    const starOrder = [0, 2, 4, 1, 3]
    const center = { x: 120, y: 120 }
    const radius = 104
    const pointIds: string[] = []
    const segmentIds: string[] = []
    const points: Record<string, unknown> = {}
    const segments: Record<string, unknown> = {}
    const authoredPointValues: { x: number; y: number }[] = []

    starOrder.forEach((outerPointIndex, pointIndex) => {
      const angle = -Math.PI / 2 + (outerPointIndex * Math.PI * 2) / 5
      const pointId = `parameter-star-p-${pointIndex}`
      points[pointId] = {
        id: pointId,
        kind: 'anchor',
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        anchorType: 'sharp'
      }
      authoredPointValues.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
      pointIds.push(pointId)
    })

    pointIds.forEach((startId, pointIndex) => {
      const endId = pointIds[(pointIndex + 1) % pointIds.length]
      const segmentId = `parameter-star-s-${pointIndex}`
      segments[segmentId] = {
        id: segmentId,
        startId,
        endId,
        outControlId: null,
        inControlId: null
      }
      segmentIds.push(segmentId)
    })

    const minX = Math.min(...authoredPointValues.map((point) => point.x))
    const minY = Math.min(...authoredPointValues.map((point) => point.y))
    const maxX = Math.max(...authoredPointValues.map((point) => point.x))
    const maxY = Math.max(...authoredPointValues.map((point) => point.y))

    const vectorId = elementApis.createElement(
      {
        type: 'vector',
        pointCoordinateSpace: 'workspace',
        points,
        segments,
        networks: {
          'parameter-star-network': {
            id: 'parameter-star-network',
            pointIds,
            segmentIds,
            closed: true
          }
        },
        closed: true
      },
      { undoable: false }
    )
    if (!vectorId) {
      throw new Error('Failed to create parameter switch vector')
    }

    elementApis.changeComputedData(
      [vectorId],
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        pointCoordinateSpace: 'workspace',
        points,
        segments,
        networks: {
          'parameter-star-network': {
            id: 'parameter-star-network',
            pointIds,
            segmentIds,
            closed: true
          }
        },
        closed: true,
        fills: [],
        strokes: [
          {
            id: 'parameter-star-stroke',
            kind: 'solid',
            style: 'dashed',
            position: 'inside',
            width: 14,
            dash: 22,
            gap: 14,
            color: '#b51212',
            opacity: 72,
            visible: true,
            fill: null,
            defaultColorFormat: 'hex',
            colorFormat: 'hex',
            gradient: null,
            joinType: 'miter',
            capType: 'butt',
            miterAngle: 28.96
          }
        ]
      },
      { undoable: false }
    )

    core?.selectElements?.([vectorId], { undoable: false })
    return vectorId as string
  })

const measureParameterSwitch = async (
  page: Page,
  label: string,
  field: string,
  value: unknown
): Promise<ParameterSwitchSample> =>
  page.evaluate(
    async ({ label, field, value }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const strokeApis = (window as any).__AsyraE2E__?.strokeApis
      const target = window as typeof window & {
        __asyraStrokeParameterSwitchCounters?: Record<string, number>
        __asyraStrokeParameterSwitchPhases?: {
          phaseName: string
          durationMs: number
        }[]
        __asyraStrokeParameterDetailedDiagnostics?: boolean
      }
      if (!strokeApis) {
        throw new Error('Missing E2E stroke common APIs')
      }
      target.__asyraStrokeParameterSwitchCounters = {}
      target.__asyraStrokeParameterSwitchPhases = []

      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!selectedId) {
        throw new Error('No selected vector for stroke parameter switch')
      }
      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const stroke = Array.isArray(computed.strokes)
        ? computed.strokes[0]
        : undefined
      if (!stroke?.id) {
        throw new Error('No selected vector stroke for parameter switch')
      }

      const previousRenderElement = core?.deps?.render?.getElementById?.(
        selectedId
      ) as
        | {
            __asyraStrokeMeshCache?: Map<
              string,
              { revisionSet?: Record<string, unknown> }
            >
          }
        | undefined
      const previousRevisionSets =
        target.__asyraStrokeParameterDetailedDiagnostics
          ? new Map(
              [
                ...(previousRenderElement?.__asyraStrokeMeshCache?.entries() ??
                  [])
              ]
                .filter((entry) => entry[1].revisionSet !== undefined)
                .map(([cacheKey, entry]) => [
                  cacheKey,
                  { ...(entry.revisionSet ?? {}) }
                ])
            )
          : new Map<string, Record<string, unknown>>()

      const start = performance.now()
      strokeApis.updateStrokeField(
        selectedId,
        stroke.id,
        stroke,
        field,
        value,
        { undoable: false }
      )

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve()
          })
        )
      )
      const elapsedMs = performance.now() - start

      const nextElement = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const nextComputed = nextElement?.getAllComputedData?.() ?? {}
      const nextStroke = Array.isArray(nextComputed.strokes)
        ? nextComputed.strokes[0]
        : undefined
      const renderElement = core?.deps?.render?.getElementById?.(selectedId) as
        | {
            __asyraStrokeMeshCache?: Map<string, unknown>
            __asyraStrokePipelineStageCache?: {
              products?: Map<string, unknown>
            }
            __asyraStrokeRenderEntries?: unknown[]
            __asyraSolidCenterStrokeExportPackets?: unknown[]
            __asyraCenterPathSolidStrokeRenderCount?: number
            __asyraCenterSolidPathMaskRenderCount?: number
            __asyraLastRenderDataSnapshot?: {
              strokes?: Record<string, unknown>[]
            }
            hitArea?: unknown
          }
        | undefined
      const root = core?.deps?.render?.viewport?.view as
        | { label?: string; children?: unknown[] }
        | undefined
      const stack: { label?: string; children?: unknown[] }[] = root
        ? [root]
        : []
      let renderObjectCount = 0
      while (stack.length > 0) {
        const current = stack.pop()
        if (!current) {
          continue
        }
        if (current.label === selectedId) {
          renderObjectCount += 1
        }
        current.children?.forEach((child: unknown) =>
          stack.push(child as { label?: string; children?: unknown[] })
        )
      }

      const counters = target.__asyraStrokeParameterSwitchCounters ?? {}
      const renderedStroke = Array.isArray(
        renderElement?.__asyraLastRenderDataSnapshot?.strokes
      )
        ? renderElement.__asyraLastRenderDataSnapshot.strokes[0]
        : undefined
      const productOutputCount =
        renderObjectCount +
        (renderElement?.__asyraStrokeMeshCache?.size ?? 0) +
        (renderElement?.__asyraStrokePipelineStageCache?.products?.size ?? 0) +
        (renderElement?.__asyraSolidCenterStrokeExportPackets?.length ?? 0) +
        (renderElement?.__asyraCenterPathSolidStrokeRenderCount ?? 0) +
        (renderElement?.__asyraCenterSolidPathMaskRenderCount ?? 0) +
        (renderElement?.hitArea ? 1 : 0) +
        (counters['stroke-stage-cache:product-geometry-hit'] ?? 0) +
        (counters['stroke-stage-cache:product-geometry-store'] ?? 0) +
        (counters['visual-overlap-collapse-no-union-backend'] ?? 0)
      const revisionChanges = target.__asyraStrokeParameterDetailedDiagnostics
        ? [...(renderElement?.__asyraStrokeMeshCache?.entries() ?? [])].flatMap(
            ([cacheKey, entry]) => {
              const previous = previousRevisionSets.get(cacheKey)
              const next = (entry as { revisionSet?: Record<string, unknown> })
                .revisionSet
              if (!previous || !next) {
                return []
              }
              const changedRevisionKeys = Object.keys(next).filter(
                (revisionKey) =>
                  !Object.is(previous[revisionKey], next[revisionKey])
              )
              if (!changedRevisionKeys.includes('sourcePathRevision')) {
                return []
              }
              return [
                {
                  cacheKey,
                  changedRevisionKeys,
                  previousSourcePathRevision: previous.sourcePathRevision,
                  nextSourcePathRevision: next.sourcePathRevision,
                  previousSharedGeometryRevision:
                    previous.sharedGeometryRevision,
                  nextSharedGeometryRevision: next.sharedGeometryRevision,
                  previousIntervalAllocationRevision:
                    previous.intervalAllocationRevision,
                  nextIntervalAllocationRevision:
                    next.intervalAllocationRevision
                }
              ]
            }
          )
        : []

      return {
        label,
        elapsedMs,
        requestedValue: value,
        appliedValue: nextStroke?.[field],
        renderedValue: renderedStroke?.[field],
        visible:
          nextStroke?.visible !== false && nextStroke?.fill?.visible !== false,
        productOutputCount,
        renderEntryCount:
          renderElement?.__asyraStrokeRenderEntries?.length ?? 0,
        exportPacketCount:
          renderElement?.__asyraSolidCenterStrokeExportPackets?.length ?? 0,
        hitAreaPresent: renderElement?.hitArea !== undefined,
        phaseSamples: [...(target.__asyraStrokeParameterSwitchPhases ?? [])],
        counters,
        revisionChanges
      }
    },
    { label, field, value }
  )

interface ContinuousParameterUpdate {
  field: string
  value: unknown
}

const runContinuousParameterGate = async (
  page: Page,
  group: 'width' | 'dash-gap' | 'miter',
  getUpdate: (frame: number) => ContinuousParameterUpdate
) => {
  const samples: ParameterSwitchSample[] = []
  for (let frame = 0; frame < CONTINUOUS_PARAMETER_FRAME_COUNT; frame += 1) {
    const update = getUpdate(frame)
    samples.push(
      await measureParameterSwitch(
        page,
        `${group}:${frame}`,
        update.field,
        update.value
      )
    )
  }

  const phaseDurations = (phaseName: string) =>
    samples.flatMap((sample) =>
      sample.phaseSamples
        .filter((phase) => phase.phaseName === phaseName)
        .map((phase) => phase.durationMs)
    )
  const resolvedGeometryDurations = samples
    .map((sample) =>
      sample.phaseSamples
        .filter((phase) =>
          RESOLVED_STROKE_GEOMETRY_PHASE_NAMES.has(phase.phaseName)
        )
        .reduce((total, phase) => total + phase.durationMs, 0)
    )
    .filter((durationMs) => durationMs > 0)
  const vectorRenderDurations = phaseDurations('render-layer:strategy:vector')
  const renderFlushDurations = phaseDurations('render:flush-frame')
  const phaseCounts = samples
    .flatMap((sample) => sample.phaseSamples)
    .reduce<Record<string, number>>((counts, phase) => {
      counts[phase.phaseName] = (counts[phase.phaseName] ?? 0) + 1
      return counts
    }, {})
  const allPhaseSummaries = Object.entries(
    samples
      .flatMap((sample) => sample.phaseSamples)
      .reduce<Record<string, number[]>>((durations, phase) => {
        ;(durations[phase.phaseName] ??= []).push(phase.durationMs)
        return durations
      }, {})
  )
    .map(([phaseName, durations]) => ({
      phaseName,
      sampleCount: durations.length,
      p95Ms: getPercentile(durations, 0.95),
      maxMs: Math.max(...durations),
      totalMs: durations.reduce((total, duration) => total + duration, 0)
    }))
    .sort((left, right) => right.totalMs - left.totalMs)
  const phaseSummaries = allPhaseSummaries.slice(0, 12)
  const focusedPhaseSummaries = allPhaseSummaries.filter((phase) =>
    [
      'constrained dashed join ownership:',
      'constrained dashed join: inside legal clip',
      'constrained dashed packets: join ',
      'constrained dashed terminal body:',
      'render entries: constrained dashed',
      'render entries: same-paint',
      'render projection:'
    ].some((prefix) => phase.phaseName.startsWith(prefix))
  )
  const slowestVectorFrames = samples
    .map((sample) => ({
      label: sample.label,
      vectorRenderMs:
        sample.phaseSamples.find(
          (phase) => phase.phaseName === 'render-layer:strategy:vector'
        )?.durationMs ?? 0,
      topPhases: [...sample.phaseSamples]
        .filter((phase) => phase.phaseName !== 'render-layer:strategy:vector')
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 6)
    }))
    .sort((left, right) => right.vectorRenderMs - left.vectorRenderMs)
    .slice(0, 5)
  const aggregateCounters = samples.reduce<Record<string, number>>(
    (aggregate, sample) => {
      Object.entries(sample.counters).forEach(([counterName, value]) => {
        aggregate[counterName] = (aggregate[counterName] ?? 0) + value
      })
      return aggregate
    },
    {}
  )
  const revisionCounters = Object.fromEntries(
    Object.entries(aggregateCounters).filter(([counterName]) =>
      counterName.startsWith('stroke-revision-change:')
    )
  )
  const dirtyCounters = Object.fromEntries(
    Object.entries(aggregateCounters).filter(([counterName]) =>
      counterName.startsWith('stroke-dirty-key:')
    )
  )
  const stageCacheCounters = Object.fromEntries(
    Object.entries(aggregateCounters).filter(([counterName]) =>
      counterName.startsWith('stroke-stage-cache:')
    )
  )
  const renderEntryProofCounters = Object.fromEntries(
    Object.entries(aggregateCounters).filter(([counterName]) =>
      counterName.startsWith('render-entry-post-legality-')
    )
  )
  const metrics = {
    group,
    detailedDiagnostics: SHOULD_COLLECT_PARAMETER_E2E_DIAGNOSTICS,
    frameCount: samples.length,
    frameBudgetMs: CONTINUOUS_PARAMETER_FRAME_BUDGET_MS,
    resolvedGeometryPhaseNames: [...RESOLVED_STROKE_GEOMETRY_PHASE_NAMES],
    minimumResolvedGeometrySampleCount: Math.ceil(
      samples.length * CONTINUOUS_PARAMETER_MINIMUM_GEOMETRY_SAMPLE_RATIO
    ),
    resolvedGeometrySampleCount: resolvedGeometryDurations.length,
    resolvedGeometryP95Ms: getPercentile(resolvedGeometryDurations, 0.95),
    vectorRenderSampleCount: vectorRenderDurations.length,
    vectorRenderP95Ms: getPercentile(vectorRenderDurations, 0.95),
    renderFlushSampleCount: renderFlushDurations.length,
    renderFlushP95Ms: getPercentile(renderFlushDurations, 0.95),
    renderFlushAverageMs:
      renderFlushDurations.reduce((total, value) => total + value, 0) /
      Math.max(1, renderFlushDurations.length),
    phaseCounts,
    phaseSummaries,
    focusedPhaseSummaries,
    slowestVectorFrames,
    revisionCounters,
    dirtyCounters,
    stageCacheCounters,
    renderEntryProofCounters,
    revisionChangeDetails: SHOULD_COLLECT_PARAMETER_E2E_DIAGNOSTICS
      ? samples.flatMap((sample) =>
          sample.revisionChanges.map((change) => ({
            frame: sample.label,
            ...change
          }))
        )
      : [],
    invalidChannelCount: samples.filter(
      (sample) =>
        !Object.is(sample.requestedValue, sample.appliedValue) ||
        !Object.is(sample.appliedValue, sample.renderedValue) ||
        !sample.visible ||
        sample.renderEntryCount === 0 ||
        sample.exportPacketCount === 0 ||
        !sample.hitAreaPresent
    ).length
  }

  process.stdout.write(
    `STROKE_CONTINUOUS_PARAMETER_E2E ${JSON.stringify(metrics)}\n`
  )

  expect(metrics.invalidChannelCount).toBe(0)
  expect(metrics.resolvedGeometrySampleCount).toBeGreaterThanOrEqual(
    metrics.minimumResolvedGeometrySampleCount
  )
  expect(metrics.vectorRenderSampleCount).toBeGreaterThan(0)
  expect(metrics.renderFlushSampleCount).toBeGreaterThan(0)
  const expectedRevisionChangesByGroup = {
    width: [
      'strokeDomainRevision',
      'terminalCapRevision',
      'joinShapeRevision',
      'renderOutputRevision'
    ],
    'dash-gap': [
      'intervalAllocationRevision',
      'dashAndGapRevision',
      'renderOutputRevision'
    ],
    miter: ['joinShapeRevision', 'renderOutputRevision']
  } as const
  const preservedRevisionChangesByGroup = {
    width: [
      'sourcePathRevision',
      'intervalAllocationRevision',
      'paintRevision'
    ],
    'dash-gap': ['sourcePathRevision', 'joinShapeRevision', 'paintRevision'],
    miter: [
      'sourcePathRevision',
      'strokeDomainRevision',
      'intervalAllocationRevision',
      'dashAndGapRevision',
      'paintRevision'
    ]
  } as const
  expectedRevisionChangesByGroup[group].forEach((revisionKey) => {
    expect(
      revisionCounters[`stroke-revision-change:${revisionKey}`] ?? 0,
      `${group} should dirty ${revisionKey}`
    ).toBeGreaterThan(0)
  })
  preservedRevisionChangesByGroup[group].forEach((revisionKey) => {
    expect(
      revisionCounters[`stroke-revision-change:${revisionKey}`] ?? 0,
      `${group} should preserve ${revisionKey}`
    ).toBe(0)
  })
  expect(Object.keys(dirtyCounters).length).toBeGreaterThan(0)
  expect(
    (stageCacheCounters['stroke-stage-cache:product-geometry-miss'] ?? 0) +
      (stageCacheCounters['stroke-stage-cache:product-geometry-primed'] ?? 0)
  ).toBeGreaterThan(0)
  expect(
    stageCacheCounters['stroke-stage-cache:product-geometry-store'] ?? 0
  ).toBeGreaterThan(0)
  expect(
    stageCacheCounters['stroke-stage-cache:product-geometry-hit'] ?? 0
  ).toBeGreaterThan(0)
  if (SHOULD_ENFORCE_CONTINUOUS_PARAMETER_BUDGET) {
    expect(metrics.resolvedGeometryP95Ms).toBeLessThan(
      CONTINUOUS_PARAMETER_FRAME_BUDGET_MS
    )
    expect(metrics.vectorRenderP95Ms).toBeLessThan(
      CONTINUOUS_PARAMETER_FRAME_BUDGET_MS
    )
    expect(metrics.renderFlushAverageMs).toBeLessThan(
      CONTINUOUS_PARAMETER_FRAME_BUDGET_MS
    )
  }
}

test.describe('stroke parameter switch performance UX gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
    await installCounterSink(page)
    await createSelfIntersectingStrokeVector(page)
    await page.waitForTimeout(120)
  })

  test('should run: keep static stroke parameter switches on cached product stages', async ({
    page
  }) => {
    const samples: ParameterSwitchSample[] = []
    const switches: { label: string; field: string; value: unknown }[] = [
      { label: 'cap-square', field: 'capType', value: 'square' },
      { label: 'cap-round', field: 'capType', value: 'round' },
      { label: 'cap-butt', field: 'capType', value: 'butt' },
      { label: 'join-bevel', field: 'joinType', value: 'bevel' },
      { label: 'join-round', field: 'joinType', value: 'round' },
      { label: 'join-miter', field: 'joinType', value: 'miter' },
      { label: 'miter-low', field: 'miterAngle', value: 12 },
      { label: 'miter-high', field: 'miterAngle', value: 60 },
      { label: 'width-wide', field: 'width', value: 22 },
      { label: 'width-base', field: 'width', value: 14 },
      { label: 'position-outside', field: 'position', value: 'outside' },
      { label: 'position-center', field: 'position', value: 'center' },
      { label: 'position-inside', field: 'position', value: 'inside' },
      { label: 'style-solid', field: 'style', value: 'solid' },
      { label: 'style-dashed', field: 'style', value: 'dashed' },
      { label: 'dash-a', field: 'dash', value: 16 },
      { label: 'dash-b', field: 'dash', value: 22 },
      { label: 'gap-a', field: 'gap', value: 20 },
      { label: 'gap-b', field: 'gap', value: 14 },
      { label: 'paint-green', field: 'color', value: '#18a86f' },
      { label: 'paint-red', field: 'color', value: '#b51212' },
      { label: 'opacity-low', field: 'opacity', value: 48 },
      { label: 'opacity-high', field: 'opacity', value: 72 },
      { label: 'visible-off', field: 'visible', value: false },
      { label: 'visible-on', field: 'visible', value: true },
      { label: 'cap-square-warm', field: 'capType', value: 'square' },
      { label: 'cap-round-warm', field: 'capType', value: 'round' },
      { label: 'join-bevel-warm', field: 'joinType', value: 'bevel' },
      { label: 'join-round-warm', field: 'joinType', value: 'round' }
    ]

    for (const parameterSwitch of switches) {
      samples.push(
        await measureParameterSwitch(
          page,
          parameterSwitch.label,
          parameterSwitch.field,
          parameterSwitch.value
        )
      )
    }

    const visibleInvalidSamples = samples.filter(
      (sample) => sample.visible && sample.productOutputCount === 0
    )
    const channelInvalidSamples = samples.filter(
      (sample) =>
        sample.visible &&
        (sample.renderEntryCount === 0 ||
          sample.exportPacketCount === 0 ||
          !sample.hitAreaPresent)
    )
    const elapsedMs = samples.map((sample) => sample.elapsedMs)
    const p95Ms = getPercentile(elapsedMs, 0.95)
    const maxMs = Math.max(...elapsedMs)
    const aggregateCounters = samples.reduce<Record<string, number>>(
      (counters, sample) => {
        Object.entries(sample.counters).forEach(([counterName, value]) => {
          counters[counterName] = (counters[counterName] ?? 0) + value
        })
        return counters
      },
      {}
    )

    process.stdout.write(
      `STROKE_PARAMETER_SWITCH_E2E ${JSON.stringify({
        sampleCount: samples.length,
        p95Ms,
        maxMs,
        visibleInvalidCount: visibleInvalidSamples.length,
        channelInvalidCount: channelInvalidSamples.length,
        counters: aggregateCounters,
        samples
      })}\n`
    )

    expect(visibleInvalidSamples).toEqual([])
    expect(channelInvalidSamples).toEqual([])
    expect(aggregateCounters['render-frame-count'] ?? 0).toBeGreaterThan(0)
    if (SHOULD_ENFORCE_PARAMETER_E2E) {
      expect(p95Ms).toBeLessThanOrEqual(PARAMETER_E2E_P95_BUDGET_MS)
      expect(maxMs).toBeLessThanOrEqual(PARAMETER_E2E_ACTION_BUDGET_MS)
    }
  })

  test('continuous width updates stay within 120fps phase budgets', async ({
    page
  }) => {
    await runContinuousParameterGate(page, 'width', (frame) => ({
      field: 'width',
      value:
        frame === CONTINUOUS_PARAMETER_FRAME_COUNT - 1 ? 8 : 8 + frame * 0.125
    }))
  })

  test('continuous dash and gap updates stay within 120fps phase budgets', async ({
    page
  }) => {
    await runContinuousParameterGate(page, 'dash-gap', (frame) => ({
      field: frame % 2 === 0 ? 'dash' : 'gap',
      value:
        frame >= CONTINUOUS_PARAMETER_FRAME_COUNT - 2
          ? 8 +
            (frame - (CONTINUOUS_PARAMETER_FRAME_COUNT - 2)) * 0.125
          : 8 + frame * 0.125
    }))
  })

  test('continuous miter updates stay within 120fps phase budgets', async ({
    page
  }) => {
    await runContinuousParameterGate(page, 'miter', (frame) => ({
      field: 'miterAngle',
      value:
        frame === CONTINUOUS_PARAMETER_FRAME_COUNT - 1
          ? 8
          : 8 + frame * 0.5
    }))
  })
})
