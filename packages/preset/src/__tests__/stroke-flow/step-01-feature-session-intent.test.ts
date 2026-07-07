import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { createStrokeJoinTypeIntent } from '../../../../../apps/asyra-design/src/properties/strokes/stroke-intents'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

type StrokeArg = Parameters<typeof createStrokeJoinTypeIntent>[0]['stroke']
type StrokeJoin = Parameters<typeof createStrokeJoinTypeIntent>[0]['nextJoin']

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const intentSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/properties/strokes/stroke-intents.ts'
)
const interactionSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/properties/strokes/use-stroke-interactions.ts'
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

const strokeWithJoin = (joinType: StrokeJoin): NonNullable<StrokeArg> =>
  ({
    joinType
  }) as NonNullable<StrokeArg>

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

describe('stroke flow step 01: feature-session-intent', () => {
  it('keeps feature-session-intent as the current or verified first step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'feature-session-intent'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'feature-session-intent'
      ])
    }
  })

  it.each(['miter', 'bevel', 'round'] as const)(
    'emits explicit stroke-style intent for %s join selection',
    (nextJoin) => {
      const currentJoin: StrokeJoin = nextJoin === 'round' ? 'miter' : 'round'
      const intent = createStrokeJoinTypeIntent({
        stroke: strokeWithJoin(currentJoin),
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        nextJoin
      })

      expect(intent).toEqual({
        kind: 'stroke-style-intent',
        routeId: 'feature-session-intent',
        ownerStage: 'Interaction',
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch: {
          joinType: nextJoin
        }
      })
      expect(Object.keys(intent ?? {}).sort()).toEqual([
        'kind',
        'ownerElementId',
        'ownerStage',
        'patch',
        'routeId',
        'strokeId'
      ])
      expect(Object.keys(intent?.patch ?? {})).toEqual(['joinType'])
    }
  )

  it('does not emit intent without a real interaction change target', () => {
    expect(
      createStrokeJoinTypeIntent({
        stroke: strokeWithJoin('miter'),
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        nextJoin: 'miter'
      })
    ).toBeNull()
    expect(
      createStrokeJoinTypeIntent({
        stroke: null,
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        nextJoin: 'bevel'
      })
    ).toBeNull()
    expect(
      createStrokeJoinTypeIntent({
        stroke: strokeWithJoin('miter'),
        strokeId: '',
        ownerElementId: 'element:step-01',
        nextJoin: 'bevel'
      })
    ).toBeNull()
    expect(
      createStrokeJoinTypeIntent({
        stroke: strokeWithJoin('miter'),
        strokeId: 'stroke:step-01',
        ownerElementId: null,
        nextJoin: 'bevel'
      })
    ).toBeNull()
  })

  it('keeps the emitted intent free of downstream product fields', () => {
    const intent = createStrokeJoinTypeIntent({
      stroke: strokeWithJoin('round'),
      strokeId: 'stroke:step-01',
      ownerElementId: 'element:step-01',
      nextJoin: 'miter'
    })
    const emittedKeys = collectKeys(intent)

    for (const forbiddenKey of [
      'render',
      'geometry',
      'packet',
      'descriptor',
      'mask',
      'cap',
      'capType',
      'miterAngle',
      'resolvedJoin',
      'vertexAngle',
      'strokePathStyle',
      'product'
    ]) {
      expect(emittedKeys.has(forbiddenKey)).toBe(false)
    }
  })

  it('routes the join handler through intent without render or geometry APIs', () => {
    const intentSource = readFileSync(intentSourcePath, 'utf8')
    const interactionSource = readFileSync(interactionSourcePath, 'utf8')

    expect(interactionSource).toContain('createStrokeJoinTypeIntent')
    expect(interactionSource).toContain(
      'commitStrokeInteractionPatch(intent.patch)'
    )

    for (const forbiddenToken of [
      'deps.render',
      '__asyraStroke',
      'render.update',
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons'
    ]) {
      expect(intentSource).not.toContain(forbiddenToken)
      expect(interactionSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('feature-session-intent')
  })
})
