import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import { buildConstrainedDashedStrokeResolvedPackets } from '../components/stroke-render/constrained-dashed-stroke-packets'
import { buildVectorGeometryModelPath } from '../components/stroke-render/path-geometry'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import { attachStrokePacketDebugMeta } from '../components/stroke-render/solid-center-stroke-packets'
import {
  buildSolidCenterStrokeFinalFaces,
  createSolidCenterStrokeHitAreaFromFinalFaces,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../components/stroke-render/solid-center-stroke-packets'
import { renderSolidCenterStrokeEntries } from '../components/stroke-render/solid-center-stroke-render'

const FRAME_COUNT = Number(
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_FRAMES ?? 300
)
const WARMUP_FRAMES = Math.min(20, Math.max(0, Math.floor(FRAME_COUNT / 10)))
const describeProfile =
  process.env.ASYRA_STROKE_PARAMETER_SWITCH_PROFILE === '1'
    ? describe
    : describe.skip
const PERFORMANCE_MEASUREMENT_SCOPE = 'cpu-only'
const RENDERER_COVERAGE = 'fake'
const DOES_NOT_MEASURE_RENDERER = true

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext =
    HTMLCanvasElement.prototype.getContext ?? (() => null)

  const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()
  const presetDeps = {
    sceneTree: {
      getElementById: () => undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  } as unknown as PresetDependencies

  applyPreset(
    {
      registerEvent: (event: string | { eventName: string }) => ({
        eventName: typeof event === 'string' ? event : event.eventName,
        publish: () => undefined,
        subscribe: () => new Subscription()
      }),
      registerDataChannelObserver: () => undefined,
      getPresetDependencies: () => presetDeps,
      registerRenderLayer: () => undefined,
      registerPropertySchema: () => undefined,
      defineSelection: () => undefined,
      getSelection: () => undefined,
      defineUIProperty: () => undefined,
      defineSystemProperty: <T>(key: string, defaultValue: T) => {
        const existing = systemPropertyMap.get(key)
        if (existing) {
          return existing as BehaviorSubject<T>
        }

        const state = new BehaviorSubject<T>(defaultValue)
        systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
        return state
      },
      getSystemPropertyObservable: <T>(key: string) =>
        systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
      createRenderGradientFillStyle: () => null as never
    },
    presetDeps
  )

  core.defineSystemProperty<string | null>('pathEditingVectorId', null)
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('mouseDragging', false)
  core.defineSystemProperty<boolean>(
    'strokeDebugDisableVisualOverlapCollapse',
    false
  )
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: unknown[]
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  moveTo() {
    return this
  }

  lineTo() {
    return this
  }

  bezierCurveTo() {
    return this
  }

  closePath() {
    return this
  }

  cut() {
    return this
  }

  fill() {
    return this
  }
}

const getPercentile = (values: number[], percentile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * percentile) - 1)
  )
  return sorted[index] ?? 0
}

const toReportedClosedStarVectorData = () => ({
  points: {
    'tp-56': {
      id: 'tp-56',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 246.91886685202462,
      y: 0
    },
    'tp-57': {
      id: 'tp-57',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 75.04396933738008,
      y: 457.5261356375752
    },
    'tp-56:out': {
      id: 'tp-56:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 195.9809570843745,
      y: 149.61104635348715
    },
    'tp-57:in': {
      id: 'tp-57:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: -46.963000165973426,
      y: 476.8923212730281
    },
    'tp-57:out': {
      id: 'tp-57:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 227.55268121657173,
      y: 433.3184035932593
    },
    'tp-58': {
      id: 'tp-58',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 423.6353107755326,
      y: 198.5034027633924
    },
    'tp-59': {
      id: 'tp-59',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: 0,
      y: 91.98938176840147
    },
    'tp-60': {
      id: 'tp-60',
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'smooth',
      x: 307.43819696281525,
      y: 428.4768571843963
    },
    'tp-59:out': {
      id: 'tp-59:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 0,
      y: 91.98938176840147
    },
    'tp-60:in': {
      id: 'tp-60:in',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.IN,
      x: 275.9681453052044,
      y: 498.6792801129134
    },
    'tp-60:out': {
      id: 'tp-60:out',
      kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
      controlRole: VECTOR_TOKENS.CONTROL.ROLE.OUT,
      x: 338.9082486204261,
      y: 358.2744342558792
    }
  } satisfies Record<string, VectorPointNode>,
  segments: {
    'ts-95': {
      id: 'ts-95',
      startId: 'tp-56',
      endId: 'tp-57',
      outControlId: 'tp-56:out',
      inControlId: 'tp-57:in'
    },
    'ts-96': {
      id: 'ts-96',
      startId: 'tp-57',
      endId: 'tp-58',
      outControlId: 'tp-57:out',
      inControlId: null
    },
    'ts-97': {
      id: 'ts-97',
      startId: 'tp-58',
      endId: 'tp-59',
      outControlId: null,
      inControlId: null
    },
    'ts-98': {
      id: 'ts-98',
      startId: 'tp-59',
      endId: 'tp-60',
      outControlId: 'tp-59:out',
      inControlId: 'tp-60:in'
    },
    'ts-99': {
      id: 'ts-99',
      startId: 'tp-60',
      endId: 'tp-56',
      outControlId: 'tp-60:out',
      inControlId: null
    }
  } satisfies Record<string, VectorSegment>,
  networks: {
    'tn-14': {
      id: 'tn-14',
      pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
      segmentIds: ['ts-95', 'ts-96', 'ts-97', 'ts-98', 'ts-99'],
      closed: true
    }
  } satisfies Record<string, VectorNetwork>
})

