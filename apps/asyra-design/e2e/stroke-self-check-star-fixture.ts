import { test, type Page } from '@playwright/test'
import path from 'node:path'
import { resetCanvas, waitForAppReady } from './test-utils'

export { resetCanvas, waitForAppReady } from './test-utils'

export const REPO_ROOT = path.resolve(process.cwd(), '../..')
export const ARTIFACT_DIR =
  process.env.ASYRA_STROKE_FINAL_ARTIFACT_DIR ??
  path.join(
    REPO_ROOT,
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts'
  )
export const SCREENSHOT_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill.png'
)
export const METADATA_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill.json'
)
export const ANALYSIS_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-fill-analysis.json'
)
export const NO_FILL_SCREENSHOT_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill.png'
)
export const NO_FILL_METADATA_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill.json'
)
export const NO_FILL_ANALYSIS_PATH = path.join(
  ARTIFACT_DIR,
  'self-check-inside-dashed-round-no-fill-analysis.json'
)

export type SelfCheckCapType = 'butt' | 'square' | 'round'
export type SelfCheckJoinType = 'miter' | 'bevel' | 'round'
export type SelfCheckStrokePosition = 'inside' | 'outside'
export type SelfCheckStrokeStyle = 'solid' | 'dashed'

export const INSIDE_SOLID_LOCAL_REVIEW_ZOOM = 20

