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
  buildSolidCenterStrokeResolvedPackets,
  hasSolidCenterStrokeIntent
} from '../../components/stroke-render/solid-center-stroke-packets'

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
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
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
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts'
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

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-center-stroke-products')
  })
})
