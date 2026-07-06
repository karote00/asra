import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { buildVectorComputedPatch } from '../../../../../apps/asyra-design/src/common-apis/element/vector-consistency'

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

const workspaceTopology = {
  points: {
    'point:a': {
      id: 'point:a',
      kind: 'anchor',
      x: 100,
      y: 200,
      anchorType: 'sharp'
    },
    'point:b': {
      id: 'point:b',
      kind: 'anchor',
      x: 160,
      y: 260,
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

describe('stroke flow step 06: canonical-workspace-data', () => {
  it('keeps canonical-workspace-data as the current or verified sixth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'canonical-workspace-data'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'canonical-workspace-data'
      ])
    }
  })

  it('builds computed data with workspace-canonical point coordinates', () => {
    const patch = buildVectorComputedPatch(workspaceTopology)

    expect(patch).toMatchObject({
      x: 100,
      y: 200,
      width: 60,
      height: 60,
      closed: false,
      pointCoordinateSpace: 'workspace'
    })
    expect(patch.points).toEqual(workspaceTopology.points)
    expect(
      (patch.points as typeof workspaceTopology.points)['point:a']
    ).toMatchObject({
      x: 100,
      y: 200
    })
    expect(
      (patch.points as typeof workspaceTopology.points)['point:b']
    ).toMatchObject({
      x: 160,
      y: 260
    })
  })

  it('does not collapse workspace points into bounds-local coordinates', () => {
    const patch = buildVectorComputedPatch(workspaceTopology)

    expect(
      (patch.points as typeof workspaceTopology.points)['point:a']
    ).not.toMatchObject({
      x: 0,
      y: 0
    })
    expect(
      (patch.points as typeof workspaceTopology.points)['point:b']
    ).not.toMatchObject({
      x: 60,
      y: 60
    })
  })

  it('keeps canonical workspace data free of render and stroke product fields', () => {
    const patch = buildVectorComputedPatch(workspaceTopology)
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

  it('keeps workspace reads separate from local-coordinate helper reads', () => {
    const vectorConsistencySource = readFileSync(
      vectorConsistencySourcePath,
      'utf8'
    )
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')

    expect(vectorConsistencySource).toContain(
      'points: topologyInWorkspace.points'
    )
    expect(vectorConsistencySource).toContain(
      "pointCoordinateSpace: 'workspace'"
    )
    expect(vectorApisSource).toContain('const getVectorTopologyWorkspace')
    expect(vectorApisSource).toContain('points: computed.points')
    expect(vectorApisSource).toContain('const getVectorTopologyLocal')
    expect(vectorApisSource).toContain('x: point.x - offset.x')
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('canonical-workspace-data')
  })

})
