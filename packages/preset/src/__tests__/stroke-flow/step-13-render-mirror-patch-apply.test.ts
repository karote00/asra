import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterSourceTokens
} from './stroke-parameter-coverage-test-helper'

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
const renderSceneTreeStoreSourcePath = resolve(
  repoRoot,
  'packages/render/src/stores/scene-tree.ts'
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

const readRepoFile = (path: string) => readFileSync(path, 'utf8')

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const countOccurrences = (source: string, token: string): number =>
  source.split(token).length - 1

describe('stroke flow step 13: render-mirror-patch-apply', () => {
  it('keeps render-mirror-patch-apply as the current or verified thirteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-mirror-patch-apply'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'render-mirror-patch-apply'
      ])
    }
  })

  it('limits this step implementation to the render scene-tree mirror store', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-mirror-patch-apply'
    )

    expect(step).toMatchObject({
      ownerStage: 'Render Mirror',
      allowedInputs: [
        'computed patch event',
        'existing render mirror snapshot or cache-miss source element'
      ],
      requiredOutputs: ['updated or reseeded render mirror snapshot'],
      implementationFiles: ['packages/render/src/stores/scene-tree.ts']
    })
  })

  it('applies a computed patch through the render mirror seed/apply boundary', () => {
    const source = readRepoFile(renderSceneTreeStoreSourcePath)
    const applyPatchSource = extractBetween(
      source,
      '  applyComputedPatch(elementId: string, patch: ComputedDataPatchChange) {',
      '  composeRenderData(elementId: string): RenderElementData | null {'
    )

    expect(applyPatchSource).toContain('this.ensure(elementId)')
    expect(applyPatchSource).toContain('return false')
    expect(applyPatchSource).toContain(
      'entry.computedDataSnapshot[key] = change.after'
    )
    expect(applyPatchSource).toContain('nextRecord[recordId] = change.after')
    expect(applyPatchSource).toContain(
      'const { [recordId]: _removed, ...withoutRecord } = nextRecord'
    )
  })

  it('stages each computed patch once before scheduling render flush', () => {
    const source = readRepoFile(renderSceneTreeStoreSourcePath)
    const updatePatchSource = extractBetween(
      source,
      '  updateElementPatch(',
      '  commitPendingComputedDataChanges() {'
    )

    expect(countOccurrences(updatePatchSource, 'applyComputedPatch')).toBe(1)
    expect(updatePatchSource).not.toContain('this.computedDataMirror.seed')
    expect(updatePatchSource).toContain(
      'const didStage = this.computedDataMirror.applyComputedPatch'
    )
    expect(updatePatchSource).toContain('if (!didStage) {')
    expect(updatePatchSource).toContain('return')
    expect(updatePatchSource).toContain('this.recordDirtyChange(')
    expect(updatePatchSource).toContain(
      'this.pendingElementUpdates.add(elementId)'
    )
    expect(updatePatchSource).toContain('this.scheduleFlush()')
  })

  it('stages stroke parameter patch values as raw computed data keys', () => {
    const source = readRepoFile(renderSceneTreeStoreSourcePath)
    const applyPatchSource = extractBetween(
      source,
      '  applyComputedPatch(elementId: string, patch: ComputedDataPatchChange) {',
      '  composeRenderData(elementId: string): RenderElementData | null {'
    )
    const updatePatchSource = extractBetween(
      source,
      '  updateElementPatch(',
      '  commitPendingComputedDataChanges() {'
    )

    expect(applyPatchSource).toContain(
      'Object.entries(patch.values ?? {}).forEach(([key, change]) => {'
    )
    expect(applyPatchSource).toContain(
      'entry.computedDataSnapshot[key] = change.after'
    )
    expect(applyPatchSource).toContain(
      'entry.renderDataSnapshot as unknown as Record<string, DataTypes>)[key] ='
    )
    expect(updatePatchSource).toContain('Object.keys(patch.values ?? {}).some(')
    expect(updatePatchSource).toContain(
      "key !== 'visible' && !DIRECT_RENDER_PROPERTY_KEYS.has(key)"
    )
    expectNoStrokeParameterSourceTokens(applyPatchSource)
    expectNoStrokeParameterSourceTokens(updatePatchSource)
  })

  it('keeps render mirror patch apply free of stroke geometry and renderer repair ownership', () => {
    const source = readRepoFile(renderSceneTreeStoreSourcePath)
    const applyPatchSource = extractBetween(
      source,
      '  applyComputedPatch(elementId: string, patch: ComputedDataPatchChange) {',
      '  commitPendingComputedDataChanges() {'
    )

    for (const forbiddenToken of [
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons',
      '__asyraStrokeRenderEntries'
    ]) {
      expect(applyPatchSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('render-mirror-patch-apply')
  })
})
