import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { createVectorComputedPatchFromTopologyChange } from '../../../../../apps/asyra-design/src/common-apis/element/vector-apis'

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

const previousTopology = {
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
    }
  },
  segments: {
    'segment:ab': {
      id: 'segment:ab',
      startId: 'point:a',
      endId: 'point:b'
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

const previousComputed = {
  x: 10,
  y: 20,
  width: 60,
  height: 60,
  closed: false,
  pointCoordinateSpace: 'workspace',
  points: previousTopology.points,
  segments: previousTopology.segments,
  networks: previousTopology.networks
} as const

const nextTopology = {
  ...previousTopology,
  points: {
    ...previousTopology.points,
    'point:b': {
      ...previousTopology.points['point:b'],
      x: 90
    }
  }
} as const

const collectKeys = (value: unknown, keys = new Set<string>()) => {
  if (!value || typeof value !== 'object') {
    return keys
  }
  for (const key of Object.keys(value)) {
    keys.add(key)
    collectKeys((value as Record<string, unknown>)[key], keys)
  }
  return keys
}

describe('stroke flow step 08: computed-patch-builder', () => {
  it('keeps computed-patch-builder as the current or verified eighth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'computed-patch-builder'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'computed-patch-builder'
      ])
    }
  })

  it('emits only changed scalar values and changed record ids', () => {
    const patch = createVectorComputedPatchFromTopologyChange({
      previousComputed,
      previousTopology,
      nextTopology
    })

    expect(patch).toEqual({
      values: {
        width: 80
      },
      records: {
        points: {
          set: {
            'point:b': nextTopology.points['point:b']
          }
        }
      }
    })
  })

  it('omits unchanged scalar values and unrelated topology records', () => {
    const patch = createVectorComputedPatchFromTopologyChange({
      previousComputed,
      previousTopology,
      nextTopology
    })

    expect(patch.values).not.toHaveProperty('x')
    expect(patch.values).not.toHaveProperty('y')
    expect(patch.values).not.toHaveProperty('height')
    expect(patch.values).not.toHaveProperty('closed')
    expect(patch.records?.points?.set).not.toHaveProperty('point:a')
    expect(patch.records).not.toHaveProperty('segments')
    expect(patch.records).not.toHaveProperty('networks')
  })

  it('sets all records only when no previous computed data exists', () => {
    const patch = createVectorComputedPatchFromTopologyChange({
      previousComputed: null,
      previousTopology,
      nextTopology
    })

    expect(Object.keys(patch.records?.points?.set ?? {})).toEqual([
      'point:a',
      'point:b'
    ])
    expect(Object.keys(patch.records?.segments?.set ?? {})).toEqual([
      'segment:ab'
    ])
    expect(Object.keys(patch.records?.networks?.set ?? {})).toEqual([
      'network:main'
    ])
  })

  it('keeps computed patch output free of render and stroke product fields', () => {
    const patch = createVectorComputedPatchFromTopologyChange({
      previousComputed,
      previousTopology,
      nextTopology
    })
    const emittedKeys = collectKeys(patch)

    for (const forbiddenKey of [
      'render',
      'geometry',
      'packet',
      'descriptor',
      'mask',
      'stroke',
      'join',
      'miterAngle',
      'resolvedJoin',
      'vertexAngle',
      'product'
    ]) {
      expect(emittedKeys.has(forbiddenKey)).toBe(false)
    }
  })

  it('keeps the common API commit path on the differential patch builder', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')

    expect(vectorApisSource).toContain(
      'createVectorComputedPatchFromTopologyChange'
    )
    expect(vectorApisSource).toContain('setPatchValueIfChanged(')
    expect(vectorApisSource).toContain('createRecordComputedPatch(')
    expect(vectorApisSource).toContain(
      'assertVectorTopologyOperationPatchScope('
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('computed-patch-builder')
  })

})