export const getSelfCheckArtifactPaths = (
  capType: SelfCheckCapType,
  variant: 'fill' | 'no-fill',
  position: SelfCheckStrokePosition = 'inside',
  style: SelfCheckStrokeStyle = 'dashed'
) => ({
  screenshot: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-${style}-${capType}-${variant}.png`
  ),
  metadata: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-${style}-${capType}-${variant}.json`
  ),
  analysis: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-${style}-${capType}-${variant}-analysis.json`
  )
})

export const getSelfCheckSolidJoinArtifactPaths = (
  position: SelfCheckStrokePosition,
  joinType: SelfCheckJoinType
) => ({
  screenshot: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-solid-${joinType}-join-fill.png`
  ),
  metadata: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-solid-${joinType}-join-fill.json`
  ),
  analysis: path.join(
    ARTIFACT_DIR,
    `self-check-${position}-solid-${joinType}-join-fill-analysis.json`
  )
})

export interface Vec2 {
  x: number
  y: number
}

export const lerpPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

export const cubicPoint = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
) => {
  const ab = lerpPoint(p0, p1, t)
  const bc = lerpPoint(p1, p2, t)
  const cd = lerpPoint(p2, p3, t)
  const abc = lerpPoint(ab, bc, t)
  const bcd = lerpPoint(bc, cd, t)
  return lerpPoint(abc, bcd, t)
}

export const SELF_CHECK_SOURCE_POINTS: Record<string, Vec2> = {
  'tp-12': { x: 188.1928217922337, y: 0 },
  'tp-13': { x: 11.358174406717296, y: 365.76797704068724 },
  'tp-12:out': { x: 164.3673966581619, y: 140.91988215887423 },
  'tp-13:in': { x: -42.09205809548172, y: 344.92238636482955 },
  'tp-13:out': { x: 78.17096503446606, y: 391.8249653855095 },
  'tp-14': { x: 360.12094148356584, y: 145.95389587539378 },
  'tp-15': { x: 0, y: 15.668954151283657 },
  'tp-16': { x: 270.59180204238254, y: 347.0603956649177 },
  'tp-15:out': { x: 0, y: 15.668954151283657 },
  'tp-16:in': { x: 263.9105229796075, y: 364.43172122813246 },
  'tp-16:out': { x: 277.27308110515736, y: 329.6890701017029 }
}

export const SELF_CHECK_VECTOR_RECT = {
  x: 177.70582329255865,
  y: 121.88648201811688,
  width: 360.12094148356584,
  height: 367.70186652155667
} as const

export const SELF_CHECK_SOURCE_SEGMENTS = [
  {
    startId: 'tp-12',
    endId: 'tp-13',
    outControlId: 'tp-12:out',
    inControlId: 'tp-13:in'
  },
  {
    startId: 'tp-13',
    endId: 'tp-14',
    outControlId: 'tp-13:out',
    inControlId: null
  },
  {
    startId: 'tp-14',
    endId: 'tp-15',
    outControlId: null,
    inControlId: null
  },
  {
    startId: 'tp-15',
    endId: 'tp-16',
    outControlId: 'tp-15:out',
    inControlId: 'tp-16:in'
  },
  {
    startId: 'tp-16',
    endId: 'tp-12',
    outControlId: 'tp-16:out',
    inControlId: null
  }
] as const

export const getSelfCheckSegmentSamplePoint = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number],
  t: number
) => {
  const start = SELF_CHECK_SOURCE_POINTS[segment.startId]
  const end = SELF_CHECK_SOURCE_POINTS[segment.endId]
  const outControl = segment.outControlId
    ? SELF_CHECK_SOURCE_POINTS[segment.outControlId]
    : null
  const inControl = segment.inControlId
    ? SELF_CHECK_SOURCE_POINTS[segment.inControlId]
    : null

  return outControl && inControl
    ? cubicPoint(start, outControl, inControl, end, t)
    : lerpPoint(start, end, t)
}

export const SELF_CHECK_SOURCE_SAMPLE_POINTS =
  SELF_CHECK_SOURCE_SEGMENTS.flatMap((segment) => {
    const samples: Vec2[] = []

    for (let index = 0; index <= 24; index += 1) {
      const t = index / 24
      samples.push(getSelfCheckSegmentSamplePoint(segment, t))
    }

    return samples
  })

export const SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_INDEX = 3
export const SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_T = 0.676

export const INSIDE_SOLID_SOURCE_SEGMENT_ADHERENCE_PROBES = [
  {
    id: 'inside-solid-right-bottom-source-segment-adherence',
    // This is source-segment contact, not a filled-filled shared-edge width probe.
    requiresBothSides: false,
    focus: getSelfCheckSegmentSamplePoint(
      SELF_CHECK_SOURCE_SEGMENTS[
        SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_INDEX
      ],
      SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_T
    ),
    samplePoints: [-0.02, -0.01, 0, 0.01, 0.02].map((delta) =>
      getSelfCheckSegmentSamplePoint(
        SELF_CHECK_SOURCE_SEGMENTS[
          SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_INDEX
        ],
        SELF_CHECK_INTERNAL_PENTAGON_RIGHT_BOTTOM_LAST_SEGMENT_T + delta
      )
    )
  }
] as const

export const INSIDE_SOLID_FILL_PRESERVATION_ZONES = [
  {
    id: 'right-large-face',
    bounds: { minX: 270, minY: 150, maxX: 350, maxY: 250 },
    focus: { x: 316, y: 198 }
  },
  {
    id: 'right-bottom-thin-face',
    bounds: { minX: 235, minY: 260, maxX: 310, maxY: 345 },
    focus: { x: 270, y: 300 }
  },
  {
    id: 'central-face',
    bounds: { minX: 220, minY: 180, maxX: 258, maxY: 245 },
    focus: { x: 225, y: 214 }
  },
  {
    id: 'top-face',
    bounds: { minX: 165, minY: 45, maxX: 225, maxY: 125 },
    focus: { x: 190, y: 105 }
  },
  {
    id: 'left-face',
    bounds: { minX: 55, minY: 75, maxX: 155, maxY: 190 },
    focus: { x: 106, y: 132 }
  }
] as const

export const SELF_CHECK_SOURCE_ANCHOR_POINTS = SELF_CHECK_SOURCE_SEGMENTS.map(
  (segment) => SELF_CHECK_SOURCE_POINTS[segment.startId]
)

export const getSelfCheckSegmentPoint = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number],
  key: 'startId' | 'endId' | 'outControlId' | 'inControlId'
) => {
  const pointId = segment[key]
  return pointId ? SELF_CHECK_SOURCE_POINTS[pointId] : undefined
}

export const getSelfCheckSegmentStartTangent = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number]
) => {
  const start = getSelfCheckSegmentPoint(segment, 'startId') as Vec2
  const end = getSelfCheckSegmentPoint(segment, 'endId') as Vec2
  const control = getSelfCheckSegmentPoint(segment, 'outControlId') ?? end
  const tangent = { x: control.x - start.x, y: control.y - start.y }
  return Math.hypot(tangent.x, tangent.y) > 1e-6
    ? tangent
    : { x: end.x - start.x, y: end.y - start.y }
}

export const getSelfCheckSegmentEndTangent = (
  segment: (typeof SELF_CHECK_SOURCE_SEGMENTS)[number]
) => {
  const start = getSelfCheckSegmentPoint(segment, 'startId') as Vec2
  const end = getSelfCheckSegmentPoint(segment, 'endId') as Vec2
  const control = getSelfCheckSegmentPoint(segment, 'inControlId') ?? start
  const tangent = { x: end.x - control.x, y: end.y - control.y }
  return Math.hypot(tangent.x, tangent.y) > 1e-6
    ? tangent
    : { x: end.x - start.x, y: end.y - start.y }
}

export const SELF_CHECK_SMOOTH_CONTINUITY_ANCHOR_POINTS =
  SELF_CHECK_SOURCE_SEGMENTS.flatMap((segment, segmentIndex) => {
    const nextSegment =
      SELF_CHECK_SOURCE_SEGMENTS[
        (segmentIndex + 1) % SELF_CHECK_SOURCE_SEGMENTS.length
      ]
    if (segment.endId !== nextSegment.startId) {
      return []
    }
    const previousTangent = getSelfCheckSegmentEndTangent(segment)
    const nextTangent = getSelfCheckSegmentStartTangent(nextSegment)
    const previousLength = Math.hypot(previousTangent.x, previousTangent.y)
    const nextLength = Math.hypot(nextTangent.x, nextTangent.y)
    if (previousLength <= 1e-6 || nextLength <= 1e-6) {
      return []
    }
    const cross =
      previousTangent.x * nextTangent.y - previousTangent.y * nextTangent.x
    const dot =
      previousTangent.x * nextTangent.x + previousTangent.y * nextTangent.y
    const normalizedCross = Math.abs(cross) / (previousLength * nextLength)
    return normalizedCross <= 1e-3 && dot > 0
      ? [SELF_CHECK_SOURCE_POINTS[segment.endId]]
      : []
  })

export const SELF_CHECK_SOURCE_PATH: Vec2[] =
  SELF_CHECK_SOURCE_SEGMENTS.flatMap((segment, segmentIndex) => {
    const start = SELF_CHECK_SOURCE_POINTS[segment.startId]
    const end = SELF_CHECK_SOURCE_POINTS[segment.endId]
    const outControl = segment.outControlId
      ? SELF_CHECK_SOURCE_POINTS[segment.outControlId]
      : undefined
    const inControl = segment.inControlId
      ? SELF_CHECK_SOURCE_POINTS[segment.inControlId]
      : undefined
    const sampled =
      outControl || inControl
        ? Array.from({ length: 513 }, (_, index) =>
            cubicPoint(
              start,
              outControl ?? start,
              inControl ?? end,
              end,
              index / 512
            )
          )
        : [start, end]
    return segmentIndex === 0 ? sampled : sampled.slice(1)
  })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
  })
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.evaluate(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
  })
  await page.setViewportSize({ width: 1400, height: 1100 })
})

export const createSelfCheckStar = async (
  page: Page,
  options: {
    includeStroke?: boolean
    includeFill?: boolean
    capType?: SelfCheckCapType
    joinType?: SelfCheckJoinType
    position?: SelfCheckStrokePosition
    style?: SelfCheckStrokeStyle
    diagnosticsMode?: 'full' | 'off'
  } = {}
) => {
  const diagnosticsMode = options.diagnosticsMode ?? 'full'

  const hasAppApis = await page
    .evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      return Boolean(core && elementApis)
    })
    .catch(() => false)

  if (!hasAppApis) {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
    await page.setViewportSize({ width: 1400, height: 1100 })
  }

  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      return Boolean(core && elementApis)
    },
    undefined,
    { timeout: 10_000 }
  )

  await page.evaluate((mode) => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full' | 'off'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = mode
  }, diagnosticsMode)
  await page.setViewportSize({ width: 1400, height: 1100 })

  await page.evaluate(
    ({
      capType,
      includeFill,
      includeStroke,
      joinType,
      position,
      rect,
      style
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis

      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const points = {
        'tp-12': {
          id: 'tp-12',
          kind: 'anchor',
          x: 188.1928217922337,
          y: 0,
          anchorType: 'smooth'
        },
        'tp-13': {
          id: 'tp-13',
          kind: 'anchor',
          x: 11.358174406717296,
          y: 365.76797704068724,
          anchorType: 'smooth'
        },
        'tp-12:out': {
          id: 'tp-12:out',
          kind: 'control',
          x: 164.3673966581619,
          y: 140.91988215887423,
          controlForId: 'tp-12',
          controlRole: 'out'
        },
        'tp-13:in': {
          id: 'tp-13:in',
          kind: 'control',
          x: -42.09205809548172,
          y: 344.92238636482955,
          controlForId: 'tp-13',
          controlRole: 'in'
        },
        'tp-13:out': {
          id: 'tp-13:out',
          kind: 'control',
          x: 78.17096503446606,
          y: 391.8249653855095,
          controlForId: 'tp-13',
          controlRole: 'out'
        },
        'tp-14': {
          id: 'tp-14',
          kind: 'anchor',
          x: 360.12094148356584,
          y: 145.95389587539378,
          anchorType: 'sharp'
        },
        'tp-15': {
          id: 'tp-15',
          kind: 'anchor',
          x: 0,
          y: 15.668954151283657,
          anchorType: 'sharp'
        },
        'tp-16': {
          id: 'tp-16',
          kind: 'anchor',
          x: 270.59180204238254,
          y: 347.0603956649177,
          anchorType: 'smooth'
        },
        'tp-15:out': {
          id: 'tp-15:out',
          kind: 'control',
          x: 0,
          y: 15.668954151283657,
          controlForId: 'tp-15',
          controlRole: 'out'
        },
        'tp-16:in': {
          id: 'tp-16:in',
          kind: 'control',
          x: 263.9105229796075,
          y: 364.43172122813246,
          controlForId: 'tp-16',
          controlRole: 'in'
        },
        'tp-16:out': {
          id: 'tp-16:out',
          kind: 'control',
          x: 277.27308110515736,
          y: 329.6890701017029,
          controlForId: 'tp-16',
          controlRole: 'out'
        }
      }
      const segments = {
        'ts-23': {
          id: 'ts-23',
          startId: 'tp-12',
          endId: 'tp-13',
          outControlId: 'tp-12:out',
          inControlId: 'tp-13:in'
        },
        'ts-24': {
          id: 'ts-24',
          startId: 'tp-13',
          endId: 'tp-14',
          outControlId: 'tp-13:out',
          inControlId: null
        },
        'ts-25': {
          id: 'ts-25',
          startId: 'tp-14',
          endId: 'tp-15',
          outControlId: null,
          inControlId: null
        },
        'ts-26': {
          id: 'ts-26',
          startId: 'tp-15',
          endId: 'tp-16',
          outControlId: 'tp-15:out',
          inControlId: 'tp-16:in'
        },
        'ts-27': {
          id: 'ts-27',
          startId: 'tp-16',
          endId: 'tp-12',
          outControlId: 'tp-16:out',
          inControlId: null
        }
      }
      const networks = {
        'tn-4': {
          id: 'tn-4',
          pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
          segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
          closed: true
        }
      }
      const createdId = elementApis.createElement(
        { type: 'vector', points, segments, networks, closed: true },
        { undoable: false }
      )

      if (!createdId) {
        throw new Error('Failed to create stroke self-check star')
      }

      elementApis.changeComputedData(
        [createdId],
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          points,
          segments,
          networks,
          closed: true,
          fills:
            includeFill === false
              ? []
              : [
                  {
                    id: 'self-check-fill',
                    kind: 'solid',
                    fillType: 'color',
                    color: '#d5d5d5',
                    opacity: 1,
                    visible: true
                  }
                ],
          strokes:
            includeStroke === false
              ? []
              : [
                  {
                    id: `self-check-${position}-${style}-${capType}-${joinType}`,
                    kind: 'solid',
                    style,
                    position,
                    width: 10,
                    dashPattern: style === 'dashed' ? [27, 20] : [],
                    dashOffset: 0,
                    fill: null,
                    defaultColorFormat: 'hex',
                    colorFormat: 'hex',
                    color: '#df0606',
                    opacity: 0.5,
                    visible: true,
                    gradient: null,
                    joinType,
                    capType,
                    miterAngle: 28.96
                  }
                ]
        },
        { undoable: false }
      )

      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorId = createdId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorRect = { ...rect }
      core.setSystemProperty('zoom', 1.55)
      core.setSystemProperty('viewportPosition', { x: 145, y: 75 })
      core.setSystemProperty('pathEditingVectorId', createdId)
      core.setSystemProperty('pathEditingMode', true)
      core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', false)
    },
    {
      capType: options.capType ?? 'round',
      includeFill: options.includeFill,
      includeStroke: options.includeStroke,
      joinType: options.joinType ?? 'miter',
      position: options.position ?? 'inside',
      rect: SELF_CHECK_VECTOR_RECT,
      style: options.style ?? 'dashed'
    }
  )
}

export const saveCurrentFileToLocalStorage = async (page: Page) => {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    localStorage.setItem('FILE', JSON.stringify(await core.save()))
  })
}

export const installVectorRenderPhaseProfiler = async (page: Page) => {
  const installProfiler = () => {
    const target = window as typeof window & {
      __asyraVectorRenderPhaseSamples?: {
        phaseName: string
        durationMs: number
      }[]
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
    target.__asyraVectorRenderPhaseSamples = []
    target.__asyraVectorRenderPhaseSink = (phaseName, durationMs) => {
      target.__asyraVectorRenderPhaseSamples?.push({
        phaseName,
        durationMs
      })
    }
  }

  await page.addInitScript(installProfiler)
  await page.evaluate(installProfiler)
}

export const getVectorRenderPhaseSamples = async (page: Page) =>
  page.evaluate(() => {
    const target = window as typeof window & {
      __asyraVectorRenderPhaseSamples?: {
        phaseName: string
        durationMs: number
      }[]
    }
    return target.__asyraVectorRenderPhaseSamples ?? []
  })

export const getSelfCheckMetadata = async (page: Page) =>
  page.evaluate((selfCheckRect) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    let selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__selfCheckVectorId ??
      null
    if (!selectedId) {
      const elements = core?.deps?.sceneTree?.getAllElements?.()
      elements?.forEach?.(
        (
          candidate: { get?: (key: string) => unknown } | undefined,
          id: string
        ) => {
          if (!selectedId && candidate?.get?.('type') === 'vector') {
            selectedId = id
          }
        }
      )
    }
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.() ?? null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    const meshCache = renderElement?.__asyraStrokeMeshCache ?? null
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const getStringArray = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : []
    const getPolygons = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (polygon): polygon is { x: number; y: number }[] =>
              Array.isArray(polygon) &&
              polygon.every(
                (point) =>
                  point &&
                  typeof point === 'object' &&
                  typeof (point as { x?: unknown }).x === 'number' &&
                  typeof (point as { y?: unknown }).y === 'number'
              )
          )
        : []
    const getPoints = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (point): point is { x: number; y: number } =>
              point &&
              typeof point === 'object' &&
              typeof (point as { x?: unknown }).x === 'number' &&
              typeof (point as { y?: unknown }).y === 'number'
          )
        : []
    const boundaryDomainPackets = exportPackets.map(
      (packet: {
        bounds?: unknown
        debugMeta?: {
          intervalId?: unknown
          startDistance?: unknown
          endDistance?: unknown
          geometryFamily?: unknown
          resolutionStatus?: unknown
          runtimeStatus?: unknown
          sourceTopology?: unknown
          finalCoverageBuilderStatus?: unknown
          visualOverlapCollapseStatus?: unknown
          strokePosition?: unknown
          strokeWidth?: unknown
          solidMaskModelMaskApplication?: unknown
          solidMaskModelVisibleRender?: unknown
          solidMaskModelCoverageOracle?: unknown
          solidMaskModelMaskSide?: unknown
          solidMaskModelInsideMaskMode?: unknown
          solidMaskModelRejectedMaskMode?: unknown
          solidMaskModelVisibleMaskMode?: unknown
          solidMaskModelJoinGeometrySource?: unknown
          solidMaskModelRejectedVisibleMaskMode?: unknown
          solidMaskModelInternalCornerJoinMode?: unknown
          solidMaskModelJoinEligibilityMode?: unknown
          solidMaskModelRejectedInternalCornerJoinMode?: unknown
          solidMaskModelAdjacencyProbe?: unknown
          solidMaskModelFaceOwnershipTrace?: unknown
          figmaLikeSplitRangeId?: unknown
          figmaLikeSplitRangeStartDistance?: unknown
          figmaLikeSplitRangeEndDistance?: unknown
          figmaLikeSplitRangeSourceSegmentIndex?: unknown
          figmaLikeTerminalRole?: unknown
          figmaLikeSelectedSide?: unknown
          figmaLikeFilledSide?: unknown
          figmaLikeUnfilledSide?: unknown
          figmaLikeBoundaryRole?: unknown
          figmaLikeBoundaryPoints?: unknown
          figmaLikeBoundaryStartDistance?: unknown
          figmaLikeBoundaryEndDistance?: unknown
          figmaLikeBoundaryTotalLength?: unknown
          figmaLikeSplitRangeTerminals?: unknown
        }
        geometryId?: unknown
        intervalIds?: unknown
        polygons?: unknown
      }) => {
        const intervalIds = getStringArray(packet.intervalIds)
        const polygons = getPolygons(packet.polygons)
        return {
          geometryId:
            typeof packet.geometryId === 'string' ? packet.geometryId : null,
          intervalIds,
          debugIntervalId:
            typeof packet.debugMeta?.intervalId === 'string'
              ? packet.debugMeta.intervalId
              : null,
          startDistance:
            typeof packet.debugMeta?.startDistance === 'number'
              ? packet.debugMeta.startDistance
              : null,
          endDistance:
            typeof packet.debugMeta?.endDistance === 'number'
              ? packet.debugMeta.endDistance
              : null,
          geometryFamily:
            typeof packet.debugMeta?.geometryFamily === 'string'
              ? packet.debugMeta.geometryFamily
              : null,
          resolutionStatus:
            typeof packet.debugMeta?.resolutionStatus === 'string'
              ? packet.debugMeta.resolutionStatus
              : null,
          runtimeStatus:
            typeof packet.debugMeta?.runtimeStatus === 'string'
              ? packet.debugMeta.runtimeStatus
              : null,
          sourceTopology: packet.debugMeta?.sourceTopology ?? null,
          finalCoverageBuilderStatus:
            packet.debugMeta?.finalCoverageBuilderStatus ?? null,
          visualOverlapCollapseStatus:
            packet.debugMeta?.visualOverlapCollapseStatus ?? null,
          strokePosition:
            packet.debugMeta?.strokePosition === 'inside' ||
            packet.debugMeta?.strokePosition === 'outside' ||
            packet.debugMeta?.strokePosition === 'center'
              ? packet.debugMeta.strokePosition
              : null,
          strokeWidth:
            typeof packet.debugMeta?.strokeWidth === 'number'
              ? packet.debugMeta.strokeWidth
              : null,
          solidMaskModelMaskApplication:
            packet.debugMeta?.solidMaskModelMaskApplication ===
              'render-fill-mask' ||
            packet.debugMeta?.solidMaskModelMaskApplication === 'exact-boolean'
              ? packet.debugMeta.solidMaskModelMaskApplication
              : null,
          solidMaskModelVisibleRender:
            packet.debugMeta?.solidMaskModelVisibleRender ===
            'masked-source-stroke'
              ? packet.debugMeta.solidMaskModelVisibleRender
              : null,
          solidMaskModelCoverageOracle:
            packet.debugMeta?.solidMaskModelCoverageOracle ===
              'exact-boolean' ||
            packet.debugMeta?.solidMaskModelCoverageOracle === 'render-mask'
              ? packet.debugMeta.solidMaskModelCoverageOracle
              : null,
          solidMaskModelMaskSide:
            packet.debugMeta?.solidMaskModelMaskSide === 'inside-fill' ||
            packet.debugMeta?.solidMaskModelMaskSide === 'outside-exterior'
              ? packet.debugMeta.solidMaskModelMaskSide
              : null,
          solidMaskModelInsideMaskMode:
            packet.debugMeta?.solidMaskModelInsideMaskMode ===
            'face-occupancy-inside-fill'
              ? packet.debugMeta.solidMaskModelInsideMaskMode
              : null,
          solidMaskModelRejectedMaskMode:
            packet.debugMeta?.solidMaskModelRejectedMaskMode ===
            'binary-filled-region-union'
              ? packet.debugMeta.solidMaskModelRejectedMaskMode
              : null,
          solidMaskModelVisibleMaskMode:
            packet.debugMeta?.solidMaskModelVisibleMaskMode ===
            'inside-fill-source-stroke-clip'
              ? packet.debugMeta.solidMaskModelVisibleMaskMode
              : null,
          solidMaskModelJoinGeometrySource:
            packet.debugMeta?.solidMaskModelJoinGeometrySource ===
            'authored-doubled-source-stroke'
              ? packet.debugMeta.solidMaskModelJoinGeometrySource
              : null,
          solidMaskModelRejectedVisibleMaskMode:
            packet.debugMeta?.solidMaskModelRejectedVisibleMaskMode ===
              'binary-union-minus-shared-edge-reject' ||
            packet.debugMeta?.solidMaskModelRejectedVisibleMaskMode ===
              'boundary-strip-connector-approximation'
              ? packet.debugMeta.solidMaskModelRejectedVisibleMaskMode
              : null,
          solidMaskModelInternalCornerJoinMode:
            packet.debugMeta?.solidMaskModelInternalCornerJoinMode ===
            'stroke-join-aware-face-corner'
              ? packet.debugMeta.solidMaskModelInternalCornerJoinMode
              : null,
          solidMaskModelJoinEligibilityMode:
            packet.debugMeta?.solidMaskModelJoinEligibilityMode ===
            'internal-face-only'
              ? packet.debugMeta.solidMaskModelJoinEligibilityMode
              : null,
          solidMaskModelRejectedInternalCornerJoinMode:
            packet.debugMeta?.solidMaskModelRejectedInternalCornerJoinMode ===
              'fixed-round-node-mask' ||
            packet.debugMeta?.solidMaskModelRejectedInternalCornerJoinMode ===
              'fixed-endpoint-connector'
              ? packet.debugMeta.solidMaskModelRejectedInternalCornerJoinMode
              : null,
          solidMaskModelAdjacencyProbe: getStringArray(
            packet.debugMeta?.solidMaskModelAdjacencyProbe
          ),
          solidMaskModelFaceOwnershipTrace: Array.isArray(
            packet.debugMeta?.solidMaskModelFaceOwnershipTrace
          )
            ? packet.debugMeta.solidMaskModelFaceOwnershipTrace.flatMap(
                (entry) => {
                  if (!entry || typeof entry !== 'object') {
                    return []
                  }
                  const record = entry as Record<string, unknown>
                  const start = record.start as
                    | { x?: unknown; y?: unknown }
                    | undefined
                  const end = record.end as
                    | { x?: unknown; y?: unknown }
                    | undefined
                  return typeof record.faceId === 'string' &&
                    start &&
                    end &&
                    typeof start.x === 'number' &&
                    typeof start.y === 'number' &&
                    typeof end.x === 'number' &&
                    typeof end.y === 'number'
                    ? [
                        {
                          sourceSegmentIndex:
                            typeof record.sourceSegmentIndex === 'number'
                              ? record.sourceSegmentIndex
                              : null,
                          sourceStartDistance:
                            typeof record.sourceStartDistance === 'number'
                              ? record.sourceStartDistance
                              : null,
                          sourceEndDistance:
                            typeof record.sourceEndDistance === 'number'
                              ? record.sourceEndDistance
                              : null,
                          start: { x: start.x, y: start.y },
                          end: { x: end.x, y: end.y },
                          startNodeDegree:
                            typeof record.startNodeDegree === 'number'
                              ? record.startNodeDegree
                              : null,
                          endNodeDegree:
                            typeof record.endNodeDegree === 'number'
                              ? record.endNodeDegree
                              : null,
                          faceId: record.faceId,
                          oppositeFaceId:
                            typeof record.oppositeFaceId === 'string'
                              ? record.oppositeFaceId
                              : null,
                          adjacencySide:
                            record.adjacencySide === 'left' ||
                            record.adjacencySide === 'right'
                              ? record.adjacencySide
                              : null,
                          oppositeFaceLegal:
                            typeof record.oppositeFaceLegal === 'boolean'
                              ? record.oppositeFaceLegal
                              : null,
                          faceJoinEligibility:
                            record.faceJoinEligibility === 'join-reactive' ||
                            record.faceJoinEligibility === 'mask-only'
                              ? record.faceJoinEligibility
                              : null,
                          maskMode:
                            record.maskMode === 'face-occupancy-inside-fill'
                              ? record.maskMode
                              : null
                        }
                      ]
                    : []
                }
              )
            : [],
          figmaLikeSplitRangeId:
            typeof packet.debugMeta?.figmaLikeSplitRangeId === 'string'
              ? packet.debugMeta.figmaLikeSplitRangeId
              : null,
          figmaLikeSplitRangeStartDistance:
            typeof packet.debugMeta?.figmaLikeSplitRangeStartDistance ===
            'number'
              ? packet.debugMeta.figmaLikeSplitRangeStartDistance
              : null,
          figmaLikeSplitRangeEndDistance:
            typeof packet.debugMeta?.figmaLikeSplitRangeEndDistance === 'number'
              ? packet.debugMeta.figmaLikeSplitRangeEndDistance
              : null,
          figmaLikeSplitRangeSourceSegmentIndex:
            typeof packet.debugMeta?.figmaLikeSplitRangeSourceSegmentIndex ===
            'number'
              ? packet.debugMeta.figmaLikeSplitRangeSourceSegmentIndex
              : null,
          figmaLikeTerminalRole:
            typeof packet.debugMeta?.figmaLikeTerminalRole === 'string'
              ? packet.debugMeta.figmaLikeTerminalRole
              : null,
          figmaLikeSelectedSide:
            packet.debugMeta?.figmaLikeSelectedSide === 1 ||
            packet.debugMeta?.figmaLikeSelectedSide === -1
              ? packet.debugMeta.figmaLikeSelectedSide
              : null,
          figmaLikeFilledSide:
            packet.debugMeta?.figmaLikeFilledSide === 1 ||
            packet.debugMeta?.figmaLikeFilledSide === -1
              ? packet.debugMeta.figmaLikeFilledSide
              : null,
          figmaLikeUnfilledSide:
            packet.debugMeta?.figmaLikeUnfilledSide === 1 ||
            packet.debugMeta?.figmaLikeUnfilledSide === -1
              ? packet.debugMeta.figmaLikeUnfilledSide
              : null,
          figmaLikeBoundaryRole:
            packet.debugMeta?.figmaLikeBoundaryRole === 'outer' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'filled-face' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'hole' ||
            packet.debugMeta?.figmaLikeBoundaryRole === 'ambiguous'
              ? packet.debugMeta.figmaLikeBoundaryRole
              : null,
          figmaLikeBoundaryPoints: getPoints(
            packet.debugMeta?.figmaLikeBoundaryPoints
          ),
          figmaLikeBoundaryStartDistance:
            typeof packet.debugMeta?.figmaLikeBoundaryStartDistance === 'number'
              ? packet.debugMeta.figmaLikeBoundaryStartDistance
              : null,
          figmaLikeBoundaryEndDistance:
            typeof packet.debugMeta?.figmaLikeBoundaryEndDistance === 'number'
              ? packet.debugMeta.figmaLikeBoundaryEndDistance
              : null,
          figmaLikeBoundaryTotalLength:
            typeof packet.debugMeta?.figmaLikeBoundaryTotalLength === 'number'
              ? packet.debugMeta.figmaLikeBoundaryTotalLength
              : null,
          figmaLikeSplitRangeTerminals: Array.isArray(
            packet.debugMeta?.figmaLikeSplitRangeTerminals
          )
            ? packet.debugMeta.figmaLikeSplitRangeTerminals.flatMap((entry) => {
                if (!entry || typeof entry !== 'object') {
                  return []
                }
                const record = entry as Record<string, unknown>
                return typeof record.intervalId === 'string' &&
                  typeof record.splitRangeId === 'string' &&
                  typeof record.splitRangeStartDistance === 'number' &&
                  typeof record.splitRangeEndDistance === 'number' &&
                  typeof record.terminalRole === 'string' &&
                  typeof record.startDistance === 'number' &&
                  typeof record.endDistance === 'number'
                  ? [
                      {
                        intervalId: record.intervalId,
                        splitRangeId: record.splitRangeId,
                        splitRangeStartDistance: record.splitRangeStartDistance,
                        splitRangeEndDistance: record.splitRangeEndDistance,
                        terminalRole: record.terminalRole,
                        startDistance: record.startDistance,
                        endDistance: record.endDistance,
                        sourceSegmentIndex:
                          typeof record.sourceSegmentIndex === 'number'
                            ? record.sourceSegmentIndex
                            : typeof packet.debugMeta
                                  ?.figmaLikeSplitRangeSourceSegmentIndex ===
                                'number'
                              ? packet.debugMeta
                                  .figmaLikeSplitRangeSourceSegmentIndex
                              : null,
                        selectedSide:
                          record.selectedSide === 1 ||
                          record.selectedSide === -1
                            ? record.selectedSide
                            : null,
                        filledSide:
                          record.filledSide === 1 || record.filledSide === -1
                            ? record.filledSide
                            : null,
                        unfilledSide:
                          record.unfilledSide === 1 ||
                          record.unfilledSide === -1
                            ? record.unfilledSide
                            : null,
                        boundaryRole:
                          record.boundaryRole === 'outer' ||
                          record.boundaryRole === 'filled-face' ||
                          record.boundaryRole === 'hole' ||
                          record.boundaryRole === 'ambiguous'
                            ? record.boundaryRole
                            : null,
                        boundaryPoints:
                          getPoints(record.boundaryPoints).length > 0
                            ? getPoints(record.boundaryPoints)
                            : getPoints(
                                packet.debugMeta?.figmaLikeBoundaryPoints
                              ),
                        boundaryStartDistance:
                          typeof record.boundaryStartDistance === 'number'
                            ? record.boundaryStartDistance
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryStartDistance === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryStartDistance
                              : null,
                        boundaryEndDistance:
                          typeof record.boundaryEndDistance === 'number'
                            ? record.boundaryEndDistance
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryEndDistance === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryEndDistance
                              : null,
                        boundaryTotalLength:
                          typeof record.boundaryTotalLength === 'number'
                            ? record.boundaryTotalLength
                            : typeof packet.debugMeta
                                  ?.figmaLikeBoundaryTotalLength === 'number'
                              ? packet.debugMeta.figmaLikeBoundaryTotalLength
                              : null
                      }
                    ]
                  : []
              })
            : [],
          polygonCount: polygons.length,
          polygons,
          bounds: packet.bounds ?? null
        }
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackRect = (window as any).__selfCheckVectorRect
    const selectedRect = computed
      ? {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        }
      : fallbackRect &&
          typeof fallbackRect.x === 'number' &&
          typeof fallbackRect.y === 'number' &&
          typeof fallbackRect.width === 'number' &&
          typeof fallbackRect.height === 'number'
        ? {
            x: fallbackRect.x,
            y: fallbackRect.y,
            width: fallbackRect.width,
            height: fallbackRect.height
          }
        : { ...selfCheckRect }

    return {
      selectedId,
      hasComputedData: computed !== null,
      selectedRect,
      zoom,
      viewport,
      computedStrokes: computed?.strokes ?? [],
      exportPacketCount: exportPackets.length,
      boundaryDomainIntervalIds: Array.from(
        new Set(
          boundaryDomainPackets.flatMap((packet) => [
            ...packet.intervalIds,
            ...(packet.debugIntervalId ? [packet.debugIntervalId] : [])
          ])
        )
      ),
      boundaryDomainPackets,
      cacheKinds: meshCache ? Object.keys(meshCache) : [],
      screenshotPath:
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/artifacts/self-check-inside-dashed-round-fill.png'
    }
  }, SELF_CHECK_VECTOR_RECT)

export const getPolygonEdgeLengths = (polygon: { x: number; y: number }[]) =>
  polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return Math.hypot(point.x - next.x, point.y - next.y)
  })

export const getPointBounds = (points: { x: number; y: number }[]) => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y))
})

export const getBoundaryDomainPolygonQualityFailures = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  metadata.boundaryDomainPackets.flatMap((packet) =>
    packet.polygons.flatMap((polygon) => {
      if (polygon.length < 40) {
        return []
      }

      const edgeLengths = getPolygonEdgeLengths(polygon)
      const sortedEdgeLengths = [...edgeLengths].sort((a, b) => a - b)
      const fifthPercentileEdge =
        sortedEdgeLengths[Math.floor(sortedEdgeLengths.length * 0.05)] ??
        Infinity
      const microEdgeCount = edgeLengths.filter(
        (length) => length < 0.03
      ).length
      if (fifthPercentileEdge >= 0.03 && microEdgeCount < 5) {
        return []
      }

      return [
        {
          geometryId: packet.geometryId,
          intervalId: packet.debugIntervalId,
          splitRangeId: packet.figmaLikeSplitRangeId,
          terminalRole: packet.figmaLikeTerminalRole,
          vertexCount: polygon.length,
          microEdgeCount,
          fifthPercentileEdge: Math.round(fifthPercentileEdge * 1000) / 1000,
          shortestEdge:
            Math.round((sortedEdgeLengths[0] ?? Infinity) * 1000) / 1000
        }
      ]
    })
  )

export const getBoundaryDomainOversizedProductFailures = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  metadata.boundaryDomainPackets.flatMap((packet) =>
    packet.polygons.flatMap((polygon) => {
      const bounds = getPointBounds(polygon)
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      const maxDimension = Math.max(width, height)
      const maxAllowedDimension = 80
      return maxDimension > maxAllowedDimension
        ? [
            {
              geometryId: packet.geometryId,
              intervalId: packet.debugIntervalId,
              splitRangeId: packet.figmaLikeSplitRangeId,
              terminalRole: packet.figmaLikeTerminalRole,
              polygonCount: packet.polygonCount,
              maxAllowedDimension,
              bounds
            }
          ]
        : []
    })
  )

export const analyzeSelfCheckScreenshots = async (
  page: Page,
  baseline: Buffer,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ baselineDataUrl, actualDataUrl, metadata }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [baselineImage, actualImage] = await Promise.all([
        loadImage(baselineDataUrl),
        loadImage(actualDataUrl)
      ])
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for self-check analysis')
      }

      context.drawImage(baselineImage, 0, 0)
      const baselineData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const canvasBounds = {
        left: 240,
        top: 40,
        right: Math.min(width, 1160),
        bottom: Math.min(height, 1065)
      }
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const isInCanvas = (x: number, y: number) =>
        x >= canvasBounds.left &&
        x < canvasBounds.right &&
        y >= canvasBounds.top &&
        y < canvasBounds.bottom
      const isLegalFillPixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = baselineData[index]
        const g = baselineData[index + 1]
        const b = baselineData[index + 2]
        const a = baselineData[index + 3]
        return (
          a > 180 &&
          r > 145 &&
          g > 145 &&
          b > 145 &&
          Math.abs(r - g) < 45 &&
          Math.abs(g - b) < 45
        )
      }
      const isNearLegalFill = (x: number, y: number) => {
        for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            if (isLegalFillPixel(x + offsetX, y + offsetY)) {
              return true
            }
          }
        }
        return false
      }
      const isDeepLegalFill = (x: number, y: number) => {
        for (let offsetY = -6; offsetY <= 6; offsetY += 1) {
          for (let offsetX = -6; offsetX <= 6; offsetX += 1) {
            if (!isLegalFillPixel(x + offsetX, y + offsetY)) {
              return false
            }
          }
        }
        return true
      }
      const isRedStrokePixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 140 && r > 80 && r > g * 1.45 && r > b * 1.45
      }
      const isDarkOverdrawStrokePixel = (x: number, y: number) => {
        if (!isRedStrokePixel(x, y) || !isNearLegalFill(x, y)) {
          return false
        }
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        return r > 150 && g < 88 && b < 88
      }
      const outside = new Uint8Array(width * height)
      const strictInside = new Uint8Array(width * height)
      const strictOutside = new Uint8Array(width * height)
      const darkOverdraw = new Uint8Array(width * height)
      let redPixelCount = 0
      let legalRedPixelCount = 0
      let outsideRedPixelCount = 0
      let strictLegalRedPixelCount = 0
      let strictOutsideRedPixelCount = 0
      let darkOverdrawPixelCount = 0
      for (let y = canvasBounds.top; y < canvasBounds.bottom; y += 1) {
        for (let x = canvasBounds.left; x < canvasBounds.right; x += 1) {
          if (!isRedStrokePixel(x, y)) continue
          redPixelCount += 1
          if (isDeepLegalFill(x, y)) {
            strictInside[y * width + x] = 1
            strictLegalRedPixelCount += 1
          } else {
            strictOutside[y * width + x] = 1
            strictOutsideRedPixelCount += 1
          }
          if (isDarkOverdrawStrokePixel(x, y)) {
            darkOverdraw[y * width + x] = 1
            darkOverdrawPixelCount += 1
          }
          if (isNearLegalFill(x, y)) {
            legalRedPixelCount += 1
            continue
          }
          outside[y * width + x] = 1
          outsideRedPixelCount += 1
        }
      }

      const getComponents = (mask: Uint8Array) => {
        const visited = new Uint8Array(width * height)
        const components: {
          area: number
          minX: number
          minY: number
          maxX: number
          maxY: number
          centerX: number
          centerY: number
        }[] = []
        const queue: number[] = []
        for (let y = canvasBounds.top; y < canvasBounds.bottom; y += 1) {
          for (let x = canvasBounds.left; x < canvasBounds.right; x += 1) {
            const start = y * width + x
            if (mask[start] !== 1 || visited[start] === 1) continue
            visited[start] = 1
            queue.length = 0
            queue.push(start)
            let area = 0
            let minX = x
            let minY = y
            let maxX = x
            let maxY = y
            let sumX = 0
            let sumY = 0
            for (const current of queue) {
              area += 1
              const currentX = current % width
              const currentY = Math.floor(current / width)
              minX = Math.min(minX, currentX)
              minY = Math.min(minY, currentY)
              maxX = Math.max(maxX, currentX)
              maxY = Math.max(maxY, currentY)
              sumX += currentX
              sumY += currentY
              for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                  if (dx === 0 && dy === 0) continue
                  const nextX = currentX + dx
                  const nextY = currentY + dy
                  if (!isInCanvas(nextX, nextY)) continue
                  const next = nextY * width + nextX
                  if (mask[next] === 1 && visited[next] !== 1) {
                    visited[next] = 1
                    queue.push(next)
                  }
                }
              }
            }
            components.push({
              area,
              minX,
              minY,
              maxX,
              maxY,
              centerX: sumX / area,
              centerY: sumY / area
            })
          }
        }
        return components
      }
      const componentSummaries = getComponents(outside)
      const strictInsideComponents = getComponents(strictInside)
      const strictOutsideComponents = getComponents(strictOutside)
      const darkOverdrawComponents = getComponents(darkOverdraw)
      const componentAreas = componentSummaries.map(({ area }) => area)
      const strictInsideComponentAreas = strictInsideComponents.map(
        ({ area }) => area
      )
      const strictOutsideComponentAreas = strictOutsideComponents.map(
        ({ area }) => area
      )
      const darkOverdrawComponentAreas = darkOverdrawComponents.map(
        ({ area }) => area
      )
      const relevantComponents = (
        components: typeof strictInsideComponents,
        minArea = 4
      ) =>
        components
          .filter(({ area }) => area >= minArea)
          .sort((a, b) => b.area - a.area)
          .slice(0, 10)

      return {
        width,
        height,
        redPixelCount,
        legalRedPixelCount,
        outsideRedPixelCount,
        strictLegalRedPixelCount,
        strictOutsideRedPixelCount,
        darkOverdrawPixelCount,
        maxDarkOverdrawComponentArea: Math.max(
          0,
          ...darkOverdrawComponentAreas
        ),
        darkOverdrawComponentAreas: darkOverdrawComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        maxOutsideComponentArea: Math.max(0, ...componentAreas),
        outsideComponentAreas: componentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        maxStrictInsideComponentArea: Math.max(
          0,
          ...strictInsideComponentAreas
        ),
        maxStrictOutsideComponentArea: Math.max(
          0,
          ...strictOutsideComponentAreas
        ),
        strictInsideComponentAreas: strictInsideComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        strictInsideComponents: relevantComponents(strictInsideComponents),
        strictOutsideComponentAreas: strictOutsideComponentAreas
          .filter((area) => area >= 4)
          .sort((a, b) => b - a)
          .slice(0, 10),
        boundaryDomainPacketCount: metadata.boundaryDomainPackets.length
      }
    },
    {
      baselineDataUrl: `data:image/png;base64,${baseline.toString('base64')}`,
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata
    }
  )

export const analyzeInsideSolidFillPreservation = async (
  page: Page,
  baseline: Buffer,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({
      actualDataUrl,
      baselineDataUrl,
      metadata,
      sourceSamples,
      zones
    }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [baselineImage, actualImage] = await Promise.all([
        loadImage(baselineDataUrl),
        loadImage(actualDataUrl)
      ])
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for fill preservation')
      }

      context.drawImage(baselineImage, 0, 0)
      const baselineData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const canvasBounds = {
        left: 240,
        top: 40,
        right: Math.min(width, 1160),
        bottom: Math.min(height, 1065)
      }
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const isInCanvas = (x: number, y: number) =>
        x >= canvasBounds.left &&
        x < canvasBounds.right &&
        y >= canvasBounds.top &&
        y < canvasBounds.bottom
      const isLegalFillPixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = baselineData[index]
        const g = baselineData[index + 1]
        const b = baselineData[index + 2]
        const a = baselineData[index + 3]
        return (
          a > 180 &&
          r > 145 &&
          g > 145 &&
          b > 145 &&
          Math.abs(r - g) < 45 &&
          Math.abs(g - b) < 45
        )
      }
      const isRedStrokePixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 140 && r > 80 && r > g * 1.45 && r > b * 1.45
      }
      const toSourcePoint = (x: number, y: number) => ({
        x: (x - metadata.viewport.x) / metadata.zoom - metadata.selectedRect.x,
        y: (y - metadata.viewport.y) / metadata.zoom - metadata.selectedRect.y
      })
      const pointSegmentDistance = (
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
      ) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 1e-12) {
          return Math.hypot(point.x - start.x, point.y - start.y)
        }
        const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared
          )
        )
        return Math.hypot(
          point.x - (start.x + dx * t),
          point.y - (start.y + dy * t)
        )
      }
      const distanceToSourcePath = (point: { x: number; y: number }) => {
        let minimumDistance = Infinity
        for (let index = 0; index < sourceSamples.length - 1; index += 1) {
          minimumDistance = Math.min(
            minimumDistance,
            pointSegmentDistance(
              point,
              sourceSamples[index],
              sourceSamples[index + 1]
            )
          )
        }
        return minimumDistance
      }
      const redFloodMask = new Uint8Array(width * height)
      const zoneSummaries = zones.map((zone) => ({
        id: zone.id,
        farFillSampleCount: 0,
        redFarSampleCount: 0,
        maxAllowedRedFarSamples: 0
      }))
      let farFillSampleCount = 0
      let redFarSampleCount = 0
      const minSourceDistance = 14
      const step = 2

      for (let y = canvasBounds.top; y < canvasBounds.bottom; y += step) {
        for (let x = canvasBounds.left; x < canvasBounds.right; x += step) {
          if (!isLegalFillPixel(x, y)) {
            continue
          }
          const sourcePoint = toSourcePoint(x, y)
          const sourceDistance = distanceToSourcePath(sourcePoint)
          if (sourceDistance <= minSourceDistance) {
            continue
          }

          const red = isRedStrokePixel(x, y)
          farFillSampleCount += 1
          if (red) {
            redFarSampleCount += 1
            redFloodMask[y * width + x] = 1
          }

          zoneSummaries.forEach((summary, index) => {
            const zone = zones[index]
            if (
              sourcePoint.x < zone.bounds.minX ||
              sourcePoint.x > zone.bounds.maxX ||
              sourcePoint.y < zone.bounds.minY ||
              sourcePoint.y > zone.bounds.maxY
            ) {
              return
            }

            summary.farFillSampleCount += 1
            if (red) {
              summary.redFarSampleCount += 1
            }
          })
        }
      }

      zoneSummaries.forEach((summary) => {
        summary.maxAllowedRedFarSamples = Math.max(
          2,
          Math.floor(summary.farFillSampleCount * 0.02)
        )
      })

      const visited = new Uint8Array(width * height)
      const queue: number[] = []
      const components: {
        area: number
        minX: number
        minY: number
        maxX: number
        maxY: number
      }[] = []
      for (let y = canvasBounds.top; y < canvasBounds.bottom; y += 1) {
        for (let x = canvasBounds.left; x < canvasBounds.right; x += 1) {
          const start = y * width + x
          if (redFloodMask[start] !== 1 || visited[start] === 1) continue
          visited[start] = 1
          queue.length = 0
          queue.push(start)
          let area = 0
          let minX = x
          let minY = y
          let maxX = x
          let maxY = y
          for (const current of queue) {
            area += 1
            const currentX = current % width
            const currentY = Math.floor(current / width)
            minX = Math.min(minX, currentX)
            minY = Math.min(minY, currentY)
            maxX = Math.max(maxX, currentX)
            maxY = Math.max(maxY, currentY)
            for (let dy = -step; dy <= step; dy += step) {
              for (let dx = -step; dx <= step; dx += step) {
                if (dx === 0 && dy === 0) continue
                const nextX = currentX + dx
                const nextY = currentY + dy
                if (!isInCanvas(nextX, nextY)) continue
                const next = nextY * width + nextX
                if (redFloodMask[next] === 1 && visited[next] !== 1) {
                  visited[next] = 1
                  queue.push(next)
                }
              }
            }
          }
          components.push({ area, minX, minY, maxX, maxY })
        }
      }

      return {
        farFillSampleCount,
        redFarSampleCount,
        maxAllowedRedFarSamples: Math.max(
          6,
          Math.floor(farFillSampleCount * 0.01)
        ),
        maxRedFloodComponentArea: Math.max(
          0,
          ...components.map((component) => component.area)
        ),
        redFloodComponents: components
          .filter((component) => component.area >= 4)
          .sort((left, right) => right.area - left.area)
          .slice(0, 10),
        zoneSummaries
      }
    },
    {
      baselineDataUrl: `data:image/png;base64,${baseline.toString('base64')}`,
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      sourceSamples: SELF_CHECK_SOURCE_SAMPLE_POINTS,
      zones: INSIDE_SOLID_FILL_PRESERVATION_ZONES
    }
  )

export const analyzeSolidBoundaryContinuity = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  expectedPosition: SelfCheckStrokePosition
) =>
  page.evaluate(
    async ({ actualDataUrl, metadata, expectedPosition }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for continuity analysis')
      }
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const canvasBounds = {
        left: 240,
        top: 40,
        right: Math.min(width, 1160),
        bottom: Math.min(height, 1065)
      }
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const isInCanvas = (x: number, y: number) =>
        x >= canvasBounds.left &&
        x < canvasBounds.right &&
        y >= canvasBounds.top &&
        y < canvasBounds.bottom
      const isRedStrokePixel = (x: number, y: number) => {
        if (!isInCanvas(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 120 && r > 70 && r > g * 1.35 && r > b * 1.35
      }
      const hasNearbyRedStrokePixel = (x: number, y: number, radius = 2) => {
        const centerX = Math.round(x)
        const centerY = Math.round(y)
        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if (
              offsetX * offsetX + offsetY * offsetY <= radius * radius &&
              isRedStrokePixel(centerX + offsetX, centerY + offsetY)
            ) {
              return true
            }
          }
        }
        return false
      }
      const normalize = (vector: { x: number; y: number }) => {
        const length = Math.hypot(vector.x, vector.y)
        return length <= 1e-6
          ? null
          : { x: vector.x / length, y: vector.y / length }
      }
      const toCanvasPoint = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const sampleFailures: {
        geometryId: string | null
        pointIndex: number
        distance: number
        canvasPoint: { x: number; y: number }
      }[] = []
      let sampleCount = 0

      for (const packet of metadata.boundaryDomainPackets) {
        if (
          packet.geometryFamily !== 'constrained-solid' ||
          packet.strokePosition !== expectedPosition ||
          packet.figmaLikeSelectedSide === null
        ) {
          continue
        }
        const boundaryPoints = packet.figmaLikeBoundaryPoints
        if (boundaryPoints.length < 2) {
          continue
        }
        const strokeWidth =
          typeof packet.strokeWidth === 'number' && packet.strokeWidth > 0
            ? packet.strokeWidth
            : 10
        const distances = [
          strokeWidth * 0.45,
          strokeWidth * 0.65,
          strokeWidth * 0.85
        ]
        const stride = Math.max(1, Math.floor(boundaryPoints.length / 96))

        for (let index = 0; index < boundaryPoints.length; index += stride) {
          const point = boundaryPoints[index]
          const previous = boundaryPoints[index - 1]
          const next = boundaryPoints[index + 1]
          const tangent =
            previous && next
              ? normalize({ x: next.x - previous.x, y: next.y - previous.y })
              : next
                ? normalize({ x: next.x - point.x, y: next.y - point.y })
                : previous
                  ? normalize({
                      x: point.x - previous.x,
                      y: point.y - previous.y
                    })
                  : null
          if (!tangent) {
            continue
          }
          const normal = {
            x: -tangent.y * packet.figmaLikeSelectedSide,
            y: tangent.x * packet.figmaLikeSelectedSide
          }

          for (const distance of distances) {
            const canvasPoint = toCanvasPoint({
              x: point.x + normal.x * distance,
              y: point.y + normal.y * distance
            })
            sampleCount += 1
            if (!hasNearbyRedStrokePixel(canvasPoint.x, canvasPoint.y)) {
              sampleFailures.push({
                geometryId: packet.geometryId,
                pointIndex: index,
                distance,
                canvasPoint
              })
            }
          }
        }
      }

      return {
        sampleCount,
        sampleFailures: sampleFailures.slice(0, 25),
        failureCount: sampleFailures.length
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      expectedPosition
    }
  )

export const analyzeSolidLocalBlackCrack = async (
  page: Page,
  actual: Buffer,
  center: Vec2,
  label: string
) =>
  page.evaluate(
    async ({ actualDataUrl, center, label }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for crack analysis')
      }
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 120 && r > 70 && r > g * 1.35 && r > b * 1.35
      }
      const isDarkPixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 120 && r < 52 && g < 52 && b < 52
      }
      const hasRedAlong = (x: number, y: number, dx: number, dy: number) => {
        for (let distance = 4; distance <= 28; distance += 2) {
          const sampleX = Math.round(x + dx * distance)
          const sampleY = Math.round(y + dy * distance)
          if (isRedStrokePixel(sampleX, sampleY)) {
            return true
          }
        }
        return false
      }
      const hasOpposingRedStroke = (x: number, y: number) =>
        [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 1, dy: 1 },
          { dx: 1, dy: -1 }
        ].some(
          ({ dx, dy }) =>
            hasRedAlong(x, y, dx, dy) && hasRedAlong(x, y, -dx, -dy)
        )
      const scanRadius = 180
      const crackMask = new Uint8Array(width * height)
      let crackPixelCount = 0

      for (
        let y = Math.max(0, Math.floor(center.y - scanRadius));
        y <= Math.min(height - 1, Math.ceil(center.y + scanRadius));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(center.x - scanRadius));
          x <= Math.min(width - 1, Math.ceil(center.x + scanRadius));
          x += 1
        ) {
          if (Math.hypot(x - center.x, y - center.y) > scanRadius) {
            continue
          }
          if (isDarkPixel(x, y) && hasOpposingRedStroke(x, y)) {
            crackMask[y * width + x] = 1
            crackPixelCount += 1
          }
        }
      }

      const visited = new Uint8Array(width * height)
      const queue: number[] = []
      const components: {
        area: number
        minX: number
        minY: number
        maxX: number
        maxY: number
      }[] = []
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const start = y * width + x
          if (crackMask[start] !== 1 || visited[start] === 1) continue
          visited[start] = 1
          queue.length = 0
          queue.push(start)
          let area = 0
          let minX = x
          let minY = y
          let maxX = x
          let maxY = y
          for (const current of queue) {
            area += 1
            const currentX = current % width
            const currentY = Math.floor(current / width)
            minX = Math.min(minX, currentX)
            minY = Math.min(minY, currentY)
            maxX = Math.max(maxX, currentX)
            maxY = Math.max(maxY, currentY)
            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue
                const nextX = currentX + dx
                const nextY = currentY + dy
                if (!inBounds(nextX, nextY)) continue
                const next = nextY * width + nextX
                if (crackMask[next] === 1 && visited[next] !== 1) {
                  visited[next] = 1
                  queue.push(next)
                }
              }
            }
          }
          components.push({ area, minX, minY, maxX, maxY })
        }
      }

      const relevantComponents = components
        .filter((component) => component.area >= 4)
        .sort((left, right) => right.area - left.area)
        .slice(0, 10)

      return {
        label,
        crackPixelCount,
        maxCrackComponentArea: Math.max(
          0,
          ...relevantComponents.map((component) => component.area)
        ),
        crackComponents: relevantComponents
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      center,
      label
    }
  )

export const analyzeInsideSolidAdjacencyWidth = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ actualDataUrl, metadata }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for adjacency probe')
      }
      context.drawImage(actualImage, 0, 0)
      const data = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.35 && r > b * 1.35
      }
      const packets = metadata.boundaryDomainPackets.filter(
        (packet) =>
          packet.strokePosition === 'inside' &&
          packet.solidMaskModelInsideMaskMode === 'face-occupancy-inside-fill'
      )
      const traces = packets.flatMap(
        (packet) => packet.solidMaskModelFaceOwnershipTrace
      )
      const traceLength = (trace: (typeof traces)[number]) =>
        Math.hypot(trace.end.x - trace.start.x, trace.end.y - trace.start.y)
      const measurableTraces = traces.filter(
        (trace) =>
          trace.adjacencySide !== null &&
          trace.oppositeFaceLegal !== null &&
          traceLength(trace) > 24
      )
      const cornerProbeTraces = traces.filter(
        (trace) =>
          trace.adjacencySide !== null &&
          trace.oppositeFaceLegal === true &&
          traceLength(trace) > 0.1
      )
      const center = {
        x:
          measurableTraces.reduce(
            (sum, trace) => sum + (trace.start.x + trace.end.x) / 2,
            0
          ) / Math.max(1, measurableTraces.length),
        y:
          measurableTraces.reduce(
            (sum, trace) => sum + (trace.start.y + trace.end.y) / 2,
            0
          ) / Math.max(1, measurableTraces.length)
      }
      const scoreUpperLeft = (trace: (typeof measurableTraces)[number]) => {
        const midpoint = {
          x: (trace.start.x + trace.end.x) / 2,
          y: (trace.start.y + trace.end.y) / 2
        }
        return midpoint.x - center.x + (midpoint.y - center.y) * 0.75
      }
      const sharedTraces = [...measurableTraces]
        .filter((trace) => trace.oppositeFaceLegal === true)
        .sort((first, second) => scoreUpperLeft(first) - scoreUpperLeft(second))
      const normalTraces = [...measurableTraces]
        .filter((trace) => trace.oppositeFaceLegal === false)
        .sort(
          (first, second) =>
            Math.hypot(
              second.end.x - second.start.x,
              second.end.y - second.start.y
            ) -
            Math.hypot(first.end.x - first.start.x, first.end.y - first.start.y)
        )
      const sharedTrace = sharedTraces[0]
      const chooseNormalTrace = (
        trace: (typeof measurableTraces)[number] | undefined
      ) =>
        normalTraces.find(
          (candidate) =>
            trace?.sourceSegmentIndex === null ||
            trace?.sourceSegmentIndex === undefined ||
            candidate.sourceSegmentIndex === trace.sourceSegmentIndex
        ) ?? normalTraces[0]
      const normalTrace = chooseNormalTrace(sharedTrace)
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const median = (values: number[]) => {
        const sorted = [...values].sort((first, second) => first - second)
        if (sorted.length === 0) return 0
        const middle = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle]
      }
      const measureFaceSideWidth = (
        trace: (typeof measurableTraces)[number],
        sampleRatio: number
      ) => {
        const dx = trace.end.x - trace.start.x
        const dy = trace.end.y - trace.start.y
        const length = Math.hypot(dx, dy)
        if (length <= 1e-6 || trace.adjacencySide === null) {
          return 0
        }
        const normal =
          trace.adjacencySide === 'left'
            ? { x: -dy / length, y: dx / length }
            : { x: dy / length, y: -dx / length }
        const centerPoint = {
          x: trace.start.x + dx * sampleRatio,
          y: trace.start.y + dy * sampleRatio
        }
        const strokeWidth = packets[0]?.strokeWidth ?? 10
        let currentStart: number | null = null
        let bestWidth = 0
        for (let offset = 0.5; offset <= strokeWidth * 1.6; offset += 0.5) {
          const screenPoint = toScreen({
            x: centerPoint.x + normal.x * offset,
            y: centerPoint.y + normal.y * offset
          })
          const covered = isRedStrokePixel(
            Math.round(screenPoint.x),
            Math.round(screenPoint.y)
          )
          if (covered && currentStart === null) {
            currentStart = offset
          }
          if (currentStart !== null && !covered) {
            bestWidth = Math.max(bestWidth, offset - currentStart)
            currentStart = null
          }
        }
        if (currentStart !== null) {
          bestWidth = Math.max(bestWidth, strokeWidth * 1.6 - currentStart)
        }
        return bestWidth
      }
      if (!sharedTrace || !normalTrace) {
        return {
          sampleCount: 0,
          sharedWidths: [],
          normalWidths: [],
          sharedStartWidthProfile: [],
          sharedEndWidthProfile: [],
          sharedMedian: 0,
          normalMedian: 0,
          ratio: Infinity,
          sharedEdgeAnalyses: [],
          combinedSharedEdgeAnalyses: [],
          minSharedRatio: Infinity,
          maxSharedRatio: Infinity,
          endpointProtrusionConnected: false,
          sharedBoundaryTransitionPresent: false,
          packets,
          sharedTrace: sharedTrace ?? null,
          normalTrace: normalTrace ?? null
        }
      }
      const ratios = [0.35, 0.5, 0.65]
      const strokeWidth = packets[0]?.strokeWidth ?? 10
      const endpointProbe = (
        trace: (typeof measurableTraces)[number],
        amount: number,
        endpoint: 'start' | 'end' = 'end'
      ) => {
        const dx = trace.end.x - trace.start.x
        const dy = trace.end.y - trace.start.y
        const length = Math.hypot(dx, dy)
        if (length <= 1e-6 || trace.adjacencySide === null) {
          return false
        }
        const tangent = { x: dx / length, y: dy / length }
        const normal =
          trace.adjacencySide === 'left'
            ? { x: -dy / length, y: dx / length }
            : { x: dy / length, y: -dx / length }
        const endpointPoint = endpoint === 'start' ? trace.start : trace.end
        const tangentDirection =
          endpoint === 'start' ? tangent : { x: -tangent.x, y: -tangent.y }
        const point = {
          x:
            endpointPoint.x +
            tangentDirection.x * strokeWidth * 0.35 +
            normal.x * amount,
          y:
            endpointPoint.y +
            tangentDirection.y * strokeWidth * 0.35 +
            normal.y * amount
        }
        const screenPoint = toScreen(point)
        return isRedStrokePixel(
          Math.round(screenPoint.x),
          Math.round(screenPoint.y)
        )
      }
      const traceKey = (trace: (typeof measurableTraces)[number]) =>
        [
          `${trace.start.x.toFixed(2)}:${trace.start.y.toFixed(2)}`,
          `${trace.end.x.toFixed(2)}:${trace.end.y.toFixed(2)}`
        ]
          .sort()
          .join('|')
      const analyzeTracePair = (
        testedSharedTrace: (typeof measurableTraces)[number],
        testedNormalTrace: (typeof measurableTraces)[number]
      ) => {
        const sharedWidths = ratios.map((ratio) =>
          measureFaceSideWidth(testedSharedTrace, ratio)
        )
        const normalWidths = ratios.map((ratio) =>
          measureFaceSideWidth(testedNormalTrace, ratio)
        )
        const sharedStartWidthProfile = [0.04, 0.08, 0.12, 0.18, 0.24].map(
          (ratio) => measureFaceSideWidth(testedSharedTrace, ratio)
        )
        const sharedEndWidthProfile = [0.76, 0.82, 0.88, 0.92, 0.96].map(
          (ratio) => measureFaceSideWidth(testedSharedTrace, ratio)
        )
        const sharedMedian = median(sharedWidths)
        const normalMedian = median(normalWidths)
        const ratio = normalMedian > 0 ? sharedMedian / normalMedian : Infinity
        const endpointProtrusionConnected =
          endpointProbe(testedSharedTrace, strokeWidth * 0.48) &&
          endpointProbe(testedSharedTrace, strokeWidth * 0.82)
        return {
          key: traceKey(testedSharedTrace),
          sharedWidths,
          normalWidths,
          sharedStartWidthProfile,
          sharedEndWidthProfile,
          sharedMedian,
          normalMedian,
          ratio,
          endpointProtrusionConnected,
          sharedBoundaryTransitionPresent: ratio >= 0.4 && ratio <= 0.65,
          sharedTrace: testedSharedTrace,
          normalTrace: testedNormalTrace
        }
      }
      const sharedEdgeAnalyses = sharedTraces
        .map((testedSharedTrace) => {
          const testedNormalTrace = chooseNormalTrace(testedSharedTrace)
          return testedNormalTrace
            ? analyzeTracePair(testedSharedTrace, testedNormalTrace)
            : null
        })
        .filter(
          (entry): entry is ReturnType<typeof analyzeTracePair> =>
            entry !== null
        )
      const primaryAnalysis = analyzeTracePair(sharedTrace, normalTrace)
      const groupedBySharedEdge = sharedEdgeAnalyses.reduce((groups, entry) => {
        const group = groups.get(entry.key) ?? []
        group.push(entry)
        groups.set(entry.key, group)
        return groups
      }, new Map<string, typeof sharedEdgeAnalyses>())
      const combinedSharedEdgeAnalyses = Array.from(
        groupedBySharedEdge.entries()
      ).flatMap(([key, group]) => {
        if (group.length < 2) {
          return []
        }
        const normalMedian = median(
          group.map((entry) => entry.normalMedian).filter((value) => value > 0)
        )
        const combinedSharedMedian = group
          .slice(0, 2)
          .reduce((sum, entry) => sum + entry.sharedMedian, 0)
        return [
          {
            key,
            count: group.length,
            combinedSharedMedian,
            normalMedian,
            combinedRatio:
              normalMedian > 0 ? combinedSharedMedian / normalMedian : Infinity
          }
        ]
      })
      const sharedRatios = sharedEdgeAnalyses.map((entry) => entry.ratio)
      const cornerProtrusionAnalyses = Array.from(
        cornerProbeTraces
          .flatMap((trace) =>
            (['start', 'end'] as const).map((endpoint) => {
              const vertex = endpoint === 'start' ? trace.start : trace.end
              return {
                key: `${vertex.x.toFixed(2)}:${vertex.y.toFixed(2)}`,
                vertex,
                connected:
                  endpointProbe(trace, strokeWidth * 0.48, endpoint) &&
                  endpointProbe(trace, strokeWidth * 0.82, endpoint)
              }
            })
          )
          .reduce((map, entry) => {
            const current = map.get(entry.key)
            map.set(entry.key, {
              ...entry,
              connected: (current?.connected ?? false) || entry.connected
            })
            return map
          }, new Map<string, { key: string; vertex: { x: number; y: number }; connected: boolean }>())
          .values()
      )
      const traceEndpointKey = (point: { x: number; y: number }) =>
        `${point.x.toFixed(2)}:${point.y.toFixed(2)}`
      const incidentByVertex = traces.reduce(
        (map, trace) => {
          ;[
            { endpoint: 'start' as const, point: trace.start },
            { endpoint: 'end' as const, point: trace.end }
          ].forEach(({ endpoint, point }) => {
            const key = traceEndpointKey(point)
            const entries = map.get(key) ?? []
            entries.push({ trace, endpoint })
            map.set(key, entries)
          })
          return map
        },
        new Map<
          string,
          {
            trace: (typeof traces)[number]
            endpoint: 'start' | 'end'
          }[]
        >()
      )
      const lowerCandidates = Array.from(incidentByVertex.entries())
        .map(([key, incident]) => {
          const point =
            incident[0]?.endpoint === 'start'
              ? incident[0].trace.start
              : incident[0]?.trace.end
          return point ? { key, vertex: point, incident } : null
        })
        .filter(
          (
            entry
          ): entry is {
            key: string
            vertex: { x: number; y: number }
            incident: {
              trace: (typeof traces)[number]
              endpoint: 'start' | 'end'
            }[]
          } => entry !== null && entry.vertex.y > center.y
        )
      const lowerBand = [...lowerCandidates]
        .sort((first, second) => second.vertex.y - first.vertex.y)
        .slice(0, Math.min(4, lowerCandidates.length))
      const buildLowerHighCurvatureAnalysis = (
        id: string,
        target: (typeof lowerCandidates)[number] | undefined
      ) => {
        if (!target) {
          return {
            id,
            sampleCount: 0,
            coveredCount: 0,
            coverageRatio: 0,
            target: null
          }
        }
        const samplePoints = target.incident.flatMap(({ trace, endpoint }) => {
          const dx = trace.end.x - trace.start.x
          const dy = trace.end.y - trace.start.y
          const length = Math.hypot(dx, dy)
          if (length <= 1e-6 || trace.adjacencySide === null) {
            return []
          }
          const tangent = { x: dx / length, y: dy / length }
          const normal =
            trace.adjacencySide === 'left'
              ? { x: -dy / length, y: dx / length }
              : { x: dy / length, y: -dx / length }
          const tangentAway =
            endpoint === 'start' ? tangent : { x: -tangent.x, y: -tangent.y }
          return [0.2, 0.42, 0.64].flatMap((tangentOffset) =>
            [0.3, 0.55, 0.8].map((normalOffset) => ({
              x:
                target.vertex.x +
                tangentAway.x * strokeWidth * tangentOffset +
                normal.x * strokeWidth * normalOffset,
              y:
                target.vertex.y +
                tangentAway.y * strokeWidth * tangentOffset +
                normal.y * strokeWidth * normalOffset
            }))
          )
        })
        const coveredCount = samplePoints.filter((point) => {
          const screenPoint = toScreen(point)
          return isRedStrokePixel(
            Math.round(screenPoint.x),
            Math.round(screenPoint.y)
          )
        }).length
        return {
          id,
          sampleCount: samplePoints.length,
          coveredCount,
          coverageRatio:
            samplePoints.length > 0 ? coveredCount / samplePoints.length : 0,
          target
        }
      }
      const lowerHighCurvatureAnalyses = [
        buildLowerHighCurvatureAnalysis(
          'inside-solid-lower-left-high-curvature-no-gap',
          [...lowerBand].sort(
            (first, second) => first.vertex.x - second.vertex.x
          )[0]
        ),
        buildLowerHighCurvatureAnalysis(
          'inside-solid-lower-right-high-curvature-no-gap',
          [...lowerBand].sort(
            (first, second) => second.vertex.x - first.vertex.x
          )[0]
        )
      ]

      return {
        sampleCount: sharedEdgeAnalyses.reduce(
          (sum, entry) =>
            sum + entry.sharedWidths.length + entry.normalWidths.length,
          0
        ),
        sharedWidths: primaryAnalysis.sharedWidths,
        normalWidths: primaryAnalysis.normalWidths,
        sharedStartWidthProfile: primaryAnalysis.sharedStartWidthProfile,
        sharedEndWidthProfile: primaryAnalysis.sharedEndWidthProfile,
        sharedMedian: primaryAnalysis.sharedMedian,
        normalMedian: primaryAnalysis.normalMedian,
        ratio: primaryAnalysis.ratio,
        sharedEdgeAnalyses,
        combinedSharedEdgeAnalyses,
        cornerProtrusionAnalyses,
        connectedCornerProtrusionCount: cornerProtrusionAnalyses.filter(
          (entry) => entry.connected
        ).length,
        lowerHighCurvatureAnalyses,
        minSharedRatio: Math.min(...sharedRatios),
        maxSharedRatio: Math.max(...sharedRatios),
        endpointProtrusionConnected:
          primaryAnalysis.endpointProtrusionConnected,
        sharedBoundaryTransitionPresent:
          primaryAnalysis.sharedBoundaryTransitionPresent,
        packets,
        sharedTrace,
        normalTrace
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata
    }
  )

export const getInsideSolidInternalCornerCentersFromMetadata = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) => {
  const traces = metadata.boundaryDomainPackets.flatMap((packet) =>
    packet.strokePosition === 'inside' &&
    packet.solidMaskModelInsideMaskMode === 'face-occupancy-inside-fill'
      ? packet.solidMaskModelFaceOwnershipTrace
      : []
  )
  const centersByKey = new Map<string, Vec2>()

  traces
    .filter(
      (trace) =>
        trace.oppositeFaceLegal === true &&
        trace.faceJoinEligibility === 'join-reactive'
    )
    .forEach((trace) => {
      ;[
        { point: trace.start, degree: trace.startNodeDegree },
        { point: trace.end, degree: trace.endNodeDegree }
      ].forEach(({ point, degree }) => {
        if ((degree ?? 0) <= 2) {
          return
        }
        const key = `${point.x.toFixed(2)}:${point.y.toFixed(2)}`
        centersByKey.set(key, { x: point.x, y: point.y })
      })
    })

  const allCenters = [...centersByKey.values()]
  const centroid = {
    x:
      allCenters.reduce((sum, point) => sum + point.x, 0) /
      Math.max(1, allCenters.length),
    y:
      allCenters.reduce((sum, point) => sum + point.y, 0) /
      Math.max(1, allCenters.length)
  }

  return allCenters
    .sort(
      (first, second) =>
        Math.hypot(first.x - centroid.x, first.y - centroid.y) -
          Math.hypot(second.x - centroid.x, second.y - centroid.y) ||
        first.y - second.y ||
        first.x - second.x
    )
    .slice(0, 5)
}

export const getInsideSolidMaskOnlyCornerProbesFromMetadata = (
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) => {
  const strokeWidth =
    metadata.boundaryDomainPackets.find(
      (packet) =>
        packet.strokePosition === 'inside' &&
        packet.geometryFamily === 'constrained-solid'
    )?.strokeWidth ?? 10
  const tracesByFaceId = new Map<
    string,
    Awaited<
      ReturnType<typeof getSelfCheckMetadata>
    >['boundaryDomainPackets'][number]['solidMaskModelFaceOwnershipTrace']
  >()

  metadata.boundaryDomainPackets.forEach((packet) => {
    if (
      packet.strokePosition !== 'inside' ||
      packet.solidMaskModelInsideMaskMode !== 'face-occupancy-inside-fill'
    ) {
      return
    }
    packet.solidMaskModelFaceOwnershipTrace
      .filter((trace) => trace.faceJoinEligibility === 'mask-only')
      .forEach((trace) => {
        const traces = tracesByFaceId.get(trace.faceId) ?? []
        traces.push(trace)
        tracesByFaceId.set(trace.faceId, traces)
      })
  })

  const probesByKey = new Map<string, { vertex: Vec2; samplePoints: Vec2[] }>()
  tracesByFaceId.forEach((traces) => {
    const facePoints = traces.flatMap((trace) => [trace.start, trace.end])
    const faceCentroid =
      facePoints.length > 0
        ? {
            x:
              facePoints.reduce((sum, point) => sum + point.x, 0) /
              facePoints.length,
            y:
              facePoints.reduce((sum, point) => sum + point.y, 0) /
              facePoints.length
          }
        : { x: 0, y: 0 }
    traces.forEach((previous, index) => {
      const next = traces[(index + 1) % traces.length]
      if (
        !next ||
        Math.hypot(
          previous.end.x - next.start.x,
          previous.end.y - next.start.y
        ) > 1.5 ||
        ((previous.endNodeDegree ?? 0) <= 2 && (next.startNodeDegree ?? 0) <= 2)
      ) {
        return
      }
      const vertex = {
        x: (previous.end.x + next.start.x) / 2,
        y: (previous.end.y + next.start.y) / 2
      }
      const dx = faceCentroid.x - vertex.x
      const dy = faceCentroid.y - vertex.y
      const length = Math.hypot(dx, dy)
      if (length <= 1e-6) {
        return
      }
      const direction = { x: dx / length, y: dy / length }
      const samplePoints = [0.35, 0.55, 0.75, 0.95].map((offset) => ({
        x: vertex.x + direction.x * strokeWidth * offset,
        y: vertex.y + direction.y * strokeWidth * offset
      }))
      const key = `${vertex.x.toFixed(2)}:${vertex.y.toFixed(2)}`
      probesByKey.set(key, { vertex, samplePoints })
    })
  })

  return [...probesByKey.values()].slice(0, 8)
}

export const compareInsideSolidInternalCornerJoinPixels = async (
  page: Page,
  first: Buffer,
  second: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  centers: Vec2[]
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl, metadata, centers }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for join-shape comparison')
      }
      context.drawImage(firstImage, 0, 0)
      const firstData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondData = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (
        data: Uint8ClampedArray,
        x: number,
        y: number
      ) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.35 && r > b * 1.35
      }
      const rgbaDistance = (x: number, y: number) => {
        const index = indexOf(x, y)
        return (
          Math.abs(firstData[index] - secondData[index]) +
          Math.abs(firstData[index + 1] - secondData[index + 1]) +
          Math.abs(firstData[index + 2] - secondData[index + 2]) +
          Math.abs(firstData[index + 3] - secondData[index + 3])
        )
      }
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const strokeWidth =
        metadata.boundaryDomainPackets.find(
          (packet) =>
            packet.strokePosition === 'inside' &&
            packet.geometryFamily === 'constrained-solid'
        )?.strokeWidth ?? 10
      const radius = Math.max(12, strokeWidth * metadata.zoom * 1.9)
      let comparedPixelCount = 0
      let changedPixelCount = 0
      let changedRgbaPixelCount = 0
      let firstRedCount = 0
      let secondRedCount = 0

      centers.forEach((center) => {
        const screen = toScreen(center)
        for (
          let y = Math.max(0, Math.floor(screen.y - radius));
          y <= Math.min(height - 1, Math.ceil(screen.y + radius));
          y += 1
        ) {
          for (
            let x = Math.max(0, Math.floor(screen.x - radius));
            x <= Math.min(width - 1, Math.ceil(screen.x + radius));
            x += 1
          ) {
            if (Math.hypot(x - screen.x, y - screen.y) > radius) {
              continue
            }
            comparedPixelCount += 1
            const firstRed = isRedStrokePixel(firstData, x, y)
            const secondRed = isRedStrokePixel(secondData, x, y)
            if (firstRed) firstRedCount += 1
            if (secondRed) secondRedCount += 1
            if (firstRed !== secondRed) {
              changedPixelCount += 1
            }
            if (rgbaDistance(x, y) > 32) {
              changedRgbaPixelCount += 1
            }
          }
        }
      })

      return {
        centerCount: centers.length,
        comparedPixelCount,
        changedPixelCount,
        changedRgbaPixelCount,
        firstRedCount,
        secondRedCount,
        radius
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`,
      metadata,
      centers
    }
  )