const measureScenario = (
  label: string,
  getStroke: (frame: number) => ReturnType<typeof createDefaultStroke>
) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  const baseData = {
    id: `measure:${label}`,
    x: 2395.5238285133596,
    y: 1832.0182325853355,
    width: 423.6353107755326,
    height: 458.34939129152076,
    ...toReportedClosedStarVectorData(),
    closed: true,
    fills: []
  }
  const frameTimes: number[] = []
  let invalidFrameCount = 0

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const start = performance.now()
    ;(
      strategy as unknown as (
        target: RecordingVectorGraphic,
        data: Record<string, unknown>
      ) => void
    )(graphic, {
      ...baseData,
      strokes: [getStroke(frame)]
    })
    const end = performance.now()
    if (frame >= WARMUP_FRAMES) {
      frameTimes.push(end - start)
    }
    if ((graphic.__asyraSolidCenterStrokeExportPackets?.length ?? 0) === 0) {
      invalidFrameCount += 1
    }
  }

  return {
    label,
    measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
    rendererCoverage: RENDERER_COVERAGE,
    doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
    averageMs:
      frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length,
    p95Ms: getPercentile(frameTimes, 0.95),
    maxMs: Math.max(...frameTimes),
    invalidFrameCount
  }
}

const addPhaseTime = (
  phaseTimes: Record<string, number>,
  phaseName: string,
  run: () => void
) => {
  const start = performance.now()
  run()
  phaseTimes[phaseName] =
    (phaseTimes[phaseName] ?? 0) + performance.now() - start
}

