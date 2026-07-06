import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys
} from './stroke-parameter-coverage-test-helper'
import {
  assertVectorTopologyConsistency,
  buildVectorComputedPatch
} from '../../../../../apps/asyra-design/src/common-apis/element/vector-consistency'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
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
const vectorConsistencySourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/common-apis/element/vector-consistency.ts'
)
const vectorApisSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/common-apis/element/vector-apis.ts'
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

const validTopology = {
  points: {
    'point:a': {
      id: 'point:a',
      kind: 'anchor',
      x: 10,
      y: 20,
      anchorType: 'sharp'
    },
    'point:b': {
      id: 'point:b',
      kind: 'anchor',
      x: 70,
      y: 80,
      anchorType: 'sharp'
    },
    'point:a:out': {
      id: 'point:a:out',
      kind: 'control',
      x: 30,
      y: 40,
      controlForId: 'point:a',
      controlRole: 'out'
    },
    'point:b:in': {
      id: 'point:b:in',
      kind: 'control',
      x: 50,
      y: 60,
      controlForId: 'point:b',
      controlRole: 'in'
    }
  },
  segments: {
    'segment:ab': {
      id: 'segment:ab',
      startId: 'point:a',
      endId: 'point:b',
      outControlId: 'point:a:out',
      inControlId: 'point:b:in'
    }
  },
  networks: {
    'network:main': {
      id: 'network:main',
      pointIds: ['point:a', 'point:b'],
      segmentIds: ['segment:ab'],
      closed: false
    }
  }
} as const

describe('stroke flow step 07: validate-topology', () => {
  it('keeps validate-topology as the current or verified seventh step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'validate-topology')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'validate-topology'
      ])
    }
  })

  it('accepts valid topology before computed patch construction', () => {
    expect(() =>
      assertVectorTopologyConsistency(validTopology, 'step-07-valid')
    ).not.toThrow()
    expect(() => buildVectorComputedPatch(validTopology)).not.toThrow()
  })

  it('rejects topology that has anchors without network entries', () => {
    expect(() =>
      assertVectorTopologyConsistency(
        {
          ...validTopology,
          networks: {}
        },
        'step-07-missing-network'
      )
    ).toThrow(
      '[vector-topology:step-07-missing-network] Vector topology missing network entries.'
    )
  })

  it('rejects segment endpoints that do not reference anchors', () => {
    expect(() =>
      assertVectorTopologyConsistency(
        {
          ...validTopology,
          segments: {
            'segment:ab': {
              ...validTopology.segments['segment:ab'],
              endId: 'point:missing'
            }
          }
        },
        'step-07-bad-segment'
      )
    ).toThrow(
      '[vector-topology:step-07-bad-segment] Segment segment:ab endId point:missing is not an anchor.'
    )
  })

  it('rejects invalid control references before returning computed data', () => {
    expect(() =>
      buildVectorComputedPatch({
        ...validTopology,
        points: {
          ...validTopology.points,
          'point:a:out': {
            ...validTopology.points['point:a:out'],
            controlRole: 'in'
          }
        }
      })
    ).toThrow(
      '[vector-topology:buildVectorComputedPatch] Segment segment:ab outControlId point:a:out is invalid.'
    )
  })

  it('ignores stroke-like extra fields while validating topology and building computed patches', () => {
    const topologyWithStrokeParams = {
      ...validTopology,
      stroke: {
        fill: {
          visible: true,
          kind: 'solid',
          color: '#101010',
          opacity: 0.9,
          gradient: null,
          colorFormat: 'hex',
          defaultColorFormat: 'hex'
        },
        style: 'dashed',
        position: 'outside',
        width: 18,
        dash: 12,
          gap: 6,
        capType: 'round',
        joinType: 'miter',
        miterAngle: 30
      }
    } as unknown as typeof validTopology

    expect(() =>
      assertVectorTopologyConsistency(
        topologyWithStrokeParams,
        'step-07-stroke-like-extra-fields'
      )
    ).not.toThrow()
    expect(buildVectorComputedPatch(topologyWithStrokeParams)).toEqual(
      buildVectorComputedPatch(validTopology)
    )
    expectNoStrokeParameterOutputKeys(
      buildVectorComputedPatch(topologyWithStrokeParams)
    )
  })

  it('keeps validation wired into the computed patch builder and common API commit path', () => {
    const vectorConsistencySource = readFileSync(
      vectorConsistencySourcePath,
      'utf8'
    )
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')

    expect(vectorConsistencySource).toContain(
      'assertVectorTopologyConsistency('
    )
    expect(vectorConsistencySource).toContain("'buildVectorComputedPatch'")
    expect(vectorApisSource).toContain('vectorGeometry.validate(')
    expect(vectorApisSource).toContain(
      '`commitVectorTopologyOperation:${operation.type}`'
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('validate-topology')
  })

})