export const compareInsideSolidPointSamples = async (
  page: Page,
  first: Buffer,
  second: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  points: Vec2[]
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl, metadata, points }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for point sample comparison')
      }
      context.drawImage(firstImage, 0, 0)
      const firstData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondData = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (
        data: Uint8ClampedArray,
        x: number,
        y: number
      ) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.35 && r > b * 1.35
      }
      const rgbaDistance = (x: number, y: number) => {
        const index = indexOf(x, y)
        return (
          Math.abs(firstData[index] - secondData[index]) +
          Math.abs(firstData[index + 1] - secondData[index + 1]) +
          Math.abs(firstData[index + 2] - secondData[index + 2]) +
          Math.abs(firstData[index + 3] - secondData[index + 3])
        )
      }
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const radius = 1
      let comparedPixelCount = 0
      let changedPixelCount = 0
      let changedRgbaPixelCount = 0
      let firstRedCount = 0
      let secondRedCount = 0

      points.forEach((point) => {
        const screen = toScreen(point)
        for (
          let y = Math.max(0, Math.round(screen.y) - radius);
          y <= Math.min(height - 1, Math.round(screen.y) + radius);
          y += 1
        ) {
          for (
            let x = Math.max(0, Math.round(screen.x) - radius);
            x <= Math.min(width - 1, Math.round(screen.x) + radius);
            x += 1
          ) {
            comparedPixelCount += 1
            const firstRed = isRedStrokePixel(firstData, x, y)
            const secondRed = isRedStrokePixel(secondData, x, y)
            if (firstRed) firstRedCount += 1
            if (secondRed) secondRedCount += 1
            if (firstRed !== secondRed) {
              changedPixelCount += 1
            }
            if (rgbaDistance(x, y) > 32) {
              changedRgbaPixelCount += 1
            }
          }
        }
      })

      return {
        pointCount: points.length,
        comparedPixelCount,
        changedPixelCount,
        changedRgbaPixelCount,
        firstRedCount,
        secondRedCount,
        radius
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`,
      metadata,
      points
    }
  )

export const compareCanvasAreaScreenshotPixels = async (
  page: Page,
  first: Buffer,
  second: Buffer
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for screenshot comparison')
      }
      context.drawImage(firstImage, 0, 0)
      const firstData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondData = context.getImageData(0, 0, width, height).data
      let changedPixelCount = 0
      let changedRgbaPixelCount = 0
      let comparedPixelCount = 0
      const bounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      const isStrokeOrFillPixel = (data: Uint8ClampedArray, index: number) => {
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 120 && (r > 70 || g > 70 || b > 70)
      }
      for (let y = 40; y < height; y += 1) {
        for (let x = 240; x < width - 240; x += 1) {
          const index = (y * width + x) * 4
          const firstRelevant = isStrokeOrFillPixel(firstData, index)
          const secondRelevant = isStrokeOrFillPixel(secondData, index)
          if (!firstRelevant && !secondRelevant) {
            continue
          }
          comparedPixelCount += 1
          const rgbaDifference =
            Math.abs(firstData[index] - secondData[index]) +
            Math.abs(firstData[index + 1] - secondData[index + 1]) +
            Math.abs(firstData[index + 2] - secondData[index + 2]) +
            Math.abs(firstData[index + 3] - secondData[index + 3])
          if (rgbaDifference > 32) {
            changedRgbaPixelCount += 1
            bounds.minX = Math.min(bounds.minX, x)
            bounds.minY = Math.min(bounds.minY, y)
            bounds.maxX = Math.max(bounds.maxX, x)
            bounds.maxY = Math.max(bounds.maxY, y)
          }
          const firstRed =
            firstData[index + 3] > 140 &&
            firstData[index] > 80 &&
            firstData[index] > firstData[index + 1] * 1.25 &&
            firstData[index] > firstData[index + 2] * 1.25
          const secondRed =
            secondData[index + 3] > 140 &&
            secondData[index] > 80 &&
            secondData[index] > secondData[index + 1] * 1.25 &&
            secondData[index] > secondData[index + 2] * 1.25
          if (firstRed !== secondRed) {
            changedPixelCount += 1
          }
        }
      }

      return {
        comparedPixelCount,
        changedPixelCount,
        changedRgbaPixelCount,
        changedBounds: changedRgbaPixelCount > 0 ? bounds : null
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`
    }
  )