const measureInsideDashedPhaseBreakdown = () => {
  const baseData = toReportedClosedStarVectorData()
  const network = baseData.networks['tn-14']
  const phaseTimes: Record<string, number> = {}
  let measuredFrameCount = 0
  let packetCount = 0
  let faceCount = 0
  let renderEntryCount = 0
  let polygonCount = 0
  let polygonPointCount = 0

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const shouldMeasure = frame >= WARMUP_FRAMES
    const phaseTarget = shouldMeasure ? phaseTimes : {}
    const stroke = createDefaultStroke({
      id: 'pp-312',
      width: 10,
      style: StrokeStyles.DASHED,
      position: StrokePositions.INSIDE,
      dashPattern: [20, 20],
      dashOffset: frame * 2,
      color: '#d51a1a'
    })
    let path: ReturnType<typeof buildVectorGeometryModelPath> | null = null
    let topology: ReturnType<typeof buildPathTopologyModel> | null = null
    let packets: ReturnType<
      typeof buildConstrainedDashedStrokeResolvedPackets
    > = []
    let acceptedPackets: typeof packets = []
    let faces: ReturnType<typeof buildSolidCenterStrokeFinalFaces> = []
    let renderEntries: ReturnType<
      typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
    > = []
    const graphic = new RecordingVectorGraphic()

    addPhaseTime(phaseTarget, 'path sampling', () => {
      path = buildVectorGeometryModelPath(
        network,
        baseData.points,
        baseData.segments
      )
    })
    addPhaseTime(phaseTarget, 'topology classification', () => {
      topology = buildPathTopologyModel({
        pathId: 'profile:reported-star:tn-14',
        sourceId: 'profile:reported-star',
        networkId: 'tn-14',
        sourceFamily: 'vector',
        points: path?.sampledPoints ?? [],
        closed: path?.closed ?? true
      })
    })
    addPhaseTime(phaseTarget, 'constrained dashed packets', () => {
      packets = buildConstrainedDashedStrokeResolvedPackets(
        'profile:reported-star:tn-14:constrained-dashed',
        topology?.normalizedPoints ?? [],
        topology?.closed ?? true,
        [stroke],
        {
          metadata: {
            ownerKeyPrefix: 'profile:reported-star:tn-14',
            networkId: 'tn-14'
          },
          topology: topology ?? undefined,
          sourcePath: path?.segments.some((segment) => segment.type === 'cubic')
            ? path
            : undefined
        }
      )
    })
    addPhaseTime(phaseTarget, 'runtime metadata attach', () => {
      acceptedPackets = attachStrokePacketDebugMeta(packets, {
        runtimeStatus: 'accepted',
        runtimeReason: 'single-owner',
        sourceTopology: topology?.topologyFamily,
        ownershipStatus: 'accepted',
        ownerCount: 1
      })
    })
    addPhaseTime(phaseTarget, 'final faces', () => {
      faces = buildSolidCenterStrokeFinalFaces(acceptedPackets)
    })
    addPhaseTime(phaseTarget, 'hit area', () => {
      createSolidCenterStrokeHitAreaFromFinalFaces(faces)
    })
    addPhaseTime(phaseTarget, 'render entries', () => {
      renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(faces, {
        collapseDashedCenterVisualOverlaps: true
      })
    })
    addPhaseTime(phaseTarget, 'mesh render', () => {
      renderSolidCenterStrokeEntries(graphic, renderEntries)
    })

    if (shouldMeasure) {
      measuredFrameCount += 1
      packetCount += packets.length
      faceCount += faces.length
      renderEntryCount += renderEntries.length
      polygonCount += packets.reduce(
        (total, packet) => total + packet.geometry.polygons.length,
        0
      )
      polygonPointCount += packets.reduce(
        (total, packet) =>
          total +
          packet.geometry.polygons.reduce(
            (polygonTotal, polygon) => polygonTotal + polygon.length,
            0
          ),
        0
      )
    }
  }

  return {
    measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
    rendererCoverage: RENDERER_COVERAGE,
    doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
    frames: measuredFrameCount,
    packetCount,
    faceCount,
    renderEntryCount,
    averagePacketsPerFrame: packetCount / measuredFrameCount,
    averagePolygonsPerFrame: polygonCount / measuredFrameCount,
    averagePolygonPointsPerFrame: polygonPointCount / measuredFrameCount,
    averagePointsPerPolygon: polygonPointCount / polygonCount,
    phases: Object.fromEntries(
      Object.entries(phaseTimes).map(([phaseName, totalMs]) => [
        phaseName,
        {
          totalMs,
          averageMs: totalMs / measuredFrameCount
        }
      ])
    )
  }
}

describeProfile('stroke parameter switch performance profile', () => {
  it('should profile: measure reported closed star vector render strategy parameter CPU updates', () => {
    const metrics = [
      measureScenario('inside dashed dashOffset slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: frame * 2,
          color: '#d51a1a'
        })
      ),
      measureScenario('inside dashed width slider', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 6 + (frame % 20),
          style: StrokeStyles.DASHED,
          position: StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: '#d51a1a'
        })
      ),
      measureScenario('center to inside position toggle', (frame) =>
        createDefaultStroke({
          id: 'pp-312',
          width: 10,
          style: StrokeStyles.DASHED,
          position:
            frame % 2 === 0 ? StrokePositions.CENTER : StrokePositions.INSIDE,
          dashPattern: [20, 20],
          dashOffset: 0,
          color: '#d51a1a'
        })
      )
    ]

    process.stdout.write(
      `STAR_PARAM_SWITCH_METRICS ${JSON.stringify({
        measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
        rendererCoverage: RENDERER_COVERAGE,
        doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
        metrics
      })}\n`
    )
    expect(metrics.every((metric) => metric.invalidFrameCount === 0)).toBe(true)
  })

  it('should profile: break down reported closed star constrained dashed phases', () => {
    const breakdown = measureInsideDashedPhaseBreakdown()
    process.stdout.write(
      `STAR_CONSTRAINED_DASHED_PHASES ${JSON.stringify({
        measurementScope: PERFORMANCE_MEASUREMENT_SCOPE,
        rendererCoverage: RENDERER_COVERAGE,
        doesNotMeasureRenderer: DOES_NOT_MEASURE_RENDERER,
        breakdown
      })}\n`
    )
    expect(breakdown.packetCount).toBeGreaterThan(0)
    expect(breakdown.averagePolygonPointsPerFrame).toBeLessThanOrEqual(2000)
    expect(
      breakdown.phases['constrained dashed packets'].averageMs
    ).toBeLessThan(16.7)
  })
})
