import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  FillKinds,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import {
  buildConstrainedSolidDoubledCenterProductUnits,
  hasConstrainedSolidStrokeIntent
} from '../../components/stroke-render/constrained-solid-stroke-packets'

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
const constrainedSolidSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts'
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

const points = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 }
]

const expectPreLegalityOnly = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'finalFaces',
    'renderEntries',
    'strokeMaskPolygons',
    'fillClipPolygons',
    'fillExcludePolygons',
    'renderCover',
    'faceStrip',
    'clippedAngle',
    'resolvedJoin',
    'vertexAngle',
    'angleSource',
    'miterAngle'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 26: build-constrained-solid-products', () => {
  it('keeps build-constrained-solid-products as the current or verified twenty-sixth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-constrained-solid-products'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-constrained-solid-products'
      ])
    }
  })

  it('declares the exact constrained solid implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-constrained-solid-products'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry constrained solid product assembly',
      allowedInputs: [
        'selected constrained solid product family',
        'normalized stroke spec',
        'StrokeDomainPlan legal side'
      ],
      requiredOutputs: [
        'pre-legality constrained solid doubled-center product units'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-geometry.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'face strip as visible product',
        'render cover polygon',
        'clipped legal-side angle as miter source'
      ])
    )
  })

  it('builds pre-legality doubled-center product units for constrained solid strokes', () => {
    const stroke = createDefaultStroke({
      id: 'stroke:inside-solid',
      style: StrokeStyles.SOLID,
      position: StrokePositions.INSIDE,
      width: 12,
      joinType: StrokeJoinTypes.BEVEL,
      fill: {
        kind: FillKinds.SOLID,
        color: '#707070',
        opacity: 1,
        visible: true
      }
    })

    expect(hasConstrainedSolidStrokeIntent([stroke])).toBe(true)
    const units = buildConstrainedSolidDoubledCenterProductUnits({
      cachePrefix: 'step-26:inside-solid',
      points,
      closed: true,
      strokes: [stroke],
      productFamilyId: 'constrained-solid',
      legalSideId: 'legal-side:inside',
      metadata: {
        ownerKeyPrefix: 'vector:step-26',
        networkId: 'network:constrained-solid'
      }
    })

    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({
      productId: 'step-26:inside-solid:0:pre-legality',
      productFamilyId: 'constrained-solid',
      productMode: 'pre-legality-constrained-solid-doubled-center',
      geometryBasis: 'doubled-authored-center-stroke',
      legalSideId: 'legal-side:inside',
      strokePosition: 'inside',
      sourceStrokeWidth: 12,
      doubledCenterStrokeWidth: 24,
      ownerStage: 'Stroke Geometry constrained solid product assembly'
    })
    expect(units[0].polygons.length).toBeGreaterThan(0)
    expectPreLegalityOnly(units)
  })

  it('rejects non-constrained or dashed strokes without fallback product output', () => {
    const centerStroke = createDefaultStroke({
      id: 'stroke:center',
      style: StrokeStyles.SOLID,
      position: StrokePositions.CENTER,
      width: 12
    })
    const dashedStroke = createDefaultStroke({
      id: 'stroke:dashed',
      style: StrokeStyles.DASHED,
      position: StrokePositions.OUTSIDE,
      width: 12
    })

    expect(
      buildConstrainedSolidDoubledCenterProductUnits({
        cachePrefix: 'step-26:reject',
        points,
        closed: true,
        strokes: [centerStroke, dashedStroke],
        productFamilyId: 'constrained-solid',
        legalSideId: 'legal-side:outside'
      })
    ).toEqual([])
  })

  it('keeps the constrained solid pre-legality helper free of legality masks and render repair', () => {
    const source = readFileSync(constrainedSolidSourcePath, 'utf8')
    const helperSource = extractBetween(
      source,
      'export const buildConstrainedSolidDoubledCenterProductUnits = (',
      'export const buildConstrainedSolidStrokeResolvedPackets = ('
    )

    expect(helperSource).toContain('buildSolidCenterStrokePolygons(')
    expect(helperSource).toContain(
      'const doubledCenterStrokeWidth = stroke.width * 2'
    )
    expect(helperSource).toContain('width: doubledCenterStrokeWidth')
    expect(helperSource).toContain('miterAngle: stroke.miterAngle')
    for (const forbiddenToken of [
      'strokeMaskPolygons',
      'fillClipPolygons',
      'fillExcludePolygons',
      'renderCover',
      'faceStrip',
      'clipped',
      'renderSolidCenterStrokeEntries',
      'toSolidCenterStrokeRenderEntriesFromFinalFaces',
      'buildSolidCenterStrokeFinalFaces',
      'resolvedJoin',
      'vertexAngle',
      'angleSource'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-constrained-solid-products')
  })
})
