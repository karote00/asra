import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  FillKinds,
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildDashedCenterStrokeResolvedPackets,
  hasDashedCenterStrokeIntent
} from '../../components/stroke-render/dashed-center-stroke-packets'
import {
  buildDashedCenterRibbonGeometry,
  type DashedCenterRibbonFrame
} from '../../components/stroke-render/dashed-center-ribbon-geometry'
import {
  buildSolidCenterStrokeResolvedPackets,
  hasSolidCenterStrokeIntent
} from '../../components/stroke-render/solid-center-stroke-packets'
import { buildSolidCenterStrokePolygons } from '../../components/stroke-render/solid-center-stroke-geometry'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const solidPacketsSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts'
)
const dashedPacketsSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts'
)
const dashedRibbonSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const extractFrom = (source: string, start: string): string => {
  const startIndex = source.indexOf(start)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  return source.slice(startIndex)
}

const points = [
  { x: 0, y: 0 },
  { x: 80, y: 0 },
  { x: 80, y: 60 },
  { x: 0, y: 60 }
]

const expectCenterProductOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'legalDomainId',
    'selectedSideProduct',
    'strokeMaskPolygons',
    'fillClipPolygons',
    'fillExcludePolygons',
    'rendererProjection',
    'inside-outside-mask',
    'constrained-solid',
    'constrained-dashed'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

const collectSolidCenterPhaseEvidence = <T>(run: () => T) => {
  const phases: string[] = []
  const globalRecord = globalThis as typeof globalThis & {
    __asyraVectorRenderDetailPhaseSink?: (
      phaseName: string,
      durationMs: number
    ) => void
  }
  const previousSink = globalRecord.__asyraVectorRenderDetailPhaseSink
  globalRecord.__asyraVectorRenderDetailPhaseSink = (phaseName) => {
    phases.push(phaseName)
  }
  try {
    return { phases, result: run() }
  } finally {
    globalRecord.__asyraVectorRenderDetailPhaseSink = previousSink
  }
}

const fingerprintPolygons = (polygons: { x: number; y: number }[][]) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        polygons.map((polygon) =>
          polygon.map((point) => [
            Number(point.x.toFixed(6)),
            Number(point.y.toFixed(6))
          ])
        )
      )
    )
    .digest('hex')

