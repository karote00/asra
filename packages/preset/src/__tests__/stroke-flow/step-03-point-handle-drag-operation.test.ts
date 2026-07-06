import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys
} from './stroke-parameter-coverage-test-helper'
import { createPointHandleComputedPatchIntent } from '../../../../../apps/asyra-design/src/features/path-editing-intents'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

type PointTarget = Parameters<
  typeof createPointHandleComputedPatchIntent
>[0]['dragTarget'] extends infer DragTarget
  ? NonNullable<DragTarget>['target']
  : never

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
  'apps/asyra-design/src/features/path-editing-intents.ts'
)
const penToolSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/pen-tool/index.ts'
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

const dragTarget = (target: PointTarget) => ({
  elementId: 'vector:step-03',
  pointId: 'point:step-03',
  index: 3,
  target,
  dragStartWorkspacePos: {
    x: 10,
    y: 20
  },
  initialTargetPos: {
    x: 100,
    y: 200
  }
})

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

describe('stroke flow step 03: point-handle-drag-operation', () => {
  it('keeps point-handle-drag-operation as the current or verified third step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'point-handle-drag-operation'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'point-handle-drag-operation'
      ])
    }
  })

  it.each(['anchor', 'inHandle', 'outHandle'] as const)(
    'emits a transient computed patch intent for %s drag update',
    (target) => {
      const intent = createPointHandleComputedPatchIntent({
        dragTarget: dragTarget(target),
        currentWorkspacePos: {
          x: 16,
          y: 31
        },
        phase: 'update'
      })

      expect(intent).toEqual({
        kind: 'point-handle-computed-patch-intent',
        routeId: 'point-handle-drag-operation',
        ownerStage: 'Interaction',
        operation: 'move-vector-point-target',
        phase: 'update',
        elementId: 'vector:step-03',
        pointId: 'point:step-03',
        target,
        patch: {
          position: {
            x: 106,
            y: 211
          },
          undoable: false,
          skipResult: true
        },
        inputEvidence: {
          pointId: 'point:step-03',
          target,
          dragStartWorkspacePos: {
            x: 10,
            y: 20
          },
          currentWorkspacePos: {
            x: 16,
            y: 31
          }
        },
        outputRevision: `point-handle-drag-operation:update:vector:step-03:point:step-03:${target}:106:211:transient`
      })
    }
  )

  it('emits an undoable computed patch intent for final drag commit', () => {
    const intent = createPointHandleComputedPatchIntent({
      dragTarget: dragTarget('anchor'),
      currentWorkspacePos: {
        x: 21,
        y: 24
      },
      phase: 'commit'
    })

    expect(intent).toEqual({
      kind: 'point-handle-computed-patch-intent',
      routeId: 'point-handle-drag-operation',
      ownerStage: 'Interaction',
      operation: 'move-vector-point-target',
      phase: 'commit',
      elementId: 'vector:step-03',
      pointId: 'point:step-03',
      target: 'anchor',
      patch: {
        position: {
          x: 111,
          y: 204
        },
        undoable: true,
        skipResult: true
      },
      inputEvidence: {
        pointId: 'point:step-03',
        target: 'anchor',
        dragStartWorkspacePos: {
          x: 10,
          y: 20
        },
        currentWorkspacePos: {
          x: 21,
          y: 24
        }
      },
      outputRevision:
        'point-handle-drag-operation:commit:vector:step-03:point:step-03:anchor:111:204:undoable'
    })
  })

  it('does not emit an intent without a complete drag target or current workspace position', () => {
    expect(
      createPointHandleComputedPatchIntent({
        dragTarget: null,
        currentWorkspacePos: {
          x: 16,
          y: 31
        },
        phase: 'update'
      })
    ).toBeNull()
    expect(
      createPointHandleComputedPatchIntent({
        dragTarget: dragTarget('anchor'),
        currentWorkspacePos: null,
        phase: 'update'
      })
    ).toBeNull()
  })

  it('keeps the emitted intent free of render, stroke product, and topology record fields', () => {
    const intent = createPointHandleComputedPatchIntent({
      dragTarget: dragTarget('outHandle'),
      currentWorkspacePos: {
        x: 16,
        y: 31
      },
      phase: 'update'
    })
    const emittedKeys = collectKeys(intent)

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
      'points',
      'segments',
      'networks',
      'product'
    ]) {
      expect(emittedKeys.has(forbiddenKey)).toBe(false)
    }
    expectNoStrokeParameterOutputKeys(intent)
  })

  it('ignores stroke-like extra inputs instead of treating them as drag intent', () => {
    const baseInput = {
      dragTarget: dragTarget('anchor'),
      currentWorkspacePos: {
        x: 16,
        y: 31
      },
      phase: 'update' as const
    }
    const strokeLikeInput = {
      ...baseInput,
      stroke: {
        fill: {
          visible: true,
          kind: 'solid',
          color: '#00ff00',
          opacity: 0.75,
          gradient: null,
          colorFormat: 'hex',
          defaultColorFormat: 'hex'
        },
        style: 'dashed',
        position: 'inside',
        width: 14,
        dash: 6,
          gap: 3,
        capType: 'square',
        joinType: 'round',
        miterAngle: 45
      }
    } as unknown as Parameters<typeof createPointHandleComputedPatchIntent>[0]

    expect(createPointHandleComputedPatchIntent(strokeLikeInput)).toEqual(
      createPointHandleComputedPatchIntent(baseInput)
    )
    expectNoStrokeParameterOutputKeys(
      createPointHandleComputedPatchIntent(strokeLikeInput)
    )
  })

  it('routes point/handle drag decisions through intent without render APIs', () => {
    const intentSource = readFileSync(intentSourcePath, 'utf8')
    const penToolSource = readFileSync(penToolSourcePath, 'utf8')

    expect(penToolSource).toContain('createPointHandleComputedPatchIntent')

    for (const forbiddenToken of [
      'deps.render',
      '__asyraStroke',
      'render.update',
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(intentSource).not.toContain(forbiddenToken)
      expect(penToolSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('point-handle-drag-operation')
  })

})