export const analyzeInsideSolidOuterSourceVertexCoverage = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ actualDataUrl, metadata, sourceAnchorPoints }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for source vertex probe')
      }
      context.drawImage(actualImage, 0, 0)
      const data = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.35 && r > b * 1.35
      }
      const hasRedNear = (x: number, y: number) => {
        const roundedX = Math.round(x)
        const roundedY = Math.round(y)
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (isRedStrokePixel(roundedX + dx, roundedY + dy)) {
              return true
            }
          }
        }
        return false
      }
      const packets = metadata.boundaryDomainPackets.filter(
        (packet) =>
          packet.strokePosition === 'inside' &&
          packet.solidMaskModelInsideMaskMode === 'face-occupancy-inside-fill'
      )
      const strokeWidth = packets[0]?.strokeWidth ?? 10
      const center = {
        x:
          sourceAnchorPoints.reduce((sum, point) => sum + point.x, 0) /
          Math.max(1, sourceAnchorPoints.length),
        y:
          sourceAnchorPoints.reduce((sum, point) => sum + point.y, 0) /
          Math.max(1, sourceAnchorPoints.length)
      }
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const analyses = sourceAnchorPoints.map((anchor, anchorIndex) => {
        const dx = center.x - anchor.x
        const dy = center.y - anchor.y
        const length = Math.hypot(dx, dy)
        const direction =
          length > 1e-6 ? { x: dx / length, y: dy / length } : null
        const samplePoints = direction
          ? [0.25, 0.42, 0.6, 0.78, 0.96].map((offset) => ({
              x: anchor.x + direction.x * strokeWidth * offset,
              y: anchor.y + direction.y * strokeWidth * offset
            }))
          : []
        const coveredCount = samplePoints.filter((point) => {
          const screenPoint = toScreen(point)
          return hasRedNear(screenPoint.x, screenPoint.y)
        }).length
        return {
          anchorIndex,
          anchor,
          coveredCount,
          sampleCount: samplePoints.length,
          coverageRatio:
            samplePoints.length > 0 ? coveredCount / samplePoints.length : 0,
          samplePoints
        }
      })

      return {
        anchorCount: sourceAnchorPoints.length,
        analyses,
        missingAnalyses: analyses.filter(
          (analysis) =>
            analysis.coveredCount < Math.max(2, analysis.sampleCount - 2)
        )
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      sourceAnchorPoints: SELF_CHECK_SOURCE_ANCHOR_POINTS
    }
  )

