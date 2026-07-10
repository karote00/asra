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
  createDefaultStroke
} from '@asyra/utils'
import { normalizeStrokeSpec } from '../../components/stroke-render/renderable-stroke'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
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
const renderableStrokeSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/renderable-stroke.ts'
)
const vectorComponentSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/vector.ts'
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

describe('stroke flow step 19: normalize-stroke-spec', () => {
  it('keeps normalize-stroke-spec as the current or verified nineteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'normalize-stroke-spec'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'normalize-stroke-spec'
      ])
    }
  })

  it('declares authored stroke spec normalization as the exact implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'normalize-stroke-spec'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: ['raw stroke list from normalized render data'],
      requiredOutputs: [
        'renderable stroke list',
        'empty render product for finite width <= 0',
        'stroke spec rejection diagnostics'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/renderable-stroke.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('preserves authored join choices without resolving source-domain miter geometry', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:miter',
        joinType: StrokeJoinTypes.MITER,
        capType: StrokeCapTypes.ROUND,
        miterAngle: 30,
        width: 12,
        fill: {
          kind: FillKinds.SOLID,
          color: '#ff0000',
          opacity: 0.5,
          visible: true
        }
      }),
      createDefaultStroke({
        id: 'stroke:bevel',
        joinType: StrokeJoinTypes.BEVEL,
        capType: StrokeCapTypes.SQUARE,
        miterAngle: 45,
        width: 12
      }),
      createDefaultStroke({
        id: 'stroke:round',
        joinType: StrokeJoinTypes.ROUND,
        capType: StrokeCapTypes.BUTT,
        miterAngle: 60,
        width: 12
      })
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.strokes.map((stroke) => stroke.join)).toEqual([
      'miter',
      'bevel',
      'round'
    ])
    expect(result.strokes[0]).toMatchObject({
      cap: 'round',
      miterAngle: 30,
      color: 0xff0000,
      alpha: 0.5
    })
    expect(result.strokes[0].miterLimit).toBeCloseTo(1 / Math.sin(Math.PI / 12))
    for (const stroke of result.strokes) {
      expect(stroke).not.toHaveProperty('resolvedJoin')
      expect(stroke).not.toHaveProperty('vertexAngle')
      expect(stroke).not.toHaveProperty('angleSource')
    }
  })

  it('normalizes dash and gap lengths without owning dash interval allocation', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:dash',
        style: 'dashed',
        width: 8,
        dash: 4,
        gap: 2
      })
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.strokes[0]).toMatchObject({
      style: 'dashed',
      dash: 4,
      gap: 2
    })
  })

  it('consumes all raw stroke parameter groups into renderable stroke fields or diagnostics only', () => {
    const result = normalizeStrokeSpec([
      {
        id: 'stroke:all-params',
        type: 'stroke',
        visible: true,
        style: 'dashed',
        position: 'inside',
        width: 13,
        dash: 5,
        gap: 3,
        joinType: StrokeJoinTypes.ROUND,
        capType: StrokeCapTypes.SQUARE,
        miterAngle: 28.96,
        fill: {
          id: 'fill:all-params',
          type: 'fill',
          kind: FillKinds.SOLID,
          color: '#336699',
          opacity: 0.25,
          visible: true,
          colorFormat: 'display-p3',
          defaultColorFormat: 'hex'
        }
      }
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.strokes).toHaveLength(1)
    expect(result.strokes[0]).toMatchObject({
      style: 'dashed',
      position: 'inside',
      width: 13,
      dash: 5,
      gap: 3,
      join: 'round',
      cap: 'square',
      miterAngle: 28.96,
      kind: 'solid',
      color: 0x336699,
      alpha: 0.25,
      paintKey: 'solid:3368601:0.25'
    })
    expect(JSON.stringify(result)).not.toContain('colorFormat')
    expect(JSON.stringify(result)).not.toContain('defaultColorFormat')
    for (const forbiddenProductField of [
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderEntries'
    ]) {
      expect(result.strokes[0]).not.toHaveProperty(forbiddenProductField)
    }
  })

  it('treats finite non-positive width strokes as valid empty product without diagnostics', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:zero',
        width: 0
      }),
      createDefaultStroke({
        id: 'stroke:negative',
        width: -1
      })
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('rejects non-finite width and invalid paint strokes as diagnostics', () => {
    const result = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:nan',
        width: Number.NaN
      }),
      createDefaultStroke({
        id: 'stroke:infinite',
        width: Number.POSITIVE_INFINITY
      }),
      createDefaultStroke({
        id: 'stroke:no-paint',
        visible: true,
        width: 8,
        fill: {
          visible: false
        }
      })
    ])

    expect(result.strokes).toEqual([])
    expect(result.diagnostics).toEqual([
      { index: 0, reason: 'invalid-width', strokeId: 'stroke:nan' },
      { index: 1, reason: 'invalid-width', strokeId: 'stroke:infinite' },
      { index: 2, reason: 'invisible-paint', strokeId: 'stroke:no-paint' }
    ])
  })

  it('keeps normalization free of miter resolution, product geometry, and renderer output', () => {
    const source = readFileSync(renderableStrokeSourcePath, 'utf8')
    const vectorSource = readFileSync(vectorComponentSourcePath, 'utf8')

    expect(vectorSource).toContain(
      'const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)'
    )
    for (const forbiddenToken of [
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries(graphic, strokeRenderEntries)'
    ]) {
      expect(source).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('normalize-stroke-spec')
  })
})
