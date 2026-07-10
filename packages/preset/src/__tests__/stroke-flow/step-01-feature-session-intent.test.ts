import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  createStrokeStyleIntent,
  type StrokeStyleIntentPatch
} from '../../../../../apps/asyra-design/src/properties/strokes/stroke-intents'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

type StrokeArg = Parameters<typeof createStrokeStyleIntent>[0]['stroke']

const strokeWithPatch = (patch: StrokeStyleIntentPatch): NonNullable<StrokeArg> =>
  ({
    style: 'solid',
    position: 'center',
    width: 10,
    dash: 4,
    gap: 2,
    capType: 'butt',
    joinType: 'miter',
    miterAngle: 28.96,
    ...patch
  }) as NonNullable<StrokeArg>

const intentCases = [
  {
    label: 'style',
    stroke: strokeWithPatch({ style: 'solid' }),
    patch: { style: 'dashed' }
  },
  {
    label: 'position',
    stroke: strokeWithPatch({ position: 'center' }),
    patch: { position: 'outside' }
  },
  {
    label: 'width',
    stroke: strokeWithPatch({ width: 10 }),
    patch: { width: 14 }
  },
  {
    label: 'dash',
    stroke: strokeWithPatch({ dash: 4 }),
    patch: { dash: 7 }
  },
  {
    label: 'gap',
    stroke: strokeWithPatch({ gap: 2 }),
    patch: { gap: 3 }
  },
  {
    label: 'capType',
    stroke: strokeWithPatch({ capType: 'butt' }),
    patch: { capType: 'round' }
  },
  {
    label: 'joinType',
    stroke: strokeWithPatch({ joinType: 'miter' }),
    patch: { joinType: 'bevel' }
  },
  {
    label: 'miterAngle',
    stroke: strokeWithPatch({ miterAngle: 28.96 }),
    patch: { miterAngle: 45 }
  }
] satisfies {
  label: string
  stroke: NonNullable<StrokeArg>
  patch: StrokeStyleIntentPatch
}[]

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
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'feature-session-intent'
      ])
    }
  })

  it.each(intentCases)(
    'emits an explicit single-field stroke-style intent for $label',
    ({ stroke, patch }) => {
      const intent = createStrokeStyleIntent({
        stroke,
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch
      })

      expect(intent).toEqual({
        kind: 'stroke-style-intent',
        routeId: 'feature-session-intent',
        ownerStage: 'Interaction',
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch
      })
      expect(Object.keys(intent ?? {}).sort()).toEqual([
        'kind',
        'ownerElementId',
        'ownerStage',
        'patch',
        'routeId',
        'strokeId'
      ])
      expect(Object.keys(intent?.patch ?? {})).toEqual(Object.keys(patch))
    }
  )

  it.each(intentCases)(
    'does not emit $label intent when the authored value is unchanged',
    ({ stroke, patch }) => {
      const [key] = Object.keys(patch) as (keyof StrokeStyleIntentPatch)[]
      expect(
        createStrokeStyleIntent({
          stroke: strokeWithPatch({ [key]: patch[key] }),
          strokeId: 'stroke:step-01',
          ownerElementId: 'element:step-01',
          patch
        })
      ).toBeNull()
    }
  )

  it('does not emit intent without one real interaction change target', () => {
    expect(
      createStrokeStyleIntent({
        stroke: null,
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch: { joinType: 'bevel' }
      })
    ).toBeNull()
    expect(
      createStrokeStyleIntent({
        stroke: strokeWithPatch({ joinType: 'miter' }),
        strokeId: '',
        ownerElementId: 'element:step-01',
        patch: { joinType: 'bevel' }
      })
    ).toBeNull()
    expect(
      createStrokeStyleIntent({
        stroke: strokeWithPatch({ joinType: 'miter' }),
        strokeId: 'stroke:step-01',
        ownerElementId: null,
        patch: { joinType: 'bevel' }
      })
    ).toBeNull()
    expect(
      createStrokeStyleIntent({
        stroke: strokeWithPatch({ joinType: 'miter' }),
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch: {}
      })
    ).toBeNull()
    expect(
      createStrokeStyleIntent({
        stroke: strokeWithPatch({ joinType: 'miter', capType: 'butt' }),
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch: { joinType: 'bevel', capType: 'round' }
      })
    ).toBeNull()
  })

  it.each(intentCases)(
    'keeps $label intent free of downstream product fields',
    ({ stroke, patch }) => {
      const intent = createStrokeStyleIntent({
        stroke,
        strokeId: 'stroke:step-01',
        ownerElementId: 'element:step-01',
        patch
      })
      const emittedKeys = collectKeys(intent)

      for (const forbiddenKey of [
        'render',
        'geometry',
        'packet',
        'descriptor',
        'mask',
        'resolvedJoin',
        'vertexAngle',
        'strokePathStyle',
        'product'
      ]) {
        expect(emittedKeys.has(forbiddenKey)).toBe(false)
      }
    }
  )

  it('routes every basic stroke handler through intent without render or geometry APIs', () => {
    const intentSource = readFileSync(intentSourcePath, 'utf8')
    const interactionSource = readFileSync(interactionSourcePath, 'utf8')

    expect(interactionSource).toContain('createStrokeStyleIntent')
    expect(interactionSource).toContain('const commitStrokeStyleIntent')
    expect(interactionSource).toContain(
      'commitStrokeInteractionPatch(intent.patch)'
    )
    expect(interactionSource).not.toContain('createStrokeJoinTypeIntent')
    for (const field of [
      'style',
      'position',
      'width',
      'dash',
      'gap',
      'joinType',
      'capType',
      'miterAngle'
    ]) {
      expect(interactionSource).toContain(`commitStrokeStyleIntent({ ${field}:`)
    }

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