export const analyzeInsideSolidSourceSegmentAdherence = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ actualDataUrl, metadata, probes }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for source segment probe')
      }
      context.drawImage(actualImage, 0, 0)
      const data = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.35 && r > b * 1.35
      }
      const hasRedNear = (x: number, y: number) => {
        const roundedX = Math.round(x)
        const roundedY = Math.round(y)
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (isRedStrokePixel(roundedX + dx, roundedY + dy)) {
              return true
            }
          }
        }
        return false
      }
      const packets = metadata.boundaryDomainPackets.filter(
        (packet) =>
          packet.strokePosition === 'inside' &&
          packet.solidMaskModelInsideMaskMode === 'face-occupancy-inside-fill'
      )
      const strokeWidth = packets[0]?.strokeWidth ?? 10
      const center = {
        x:
          probes
            .flatMap((probe) => probe.samplePoints)
            .reduce((sum, point) => sum + point.x, 0) /
          Math.max(1, probes.flatMap((probe) => probe.samplePoints).length),
        y:
          probes
            .flatMap((probe) => probe.samplePoints)
            .reduce((sum, point) => sum + point.y, 0) /
          Math.max(1, probes.flatMap((probe) => probe.samplePoints).length)
      }
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const analyses = probes.map((probe) => {
        const sourceSampleAnalyses = probe.samplePoints.map((point, index) => {
          const previous = probe.samplePoints[Math.max(0, index - 1)]
          const next =
            probe.samplePoints[
              Math.min(probe.samplePoints.length - 1, index + 1)
            ]
          const dx = next.x - previous.x
          const dy = next.y - previous.y
          const length = Math.hypot(dx, dy)
          if (length <= 1e-6) {
            return { point, sideCounts: [0, 0], covered: false }
          }
          const normal = { x: -dy / length, y: dx / length }
          let visibleProbeCount = 0
          const sideCounts = [-1, 1].map(
            (side) =>
              [0.12, 0.24, 0.36, 0.48].filter((offset) => {
                const screenPoint = toScreen({
                  x: point.x + normal.x * side * strokeWidth * offset,
                  y: point.y + normal.y * side * strokeWidth * offset
                })
                if (
                  !inBounds(
                    Math.round(screenPoint.x),
                    Math.round(screenPoint.y)
                  )
                ) {
                  return false
                }
                visibleProbeCount += 1
                return hasRedNear(screenPoint.x, screenPoint.y)
              }).length
          )
          const covered = probe.requiresBothSides
            ? Math.min(...sideCounts) >= 2
            : Math.max(...sideCounts) >= 2
          return {
            point,
            sideCounts,
            visibleProbeCount,
            covered
          }
        })
        const visibleSourceSampleAnalyses = sourceSampleAnalyses.filter(
          (entry) => entry.visibleProbeCount > 0
        )
        const coveredCount = visibleSourceSampleAnalyses.filter(
          (entry) => entry.covered
        ).length
        return {
          id: probe.id,
          focus: probe.focus,
          sampleCount: visibleSourceSampleAnalyses.length,
          coveredCount,
          coverageRatio:
            visibleSourceSampleAnalyses.length > 0
              ? coveredCount / visibleSourceSampleAnalyses.length
              : 0,
          missingSampleCount: visibleSourceSampleAnalyses.length - coveredCount,
          sourceSampleAnalyses,
          center
        }
      })
      return {
        analyses,
        failedAnalyses: analyses.filter(
          (analysis) => analysis.coverageRatio < 0.88
        )
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      probes: INSIDE_SOLID_SOURCE_SEGMENT_ADHERENCE_PROBES
    }
  )