describe('stroke flow step 25: build-center-stroke-products', () => {
  it('keeps build-center-stroke-products as the current or verified twenty-fifth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-center-stroke-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-center-stroke-products'
      ])
    }
  })

  it('declares the exact center product implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-center-stroke-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry center product assembly',
      allowedInputs: [
        'selected center product family',
        'normalized source path',
        'normalized stroke spec'
      ],
      requiredOutputs: ['center product units or exact center descriptors'],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-geometry.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'inside/outside legal mask',
        'renderer-local join repair',
        'diagnostic/helper visible geometry'
      ])
    )
  })

  it('attributes canonical segmented fallback without changing polygon output', () => {
    const build = () =>
      buildSolidCenterStrokePolygons(
        [
          { x: 0, y: 0 },
          { x: 12, y: 7 },
          { x: 20, y: -3 },
          { x: 29, y: 9 },
          { x: 40, y: 4 }
        ],
        false,
        {
          style: 'solid',
          position: 'center',
          width: 8,
          cap: 'round',
          join: 'round',
          miterAngle: 45,
          miterLimit: 4
        }
      )
    const evidence = collectSolidCenterPhaseEvidence(build)

    expect(evidence.phases).toEqual(
      expect.arrayContaining([
        'solid center stroke: source normalization',
        'solid center stroke: segment body polygons',
        'solid center stroke: source vertex join polygons',
        'solid center stroke: round cap polygons',
        'solid center stroke join polygons: metadata-free bevel',
        'solid center stroke join polygons: metadata-free round',
        'solid center stroke join polygons: full solver'
      ])
    )
    expect(evidence.result).toEqual(build())
    expect(evidence.result.length).toBeGreaterThan(4)
  })

  it.each([
    {
      join: 'miter' as const,
      expected:
        '40a7a19029ba9afeee624ca16c42b5cea858d0a37a1b3d3961407896f520b551'
    },
    {
      join: 'bevel' as const,
      expected:
        'efd94a4cb4af886087b9fa1479478e242f50efde71518ea34188c517d40cfb0e'
    },
    {
      join: 'round' as const,
      expected:
        '5f5591fa5b8f7cf334bb8d0bb602ec234b45e16583d727595bff3e0feea5e85c'
    }
  ])(
    'preserves the complete metadata-free $join center polygon fingerprint',
    ({ join, expected }) => {
      const polygons = buildSolidCenterStrokePolygons(
        [
          { x: 0, y: 0 },
          { x: 12, y: 7 },
          { x: 20, y: -3 },
          { x: 29, y: 9 },
          { x: 40, y: 4 }
        ],
        false,
        {
          style: 'solid',
          position: 'center',
          width: 8,
          cap: 'butt',
          join,
          miterAngle: 35,
          miterLimit: 4
        }
      )

      expect(fingerprintPolygons(polygons)).toBe(expected)
    }
  )

  it('builds solid center product units with center ownership metadata', () => {
    const stroke = createDefaultStroke({
      id: 'stroke:center-solid',
      style: StrokeStyles.SOLID,
      position: StrokePositions.CENTER,
      width: 12,
      joinType: StrokeJoinTypes.MITER,
      capType: StrokeCapTypes.ROUND,
      miterAngle: 30,
      fill: {
        kind: FillKinds.SOLID,
        color: '#808080',
        opacity: 1,
        visible: true
      }
    })

    expect(hasSolidCenterStrokeIntent([stroke])).toBe(true)
    const packets = buildSolidCenterStrokeResolvedPackets(
      'step-25:center-solid',
      points,
      true,
      [stroke],
      {
        metadata: {
          ownerKeyPrefix: 'vector:step-25',
          networkId: 'network:center'
        }
      }
    )

    expect(packets.length).toBe(1)
    expect(packets[0].geometry.polygons.length).toBeGreaterThan(0)
    expect(packets[0].geometry.debugMeta).toMatchObject({
      sourcePathId: 'step-25:center-solid',
      ownerKey: 'vector:step-25:stroke:0',
      networkId: 'network:center',
      strokePosition: 'center',
      productMode: 'center-product',
      productSignature: 'center-product:solid',
      domainMode: 'center-product'
    })
    expect(packets[0].geometry.debugMeta).toMatchObject({
      strokeCap: 'round',
      strokeJoin: 'miter',
      authoredJoin: 'miter',
      miterAngle: 30,
      strokeMiterLimit: expect.any(Number)
    })
    expect(packets[0].paint).toMatchObject({
      kind: 'solid',
      color: 0x808080,
      alpha: 1
    })
    expectCenterProductOnly(packets)
  })

  it('builds dashed center product units with interval ownership metadata', () => {
    const stroke = createDefaultStroke({
      id: 'stroke:center-dashed',
      style: StrokeStyles.DASHED,
      position: StrokePositions.CENTER,
      width: 10,
      dash: 20,
      gap: 10,
      joinType: StrokeJoinTypes.BEVEL,
      capType: StrokeCapTypes.BUTT,
      fill: {
        kind: FillKinds.SOLID,
        color: '#606060',
        opacity: 1,
        visible: true
      }
    })

    expect(hasDashedCenterStrokeIntent([stroke])).toBe(true)
    const packets = buildDashedCenterStrokeResolvedPackets(
      'step-25:center-dashed',
      points,
      false,
      [stroke],
      {
        metadata: {
          ownerKeyPrefix: 'vector:step-25',
          networkId: 'network:center-dashed'
        }
      }
    )

    expect(packets.length).toBeGreaterThan(0)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.productMode === 'center-product' &&
          packet.geometry.debugMeta?.productSignature ===
            'center-product:dashed' &&
          packet.geometry.debugMeta?.domainMode === 'center-product'
      )
    ).toBe(true)
    expect(
      packets.some((packet) => packet.geometry.debugMeta?.intervalId)
    ).toBe(true)
    expect(
      packets.every(
        (packet) =>
          packet.geometry.debugMeta?.strokeCap === 'butt' &&
          packet.geometry.debugMeta?.strokeJoin === 'bevel' &&
          packet.geometry.debugMeta?.authoredJoin === 'bevel' &&
          packet.geometry.debugMeta?.miterAngle === 28.96 &&
          Number.isFinite(packet.geometry.debugMeta?.strokeMiterLimit)
      )
    ).toBe(true)
    expectCenterProductOnly(packets)
  })

  it('preserves exact center descriptor style when descriptor output is selected', () => {
    const solidSource = readFileSync(solidPacketsSourcePath, 'utf8')
    const dashedSource = readFileSync(dashedPacketsSourcePath, 'utf8')
    const solidBuilder = extractBetween(
      solidSource,
      'export const buildSolidCenterStrokeResolvedPackets = (',
      'export const attachStrokePacketDebugMeta = ('
    )
    const dashedBuilder = extractFrom(
      dashedSource,
      'export const buildDashedCenterStrokeResolvedPackets = ('
    )

    for (const source of [solidBuilder, dashedBuilder]) {
      expect(source).toContain('strokePathStyle')
      expect(source).toContain('width: stroke.width')
      expect(source).toContain('join: stroke.join')
      expect(source).toContain('miterLimit: stroke.miterLimit')
      expect(source).toContain('closed: false')
    }
    expect(dashedBuilder).toContain('strokePathGroups')
  })

  it('keeps center product builders free of constrained masks and render projection ownership', () => {
    const solidSource = readFileSync(solidPacketsSourcePath, 'utf8')
    const dashedSource = readFileSync(dashedPacketsSourcePath, 'utf8')
    const solidBuilder = extractBetween(
      solidSource,
      'export const buildSolidCenterStrokeResolvedPackets = (',
      'export const attachStrokePacketDebugMeta = ('
    )
    const dashedBuilder = extractFrom(
      dashedSource,
      'export const buildDashedCenterStrokeResolvedPackets = ('
    )

    for (const forbiddenToken of [
      'inside/outside',
      'legalDomainClip',
      'strokeMaskPolygons',
      'fillClipPolygons',
      'fillExcludePolygons',
      'toSolidCenterStrokeRenderEntriesFromFinalFaces',
      'renderSolidCenterStrokeEntries',
      'renderer projection',
      'constrained-solid',
      'constrained-dashed'
    ]) {
      expect(solidBuilder).not.toContain(forbiddenToken)
      expect(dashedBuilder).not.toContain(forbiddenToken)
    }
  })

  it('preserves manual ribbon geometry fingerprints across caps, joins, and endpoint suppression', () => {
    const smoothPoints = [
      { x: 0, y: 0 },
      { x: 8, y: 4 },
      { x: 16, y: 7 },
      { x: 24, y: 9 },
      { x: 32, y: 10 }
    ]
    const smoothFrames: DashedCenterRibbonFrame[] = smoothPoints.map(
      (point, index) => {
        const previous = smoothPoints[index - 1] ?? point
        const next = smoothPoints[index + 1] ?? point
        return {
          point,
          tangent: {
            x: next.x - previous.x,
            y: next.y - previous.y
          }
        }
      }
    )
    const sharpFrames: DashedCenterRibbonFrame[] = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 12, y: 0 },
        tangent: { x: 1, y: 1 },
        sharpJoin: true
      },
      { point: { x: 12, y: 12 }, tangent: { x: 0, y: 1 } }
    ]
    const getFingerprint = (
      geometry: ReturnType<typeof buildDashedCenterRibbonGeometry>
    ) => ({
      validityStatus: geometry.validityStatus,
      polygons: geometry.polygons.map((polygon) => {
        const signedDoubleArea = polygon.reduce((area, point, index) => {
          const next = polygon[(index + 1) % polygon.length]
          return area + point.x * next.y - next.x * point.y
        }, 0)
        const xs = polygon.map((point) => point.x)
        const ys = polygon.map((point) => point.y)
        const round = (value: number) => Number(value.toFixed(6))
        return {
          pointCount: polygon.length,
          area: round(Math.abs(signedDoubleArea) / 2),
          bounds: {
            minX: round(Math.min(...xs)),
            minY: round(Math.min(...ys)),
            maxX: round(Math.max(...xs)),
            maxY: round(Math.max(...ys))
          }
        }
      })
    })
    const fingerprints = {
      smoothRound: getFingerprint(
        buildDashedCenterRibbonGeometry(
          smoothFrames,
          { width: 8, cap: 'round', join: 'round', miterLimit: 4 },
          { disableBackendOffset: true }
        )
      ),
      smoothRoundSuppressed: getFingerprint(
        buildDashedCenterRibbonGeometry(
          smoothFrames,
          { width: 8, cap: 'round', join: 'round', miterLimit: 4 },
          {
            disableBackendOffset: true,
            suppressStartCap: true,
            suppressEndCap: true
          }
        )
      ),
      sharpSquareMiter: getFingerprint(
        buildDashedCenterRibbonGeometry(
          sharpFrames,
          { width: 8, cap: 'square', join: 'miter', miterLimit: 4 },
          { disableBackendOffset: true }
        )
      ),
      sharpButtBevel: getFingerprint(
        buildDashedCenterRibbonGeometry(
          sharpFrames,
          { width: 8, cap: 'butt', join: 'bevel', miterLimit: 4 },
          { disableBackendOffset: true }
        )
      )
    }

    expect(fingerprints).toEqual({
      smoothRound: {
        validityStatus: 'simple-outline',
        polygons: [
          {
            pointCount: 110,
            area: 320.284316,
            bounds: {
              minX: -3.999995,
              minY: -3.998301,
              maxX: 35.998243,
              maxY: 13.999997
            }
          }
        ]
      },
      smoothRoundSuppressed: {
        validityStatus: 'simple-outline',
        polygons: [
          {
            pointCount: 10,
            area: 270.050616,
            bounds: {
              minX: -1.788854,
              minY: -3.577709,
              maxX: 32.496139,
              maxY: 13.969112
            }
          }
        ]
      },
      sharpSquareMiter: {
        validityStatus: 'simple-outline',
        polygons: [
          {
            pointCount: 6,
            area: 256,
            bounds: { minX: -4, minY: -4, maxX: 16, maxY: 16 }
          }
        ]
      },
      sharpButtBevel: {
        validityStatus: 'simple-outline',
        polygons: [
          {
            pointCount: 7,
            area: 184,
            bounds: { minX: 0, minY: -4, maxX: 16, maxY: 12 }
          }
        ]
      }
    })
  })

  it('normalizes unsuppressed manual ribbons once and keeps validation owned by the shared helper', () => {
    const source = readFileSync(dashedRibbonSourcePath, 'utf8')
    const simplifySource = extractBetween(
      source,
      'const simplifyRail = (',
      'const getFrameTangent = ('
    )
    const endpointClipSource = extractBetween(
      source,
      'const clipPolygonsToSuppressedEndpointCaps = (',
      'const toBackendCap = ('
    )
    const ribbonBuilderSource = extractBetween(
      source,
      'export const buildDashedCenterRibbonGeometry = (',
      'export const buildDashedCenterRibbonPolygons = ('
    )

    expect(endpointClipSource).toContain('if (!startTangent && !endTangent) {')
    expect(ribbonBuilderSource).toContain('normalizeOutputPolygons([outline])')
    expect(ribbonBuilderSource).not.toContain(
      'const polygon = dedupeClosed(outline)'
    )
    expect(simplifySource).toContain(
      'previousLengthSquared * nextLengthSquared'
    )
    expect(simplifySource).not.toContain('normalize(subtract(')
    expect(ribbonBuilderSource).toContain('isSimpleClosedPolygon(')
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-center-stroke-products')
  })
})