export const analyzeInsideSolidSourcePathContinuity = async (
  page: Page,
  baseline: Buffer,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>
) =>
  page.evaluate(
    async ({ actualDataUrl, baselineDataUrl, metadata, sourceSegments }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [baselineImage, actualImage] = await Promise.all([
        loadImage(baselineDataUrl),
        loadImage(actualDataUrl)
      ])
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for source path continuity')
      }
      context.drawImage(baselineImage, 0, 0)
      const baselineData = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(actualImage, 0, 0)
      const data = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isLegalFillPixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = baselineData[index]
        const g = baselineData[index + 1]
        const b = baselineData[index + 2]
        const a = baselineData[index + 3]
        return (
          a > 180 &&
          r > 145 &&
          g > 145 &&
          b > 145 &&
          Math.abs(r - g) < 45 &&
          Math.abs(g - b) < 45
        )
      }
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 120 && r > 70 && r > g * 1.35 && r > b * 1.35
      }
      const hasRedNear = (x: number, y: number, radius: number) => {
        const roundedX = Math.round(x)
        const roundedY = Math.round(y)
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (
              dx * dx + dy * dy <= radius * radius &&
              isRedStrokePixel(roundedX + dx, roundedY + dy)
            ) {
              return true
            }
          }
        }
        return false
      }
      const hasFillNear = (x: number, y: number, radius: number) => {
        const roundedX = Math.round(x)
        const roundedY = Math.round(y)
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (
              dx * dx + dy * dy <= radius * radius &&
              isLegalFillPixel(roundedX + dx, roundedY + dy)
            ) {
              return true
            }
          }
        }
        return false
      }
      const toScreen = (point: { x: number; y: number }) => ({
        x:
          (metadata.selectedRect.x + point.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + point.y) * metadata.zoom +
          metadata.viewport.y
      })
      const strokeWidth =
        metadata.boundaryDomainPackets.find(
          (packet) =>
            packet.geometryFamily === 'constrained-solid' &&
            packet.strokePosition === 'inside'
        )?.strokeWidth ?? 10
      const sourceOffsetScalars = [
        -1.1, -0.8, -0.55, -0.35, -0.15, 0, 0.15, 0.35, 0.55, 0.8, 1.1
      ]
      const pixelRadius = Math.max(2, Math.round(metadata.zoom * 1.25))
      const segmentSummaries = sourceSegments.map((segment) => {
        let coveredCount = 0
        let eligibleCount = 0
        const missingSamples: {
          sampleIndex: number
          point: { x: number; y: number }
          canvasPoint: { x: number; y: number }
        }[] = []

        segment.samples.forEach((point, sampleIndex) => {
          const previous = segment.samples[Math.max(0, sampleIndex - 1)]
          const next =
            segment.samples[
              Math.min(segment.samples.length - 1, sampleIndex + 1)
            ]
          const dx = next.x - previous.x
          const dy = next.y - previous.y
          const length = Math.hypot(dx, dy)
          if (length <= 1e-6) {
            return
          }
          const normal = { x: -dy / length, y: dx / length }
          const screenPoints = sourceOffsetScalars.map((offsetScalar) =>
            toScreen({
              x: point.x + normal.x * strokeWidth * offsetScalar,
              y: point.y + normal.y * strokeWidth * offsetScalar
            })
          )
          const eligible = screenPoints.some((screenPoint) =>
            hasFillNear(screenPoint.x, screenPoint.y, pixelRadius)
          )
          if (!eligible) {
            return
          }
          eligibleCount += 1
          const covered = screenPoints.some((screenPoint) =>
            hasRedNear(screenPoint.x, screenPoint.y, pixelRadius)
          )
          if (covered) {
            coveredCount += 1
            return
          }
          missingSamples.push({
            sampleIndex,
            point,
            canvasPoint: toScreen(point)
          })
        })

        const sampleCount = eligibleCount
        return {
          id: segment.id,
          sampleCount,
          coveredCount,
          missingCount: sampleCount - coveredCount,
          coverageRatio: sampleCount > 0 ? coveredCount / sampleCount : 1,
          skippedOutsideFillCount: segment.samples.length - sampleCount,
          missingSamples: missingSamples.slice(0, 12)
        }
      })
      const sampleCount = segmentSummaries.reduce(
        (sum, summary) => sum + summary.sampleCount,
        0
      )
      const coveredCount = segmentSummaries.reduce(
        (sum, summary) => sum + summary.coveredCount,
        0
      )
      return {
        sampleCount,
        coveredCount,
        missingCount: sampleCount - coveredCount,
        coverageRatio: sampleCount > 0 ? coveredCount / sampleCount : 1,
        segmentSummaries,
        failedSegmentSummaries: segmentSummaries.filter(
          (summary) => summary.coverageRatio < 0.88
        )
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      baselineDataUrl: `data:image/png;base64,${baseline.toString('base64')}`,
      metadata,
      sourceSegments: SELF_CHECK_SOURCE_SEGMENTS.map(
        (segment, segmentIndex) => ({
          id: `segment-${segmentIndex}:${segment.startId}->${segment.endId}`,
          samples: Array.from({ length: 41 }, (_unused, index) =>
            getSelfCheckSegmentSamplePoint(segment, index / 40)
          )
        })
      )
    }
  )

export const analyzeInsideSolidLocalFillProbe = async (
  page: Page,
  actual: Buffer,
  center: Vec2,
  label: string
) =>
  page.evaluate(
    async ({ actualDataUrl, center, label }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for local fill probe')
      }
      context.drawImage(actualImage, 0, 0)
      const data = context.getImageData(0, 0, width, height).data
      const indexOf = (x: number, y: number) => (y * width + x) * 4
      const inBounds = (x: number, y: number) =>
        x >= 0 && x < width && y >= 0 && y < height
      const isRedStrokePixel = (x: number, y: number) => {
        if (!inBounds(x, y)) return false
        const index = indexOf(x, y)
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const a = data[index + 3]
        return a > 140 && r > 80 && r > g * 1.45 && r > b * 1.45
      }
      let sampleCount = 0
      let redSampleCount = 0
      const radius = 28

      for (
        let y = Math.max(0, Math.floor(center.y - radius));
        y <= Math.min(height - 1, Math.ceil(center.y + radius));
        y += 2
      ) {
        for (
          let x = Math.max(0, Math.floor(center.x - radius));
          x <= Math.min(width - 1, Math.ceil(center.x + radius));
          x += 2
        ) {
          if (Math.hypot(x - center.x, y - center.y) > radius) {
            continue
          }
          sampleCount += 1
          if (isRedStrokePixel(x, y)) {
            redSampleCount += 1
          }
        }
      }

      return {
        label,
        sampleCount,
        redSampleCount,
        redRatio: sampleCount === 0 ? 0 : redSampleCount / sampleCount
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      center,
      label
    }
  )

export const analyzeSelfCheckBoundaryDomainOracle = async (
  page: Page,
  actual: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  sourcePath: Vec2[],
  options: {
    capType?: SelfCheckCapType
    strictTerminalAdjacentGap?: boolean
    expectedPosition?: SelfCheckStrokePosition
  } = {}
) =>
  page.evaluate(
    async ({
      actualDataUrl,
      metadata,
      sourcePath,
      sourceAnchorPoints,
      smoothContinuityAnchorPoints,
      capType,
      strictTerminalAdjacentGap,
      expectedPosition
    }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const actualImage = await loadImage(actualDataUrl)
      const width = actualImage.width
      const height = actualImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for source-path oracle')
      }
      context.drawImage(actualImage, 0, 0)
      const actualData = context.getImageData(0, 0, width, height).data
      const selectedRect = metadata.selectedRect
      if (!selectedRect) {
        throw new Error('Missing selected rect for source-path oracle')
      }

      const insidePolygon = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[]
      ) => {
        let inside = false
        for (
          let pointIndex = 0, previousIndex = polygon.length - 1;
          pointIndex < polygon.length;
          previousIndex = pointIndex, pointIndex += 1
        ) {
          const current = polygon[pointIndex]
          const previous = polygon[previousIndex]
          const intersects =
            current.y > point.y !== previous.y > point.y &&
            point.x <
              ((previous.x - current.x) * (point.y - current.y)) /
                (previous.y - current.y) +
                current.x
          if (intersects) inside = !inside
        }
        return inside
      }
      const pointSegmentDistance = (
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
      ) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 1e-6) {
          return Math.hypot(point.x - start.x, point.y - start.y)
        }
        const t = Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared
          )
        )
        return Math.hypot(
          point.x - (start.x + dx * t),
          point.y - (start.y + dy * t)
        )
      }
      const onPolygonBoundary = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[],
        tolerance = 1
      ) =>
        polygon.some(
          (vertex, index) =>
            pointSegmentDistance(
              point,
              vertex,
              polygon[(index + 1) % polygon.length]
            ) <= tolerance
        )
      const packetCoversLocalPoint = (point: { x: number; y: number }) =>
        metadata.boundaryDomainPackets.some((packet) =>
          packet.polygons.some(
            (polygon) =>
              insidePolygon(point, polygon) || onPolygonBoundary(point, polygon)
          )
        )
      const getPacketSplitRangeIds = (packet: {
        figmaLikeSplitRangeId: string | null
        figmaLikeSplitRangeTerminals: { splitRangeId: string }[]
      }) =>
        new Set(
          [
            packet.figmaLikeSplitRangeId,
            ...packet.figmaLikeSplitRangeTerminals.map(
              (terminal) => terminal.splitRangeId
            )
          ].filter((id): id is string => typeof id === 'string')
        )
      const getCoveringSplitRangeIds = (point: { x: number; y: number }) => {
        const ids = new Set<string>()
        for (const packet of metadata.boundaryDomainPackets) {
          const isCovered = packet.polygons.some(
            (polygon) =>
              insidePolygon(point, polygon) || onPolygonBoundary(point, polygon)
          )
          if (!isCovered) continue
          for (const id of getPacketSplitRangeIds(packet)) {
            ids.add(id)
          }
        }
        return ids
      }
      const toScreenPoint = (point: { x: number; y: number }) => ({
        x: Math.round(
          (selectedRect.x + point.x) * metadata.zoom + metadata.viewport.x
        ),
        y: Math.round(
          (selectedRect.y + point.y) * metadata.zoom + metadata.viewport.y
        )
      })
      const isRedStrokePixel = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false
        const index = (y * width + x) * 4
        const r = actualData[index]
        const g = actualData[index + 1]
        const b = actualData[index + 2]
        const a = actualData[index + 3]
        return a > 120 && r > 90 && r > g * 1.45 && r > b * 1.45
      }
      const countRedPixelsNearLocalPoint = (
        point: { x: number; y: number },
        radius: number
      ) => {
        const screenPoint = toScreenPoint(point)
        let redCount = 0
        for (
          let y = screenPoint.y - radius;
          y <= screenPoint.y + radius;
          y += 1
        ) {
          for (
            let x = screenPoint.x - radius;
            x <= screenPoint.x + radius;
            x += 1
          ) {
            if (
              (x - screenPoint.x) ** 2 + (y - screenPoint.y) ** 2 >
              radius ** 2
            ) {
              continue
            }
            if (isRedStrokePixel(x, y)) {
              redCount += 1
            }
          }
        }
        return redCount
      }
      const getLengthTable = (points: { x: number; y: number }[]) => {
        const cumulative = [0]
        for (let index = 1; index < points.length; index += 1) {
          const previous = points[index - 1]
          const current = points[index]
          cumulative.push(
            cumulative[index - 1] +
              Math.hypot(current.x - previous.x, current.y - previous.y)
          )
        }
        return cumulative
      }
      const sourceLengthTable = getLengthTable(sourcePath)
      const sourceTotalLength =
        sourceLengthTable[sourceLengthTable.length - 1] ?? 0
      const getPathSample = (
        points: { x: number; y: number }[],
        cumulative: number[],
        distance: number
      ) => {
        const totalLength = cumulative[cumulative.length - 1] ?? 0
        const clampedDistance = Math.max(0, Math.min(totalLength, distance))
        for (let index = 1; index < points.length; index += 1) {
          const startDistance = cumulative[index - 1]
          const endDistance = cumulative[index]
          if (clampedDistance > endDistance && index < points.length - 1) {
            continue
          }
          const start = points[index - 1]
          const end = points[index]
          const length = Math.max(1e-6, endDistance - startDistance)
          const t = (clampedDistance - startDistance) / length
          const dx = end.x - start.x
          const dy = end.y - start.y
          const tangentLength = Math.max(1e-6, Math.hypot(dx, dy))
          return {
            point: {
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            },
            tangent: { x: dx / tangentLength, y: dy / tangentLength }
          }
        }
        return null
      }
      const getRecordPath = (record: {
        boundaryPoints?: { x: number; y: number }[]
      }) => {
        const boundaryPoints = Array.isArray(record.boundaryPoints)
          ? record.boundaryPoints
          : []
        return boundaryPoints.length >= 2 ? boundaryPoints : sourcePath
      }
      const getRecordSample = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        distance: number
      ) => {
        const points = getRecordPath(record)
        return getPathSample(points, getLengthTable(points), distance)
      }
      const countRedNearRecordDistance = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        distance: number,
        selectedSide: 1 | -1 | null,
        radius = 6
      ) => {
        const sample = getRecordSample(record, distance)
        if (!sample) {
          return { maxRedPixels: 0, probes: [] }
        }
        const offsets = [2.5, 5, 7.5]
        const sides =
          selectedSide === 1 || selectedSide === -1 ? [selectedSide] : [-1, 1]
        const probes = offsets.flatMap((offset) =>
          sides.map((side) => {
            const point = {
              x: sample.point.x - sample.tangent.y * offset * side,
              y: sample.point.y + sample.tangent.x * offset * side
            }
            return {
              point,
              redPixelCount: countRedPixelsNearLocalPoint(point, radius)
            }
          })
        )
        return {
          maxRedPixels: Math.max(
            0,
            ...probes.map((probe) => probe.redPixelCount)
          ),
          probes
        }
      }
      const countSameSplitRangeCoverageNearRecordDistance = (
        record: { boundaryPoints?: { x: number; y: number }[] },
        splitRangeId: string,
        distance: number,
        selectedSide: 1 | -1 | null
      ) => {
        const sample = getRecordSample(record, distance)
        if (!sample) {
          return {
            sameSplitRangeCovered: false,
            sameSplitRangeProbes: []
          }
        }
        const offsets = [2.5, 5, 7.5]
        const sides =
          selectedSide === 1 || selectedSide === -1 ? [selectedSide] : [-1, 1]
        const sameSplitRangeProbes = offsets.flatMap((offset) =>
          sides.map((side) => {
            const point = {
              x: sample.point.x - sample.tangent.y * offset * side,
              y: sample.point.y + sample.tangent.x * offset * side
            }
            const coveringSplitRangeIds = getCoveringSplitRangeIds(point)
            return {
              point,
              packetCovered: coveringSplitRangeIds.has(splitRangeId),
              otherSplitRangeCovered: [...coveringSplitRangeIds].some(
                (id) => id !== splitRangeId
              )
            }
          })
        )
        return {
          sameSplitRangeCovered: sameSplitRangeProbes.some(
            (probe) => probe.packetCovered
          ),
          otherSplitRangeCovered: sameSplitRangeProbes.some(
            (probe) => probe.otherSplitRangeCovered
          ),
          sameSplitRangeProbes
        }
      }
      const terminalRecords = metadata.boundaryDomainPackets.flatMap((packet) =>
        packet.figmaLikeSplitRangeTerminals.map((terminal) => ({
          ...terminal,
          boundaryPoints:
            terminal.boundaryPoints && terminal.boundaryPoints.length >= 2
              ? terminal.boundaryPoints
              : packet.figmaLikeBoundaryPoints,
          boundaryStartDistance:
            terminal.boundaryStartDistance ??
            packet.figmaLikeBoundaryStartDistance,
          boundaryEndDistance:
            terminal.boundaryEndDistance ?? packet.figmaLikeBoundaryEndDistance,
          boundaryTotalLength:
            terminal.boundaryTotalLength ?? packet.figmaLikeBoundaryTotalLength,
          packetGeometryId: packet.geometryId
        }))
      )
      const uniqueTerminalRecords = [
        ...new Map(
          terminalRecords.map((terminal) => [
            [
              terminal.intervalId,
              terminal.splitRangeId,
              terminal.terminalRole,
              terminal.startDistance,
              terminal.endDistance
            ].join(':'),
            terminal
          ])
        ).values()
      ]
      const recordsBySplitRange = new Map<
        string,
        typeof uniqueTerminalRecords
      >()
      uniqueTerminalRecords.forEach((record) => {
        recordsBySplitRange.set(record.splitRangeId, [
          ...(recordsBySplitRange.get(record.splitRangeId) ?? []),
          record
        ])
      })
      const splitRangeSideConsistencyFailures = [
        ...recordsBySplitRange.entries()
      ].flatMap(([splitRangeId, records]) => {
        const sides = [
          ...new Set(
            records
              .map((record) => record.selectedSide)
              .filter((side): side is 1 | -1 => side === 1 || side === -1)
          )
        ]
        return sides.length <= 1 ? [] : [{ splitRangeId, sides }]
      })
      const getTerminalBoundaryPoint = (
        record: (typeof uniqueTerminalRecords)[number],
        edge: 'start' | 'end'
      ) => {
        const points = getRecordPath(record)
        if (points.length === 0) return null
        return edge === 'start' ? points[0] : points[points.length - 1]
      }
      const isIntersectionSplitBoundaryTerminal = (
        record: (typeof uniqueTerminalRecords)[number],
        edge: 'start' | 'end'
      ) => {
        const point = getTerminalBoundaryPoint(record, edge)
        if (!point) return false
        const samePointTolerance = 1.5
        const isAuthoredAnchor = sourceAnchorPoints.some(
          (anchor) =>
            Math.hypot(anchor.x - point.x, anchor.y - point.y) <=
            samePointTolerance
        )
        if (isAuthoredAnchor) return false
        return uniqueTerminalRecords.some((candidate) =>
          (['start', 'end'] as const).some((candidateEdge) => {
            if (candidate.splitRangeId === record.splitRangeId) return false
            const candidatePoint = getTerminalBoundaryPoint(
              candidate,
              candidateEdge
            )
            return (
              candidatePoint !== null &&
              Math.hypot(
                candidatePoint.x - point.x,
                candidatePoint.y - point.y
              ) <= samePointTolerance
            )
          })
        )
      }
      const isSmoothContinuityBoundaryPoint = (point: {
        x: number
        y: number
      }) => {
        const samePointTolerance = 1.5
        return smoothContinuityAnchorPoints.some(
          (anchor) =>
            Math.hypot(anchor.x - point.x, anchor.y - point.y) <=
            samePointTolerance
        )
      }
      const isSmoothContinuitySplitRangeEdge = (
        records: typeof uniqueTerminalRecords,
        rangeDistance: number
      ) => {
        const sampleRecord = records[0]
        const sample = sampleRecord
          ? getRecordSample(sampleRecord, rangeDistance)
          : null
        return sample ? isSmoothContinuityBoundaryPoint(sample.point) : false
      }
      const dashPattern = [27, 20]
      const expectedHalfDash = dashPattern[0] / 2
      const distributionFailures = [...recordsBySplitRange.entries()].flatMap(
        ([splitRangeId, records]) => {
          const sorted = records
            .slice()
            .sort((left, right) => left.startDistance - right.startDistance)
          const rangeStart = Math.min(
            ...sorted.map((record) => record.splitRangeStartDistance)
          )
          const rangeEnd = Math.max(
            ...sorted.map((record) => record.splitRangeEndDistance)
          )
          const rangeLength = rangeEnd - rangeStart
          const failures: string[] = []
          if (rangeLength <= dashPattern[0] + 1e-4) {
            const startEnd = sorted.find(
              (record) => record.terminalRole === 'start-end'
            )
            if (!startEnd) failures.push('missing-short-range-start-end')
          } else {
            const start = sorted.find(
              (record) => record.terminalRole === 'start'
            )
            const end = sorted.find((record) => record.terminalRole === 'end')
            const startIsSmoothContinuity = isSmoothContinuitySplitRangeEdge(
              sorted,
              rangeStart
            )
            const endIsSmoothContinuity = isSmoothContinuitySplitRangeEdge(
              sorted,
              rangeEnd
            )
            if (!start && !startIsSmoothContinuity) {
              failures.push('missing-start-terminal')
            } else if (
              start &&
              (Math.abs(start.startDistance - rangeStart) > 1e-4 ||
                Math.abs(
                  start.endDistance - start.startDistance - expectedHalfDash
                ) > 1e-4)
            ) {
              failures.push('start-terminal-not-half-dash')
            }
            if (!end && !endIsSmoothContinuity) {
              failures.push('missing-end-terminal')
            } else if (
              end &&
              (Math.abs(end.endDistance - rangeEnd) > 1e-4 ||
                Math.abs(
                  end.endDistance - end.startDistance - expectedHalfDash
                ) > 1e-4)
            ) {
              failures.push('end-terminal-not-half-dash')
            }
            sorted
              .filter((record) => record.terminalRole === 'middle')
              .forEach((record) => {
                if (
                  Math.abs(
                    record.endDistance - record.startDistance - dashPattern[0]
                  ) > 1e-4
                ) {
                  failures.push('middle-dash-not-authored-dash-length')
                }
              })
            const gaps = sorted.slice(0, -1).flatMap((record, index) => {
              const next = sorted[index + 1]
              return next ? [next.startDistance - record.endDistance] : []
            })
            const positiveGaps = gaps.filter((gap) => gap > 1e-4)
            const firstGap = positiveGaps[0]
            if (firstGap !== undefined) {
              positiveGaps.forEach((gap) => {
                if (Math.abs(gap - firstGap) > 1e-4) {
                  failures.push('split-range-gaps-not-evenly-distributed')
                }
              })
            }
          }
          return failures.length > 0
            ? [
                {
                  splitRangeId,
                  rangeStart,
                  rangeEnd,
                  records: sorted,
                  failures
                }
              ]
            : []
        }
      )
      const terminalProbeResults = uniqueTerminalRecords
        .filter((record) =>
          ['start', 'end', 'start-end'].includes(record.terminalRole)
        )
        .filter(
          (record) =>
            typeof record.boundaryTotalLength !== 'number' ||
            record.boundaryTotalLength >= 4
        )
        .map((record) => {
          const distance = (record.startDistance + record.endDistance) / 2
          return {
            ...record,
            distance,
            ...countRedNearRecordDistance(record, distance, record.selectedSide)
          }
        })
      const oppositeSideProbeResults =
        expectedPosition === 'outside'
          ? uniqueTerminalRecords.map((record) => {
              const distance = (record.startDistance + record.endDistance) / 2
              const oppositeSide =
                record.selectedSide === 1
                  ? (-1 as const)
                  : record.selectedSide === -1
                    ? (1 as const)
                    : null
              return {
                ...record,
                distance,
                ...countRedNearRecordDistance(
                  record,
                  distance,
                  oppositeSide,
                  3
                ),
                ...countSameSplitRangeCoverageNearRecordDistance(
                  record,
                  record.splitRangeId,
                  distance,
                  oppositeSide
                )
              }
            })
          : []
      const terminalBoundaryProbeResults = uniqueTerminalRecords
        .filter((record) =>
          ['start', 'end', 'start-end'].includes(record.terminalRole)
        )
        .filter(
          (record) =>
            typeof record.boundaryTotalLength !== 'number' ||
            record.boundaryTotalLength >= 4
        )
        .flatMap((record) => {
          const intervalLength = record.endDistance - record.startDistance
          const edgeInset = Math.min(2, Math.max(0.5, intervalLength / 4))
          const probeDistances =
            record.terminalRole === 'start-end'
              ? [
                  {
                    edge: 'start',
                    distance: record.startDistance + edgeInset
                  },
                  {
                    edge: 'end',
                    distance: record.endDistance - edgeInset
                  }
                ]
              : record.terminalRole === 'start'
                ? [
                    {
                      edge: 'start',
                      distance: record.startDistance + edgeInset
                    }
                  ]
                : [
                    {
                      edge: 'end',
                      distance: record.endDistance - edgeInset
                    }
                  ]
          return probeDistances.map((probe) => ({
            ...record,
            terminalBoundaryEdge: probe.edge,
            terminalBoundaryDistance: probe.distance,
            intersectionSplitBoundary: isIntersectionSplitBoundaryTerminal(
              record,
              probe.edge
            ),
            ...countSameSplitRangeCoverageNearRecordDistance(
              record,
              record.splitRangeId,
              probe.distance,
              record.selectedSide
            ),
            ...countRedNearRecordDistance(
              record,
              probe.distance,
              record.selectedSide,
              2
            )
          }))
        })
      const pixelProbeTerminalRecords = uniqueTerminalRecords.filter(
        (record) =>
          typeof record.boundaryTotalLength !== 'number' ||
          record.boundaryTotalLength >= 4
      )
      const visibleDashProbeResults = pixelProbeTerminalRecords.map(
        (record) => {
          const distance = (record.startDistance + record.endDistance) / 2
          return {
            ...record,
            distance,
            ...countRedNearRecordDistance(record, distance, record.selectedSide)
          }
        }
      )
      const intervalContinuityProbeResults = pixelProbeTerminalRecords.map(
        (record) => {
          const intervalLength = record.endDistance - record.startDistance
          const isAuthoredPathStart =
            record.terminalRole === 'start' && record.startDistance <= 1e-4
          const isAuthoredPathEnd =
            record.terminalRole === 'end' &&
            record.endDistance >= sourceTotalLength - 1e-4
          const edgeInset = Math.min(
            Math.max(2, Math.min(4, intervalLength / 3)),
            Math.max(0.25, intervalLength * 0.4)
          )
          const probeDistances =
            intervalLength <= edgeInset * 2 + 0.5
              ? [(record.startDistance + record.endDistance) / 2]
              : [
                  record.startDistance + edgeInset,
                  (record.startDistance + record.endDistance) / 2,
                  record.endDistance - edgeInset
                ]
          const probeResults = probeDistances.map((distance) => ({
            distance,
            ...countRedNearRecordDistance(
              record,
              distance,
              record.selectedSide,
              2
            )
          }))
          const redRuns = probeResults.reduce(
            (state, probe) => {
              const covered = probe.maxRedPixels >= 2
              return {
                previousCovered: covered,
                runCount:
                  covered && !state.previousCovered
                    ? state.runCount + 1
                    : state.runCount
              }
            },
            { previousCovered: false, runCount: 0 }
          ).runCount
          return {
            ...record,
            shouldCheckContinuity: !isAuthoredPathStart && !isAuthoredPathEnd,
            probeResults,
            coveredProbeCount: probeResults.filter(
              (probe) => probe.maxRedPixels >= 2
            ).length,
            redRuns
          }
        }
      )
      const terminalAdjacentGapProbeResults = strictTerminalAdjacentGap
        ? [...recordsBySplitRange.entries()].flatMap(
            ([splitRangeId, records]) => {
              const sorted = records
                .slice()
                .sort((left, right) => left.startDistance - right.startDistance)
              return sorted.flatMap((record, index) => {
                const next = sorted[index + 1]
                const gapLength = next
                  ? next.startDistance - record.endDistance
                  : 0
                if (!next || gapLength < 4) {
                  return []
                }
                const selectedSide = record.selectedSide ?? next.selectedSide
                const gapInset = Math.min(2.5, gapLength / 3)
                return [
                  {
                    splitRangeId,
                    probeKind: 'after-terminal-end',
                    afterIntervalId: record.intervalId,
                    beforeIntervalId: next.intervalId,
                    distance: record.endDistance + gapInset,
                    ...countSameSplitRangeCoverageNearRecordDistance(
                      record,
                      splitRangeId,
                      record.endDistance + gapInset,
                      selectedSide
                    ),
                    ...countRedNearRecordDistance(
                      record,
                      record.endDistance + gapInset,
                      selectedSide,
                      2
                    )
                  },
                  {
                    splitRangeId,
                    probeKind: 'before-next-terminal-start',
                    afterIntervalId: record.intervalId,
                    beforeIntervalId: next.intervalId,
                    distance: next.startDistance - gapInset,
                    ...countSameSplitRangeCoverageNearRecordDistance(
                      next,
                      splitRangeId,
                      next.startDistance - gapInset,
                      selectedSide
                    ),
                    ...countRedNearRecordDistance(
                      next,
                      next.startDistance - gapInset,
                      selectedSide,
                      2
                    )
                  }
                ]
              })
            }
          )
        : []
      const rhythmProbeResults = strictTerminalAdjacentGap
        ? [...recordsBySplitRange.entries()].flatMap(
            ([splitRangeId, records]) => {
              const sorted = records
                .slice()
                .sort((left, right) => left.startDistance - right.startDistance)
              if (sorted.length === 0) {
                return []
              }
              const makeProbe = (
                record: (typeof uniqueTerminalRecords)[number],
                distance: number,
                expectedVisible: boolean,
                intervalId: string | null,
                terminalRole: string | null
              ) => {
                const sameRangeCoverage =
                  countSameSplitRangeCoverageNearRecordDistance(
                    record,
                    splitRangeId,
                    distance,
                    null
                  )
                const redCoverage = countRedNearRecordDistance(
                  record,
                  distance,
                  null,
                  2
                )
                const covered =
                  sameRangeCoverage.sameSplitRangeCovered &&
                  redCoverage.maxRedPixels >= 2
                return {
                  splitRangeId,
                  distance,
                  expectedVisible,
                  intervalId,
                  terminalRole,
                  covered,
                  redPixelCount: redCoverage.maxRedPixels,
                  sameRangeCoverage
                }
              }
              const visibleProbes = sorted
                .filter(
                  (record) =>
                    typeof record.boundaryTotalLength !== 'number' ||
                    record.boundaryTotalLength >= 4
                )
                .map((record) =>
                  makeProbe(
                    record,
                    (record.startDistance + record.endDistance) / 2,
                    true,
                    record.intervalId,
                    record.terminalRole
                  )
                )
              return visibleProbes
            }
          )
        : []
      const rhythmProbeFailures = rhythmProbeResults.filter((result) =>
        result.expectedVisible ? !result.covered : result.covered
      )
      const expectedGapProbes: {
        id: string
        point: { x: number; y: number }
      }[] = []
      const requiredSelectedSides = [
        ...new Set(
          terminalProbeResults
            .map((result) => result.selectedSide)
            .filter((side): side is 1 | -1 => side === 1 || side === -1)
        )
      ]
      const coverageResults = requiredSelectedSides.map((side) => {
        const sideTerminalResults = terminalProbeResults.filter(
          (result) => result.selectedSide === side
        )
        return {
          id: `implicit-fill-hole-selected-side-${side}`,
          selectedSide: side,
          minRedPixels: 8,
          packetCovered: sideTerminalResults.length > 0,
          redPixelCount: Math.max(
            0,
            ...sideTerminalResults.map((result) => result.maxRedPixels)
          )
        }
      })
      const gapResults = expectedGapProbes.map((probe) => ({
        ...probe,
        packetCovered: packetCoversLocalPoint(probe.point),
        redPixelCount: countRedPixelsNearLocalPoint(probe.point, 8)
      }))
      const intervalPacketFailures = metadata.boundaryDomainPackets.filter(
        (packet) =>
          packet.polygonCount === 0 ||
          packet.sourceTopology !== 'self-intersecting' ||
          packet.finalCoverageBuilderStatus !== 'product-final' ||
          packet.debugIntervalId?.startsWith('interval:') !== true ||
          packet.intervalIds.some(
            (intervalId) => !intervalId.startsWith('interval:')
          )
      )
      return {
        width,
        height,
        coverageResults,
        gapResults,
        coverageProbeFailures: coverageResults.filter(
          (result) =>
            !result.packetCovered || result.redPixelCount < result.minRedPixels
        ),
        intervalPacketFailureCount: intervalPacketFailures.length,
        intervalPacketFailures: intervalPacketFailures.slice(0, 5),
        terminalProbeFailures: terminalProbeResults.filter(
          (result) => result.maxRedPixels < 8
        ),
        terminalBoundaryProbeFailures: terminalBoundaryProbeResults.filter(
          (result) =>
            result.intersectionSplitBoundary &&
            ((!result.sameSplitRangeCovered &&
              !result.otherSplitRangeCovered) ||
              result.maxRedPixels < 2)
        ),
        visibleDashProbeFailures: visibleDashProbeResults.filter(
          (result) => result.maxRedPixels < 8
        ),
        splitRangeSideConsistencyFailures,
        intervalContinuityFailures: intervalContinuityProbeResults.filter(
          (result) => {
            const requiredCoveredProbeCount = Math.min(
              result.probeResults.length,
              2
            )
            return (
              result.shouldCheckContinuity &&
              (result.coveredProbeCount < requiredCoveredProbeCount ||
                result.redRuns !== 1)
            )
          }
        ),
        distributionFailures,
        terminalProbeResults,
        holeTerminalProbeResults: terminalProbeResults.filter(
          (result) => result.boundaryRole === 'hole'
        ),
        filledFaceTerminalProbeResults: terminalProbeResults.filter(
          (result) => result.boundaryRole === 'filled-face'
        ),
        oppositeSideProbeResults,
        oppositeSideProbeHits: oppositeSideProbeResults.filter(
          (result) => result.sameSplitRangeCovered && result.maxRedPixels >= 8
        ),
        terminalBoundaryProbeResults,
        visibleDashProbeResults,
        intervalContinuityProbeResults,
        terminalAdjacentGapProbeResults,
        terminalAdjacentGapHits: terminalAdjacentGapProbeResults.filter(
          (result) =>
            result.maxRedPixels >= 8 &&
            result.sameSplitRangeCovered &&
            !result.otherSplitRangeCovered
        ),
        rhythmProbeResults,
        rhythmProbeFailures,
        packetCount: metadata.boundaryDomainPackets.length
      }
    },
    {
      actualDataUrl: `data:image/png;base64,${actual.toString('base64')}`,
      metadata,
      sourcePath,
      sourceAnchorPoints: SELF_CHECK_SOURCE_ANCHOR_POINTS,
      smoothContinuityAnchorPoints: SELF_CHECK_SMOOTH_CONTINUITY_ANCHOR_POINTS,
      strictTerminalAdjacentGap: options.strictTerminalAdjacentGap === true,
      capType: options.capType,
      expectedPosition: options.expectedPosition
    }
  )

export const compareRightBottomHighCurvatureSmoothTerminalPixels = async (
  page: Page,
  first: Buffer,
  second: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  options: {
    sourceAnchor?: Vec2
    radius?: number
  } = {}
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl, metadata, options }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for join pixel oracle')
      }

      context.drawImage(firstImage, 0, 0)
      const firstPixels = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondPixels = context.getImageData(0, 0, width, height).data

      const selectedRect = metadata.selectedRect
      if (!selectedRect) {
        throw new Error('Missing selected rect for join pixel oracle')
      }

      const sourceAnchor = options.sourceAnchor ?? {
        x: 270.59180204238254,
        y: 347.0603956649177
      }
      const screenAnchor = {
        x:
          (selectedRect.x + sourceAnchor.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (selectedRect.y + sourceAnchor.y) * metadata.zoom +
          metadata.viewport.y
      }
      const radius = options.radius ?? 72
      const isRedStrokePixel = (pixels: Uint8ClampedArray, index: number) => {
        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]
        const a = pixels[index + 3]
        return a > 120 && r > 90 && r > g * 1.25 && r > b * 1.25
      }

      let comparedPixelCount = 0
      let changedPixelCount = 0
      let changedRgbaPixelCount = 0
      let totalRgbaDifference = 0
      let firstRedCount = 0
      let secondRedCount = 0
      let fullImageChangedPixelCount = 0
      let fullImageRgbaChangedPixelCount = 0
      const changedBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      const rgbaChangedBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      for (let index = 0; index < firstPixels.length; index += 4) {
        const firstRed = isRedStrokePixel(firstPixels, index)
        const secondRed = isRedStrokePixel(secondPixels, index)
        const rgbaDifference =
          Math.abs(firstPixels[index] - secondPixels[index]) +
          Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
          Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
          Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
        if (firstRed !== secondRed) {
          const pixelIndex = index / 4
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          fullImageChangedPixelCount += 1
          changedBounds.minX = Math.min(changedBounds.minX, x)
          changedBounds.minY = Math.min(changedBounds.minY, y)
          changedBounds.maxX = Math.max(changedBounds.maxX, x)
          changedBounds.maxY = Math.max(changedBounds.maxY, y)
        }
        if (rgbaDifference > 8) {
          const pixelIndex = index / 4
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          fullImageRgbaChangedPixelCount += 1
          rgbaChangedBounds.minX = Math.min(rgbaChangedBounds.minX, x)
          rgbaChangedBounds.minY = Math.min(rgbaChangedBounds.minY, y)
          rgbaChangedBounds.maxX = Math.max(rgbaChangedBounds.maxX, x)
          rgbaChangedBounds.maxY = Math.max(rgbaChangedBounds.maxY, y)
        }
      }
      for (
        let y = Math.max(0, Math.floor(screenAnchor.y - radius));
        y <= Math.min(height - 1, Math.ceil(screenAnchor.y + radius));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(screenAnchor.x - radius));
          x <= Math.min(width - 1, Math.ceil(screenAnchor.x + radius));
          x += 1
        ) {
          if (
            (x - screenAnchor.x) ** 2 + (y - screenAnchor.y) ** 2 >
            radius ** 2
          ) {
            continue
          }
          const index = (y * width + x) * 4
          const firstRed = isRedStrokePixel(firstPixels, index)
          const secondRed = isRedStrokePixel(secondPixels, index)
          const rgbaDifference =
            Math.abs(firstPixels[index] - secondPixels[index]) +
            Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
            Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
            Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
          comparedPixelCount += 1
          firstRedCount += firstRed ? 1 : 0
          secondRedCount += secondRed ? 1 : 0
          changedPixelCount += firstRed !== secondRed ? 1 : 0
          if (rgbaDifference > 8) {
            changedRgbaPixelCount += 1
            totalRgbaDifference += rgbaDifference
          }
        }
      }

      return {
        comparedPixelCount,
        changedPixelCount,
        changedRgbaPixelCount,
        totalRgbaDifference,
        fullImageChangedPixelCount,
        fullImageRgbaChangedPixelCount,
        changedBounds: fullImageChangedPixelCount > 0 ? changedBounds : null,
        rgbaChangedBounds:
          fullImageRgbaChangedPixelCount > 0 ? rgbaChangedBounds : null,
        firstRedCount,
        secondRedCount,
        screenAnchor
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`,
      metadata,
      options
    }
  )
