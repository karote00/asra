import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterSourceTokens
} from './stroke-parameter-coverage-test-helper'

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
const deleteVectorPointSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/delete-vector-point/index.ts'
)
const vectorPointPropertiesSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/properties/vector-point.tsx'
)
const reactivePublishSourcePath = resolve(
  repoRoot,
  'packages/reactive-events/src/app/publish.ts'
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

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

const expectOrdered = (source: string, orderedTokens: string[]) => {
  let cursor = -1
  for (const token of orderedTokens) {
    const nextIndex = source.indexOf(token, cursor + 1)
    expect(nextIndex).toBeGreaterThan(cursor)
    cursor = nextIndex
  }
}

describe('stroke flow step 09: transaction-undo-boundary', () => {
  it('keeps transaction-undo-boundary as the current or verified ninth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'transaction-undo-boundary'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'transaction-undo-boundary'
      ])
    }
  })

  it('wraps topology computed patch writes in one common API transaction boundary', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')
    const topologyCommitSource = sliceBetween(
      vectorApisSource,
      'const commitVectorTopologyOperation =',
      'const commitVectorPointMutation ='
    )

    expectOrdered(topologyCommitSource, [
      'startTransaction()',
      'reconcileVectorSelectionAfterTopologyChange(',
      'core.changeComputedDataPatch(',
      'endTransaction()'
    ])
  })

  it('wraps point mutation writes in one common API transaction boundary', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')
    const pointCommitSource = sliceBetween(
      vectorApisSource,
      'const commitVectorPointMutation =',
      'const getVectorSegmentProjection ='
    )

    expectOrdered(pointCommitSource, [
      'startTransaction()',
      'core.changeComputedDataPatch(',
      'endTransaction()'
    ])
  })

  it('keeps nested transaction calls collapsed to one outer undo unit', () => {
    const reactivePublishSource = readFileSync(
      reactivePublishSourcePath,
      'utf8'
    )

    expect(reactivePublishSource).toContain('let transactionDepth = 0')
    expectOrdered(reactivePublishSource, [
      'if (transactionDepth === 0)',
      'type: EventTypes.START_TRANSACTION',
      'transactionDepth += 1'
    ])
    expectOrdered(reactivePublishSource, [
      'transactionDepth -= 1',
      'if (transactionDepth === 0)',
      'type: EventTypes.END_TRANSACTION'
    ])
  })

  it('keeps delete point cleanup and vector point property commits inside their intended outer transaction', () => {
    const deleteVectorPointSource = readFileSync(
      deleteVectorPointSourcePath,
      'utf8'
    )
    const vectorPointPropertiesSource = readFileSync(
      vectorPointPropertiesSourcePath,
      'utf8'
    )

    expectOrdered(deleteVectorPointSource, [
      'startTransaction()',
      'elementApis.removeVectorAnchorPoint(',
      'selectionApis.selectElements(',
      'selectionApis.clearVectorPointSelection()',
      'selectionApis.clearVectorSegmentSelection()',
      'systemContextApis.clearVectorPointState()',
      'endTransaction()'
    ])
    expectOrdered(vectorPointPropertiesSource, [
      'const runDiscreteVectorPointInteraction = useCallback(',
      'transactionApis.startTransaction()',
      'return action()',
      'transactionApis.endTransaction()'
    ])
  })

  it('does not route transaction ownership through render or stroke product helpers', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')
    const deleteVectorPointSource = readFileSync(
      deleteVectorPointSourcePath,
      'utf8'
    )
    const vectorPointPropertiesSource = readFileSync(
      vectorPointPropertiesSourcePath,
      'utf8'
    )

    for (const forbiddenToken of [
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(vectorApisSource).not.toContain(forbiddenToken)
      expect(deleteVectorPointSource).not.toContain(forbiddenToken)
      expect(vectorPointPropertiesSource).not.toContain(forbiddenToken)
    }
  })

  it('keeps transaction boundaries payload-agnostic for stroke parameter patches', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')
    const topologyCommitSource = sliceBetween(
      vectorApisSource,
      'const commitVectorTopologyOperation =',
      'const commitVectorPointMutation ='
    )
    const pointCommitSource = sliceBetween(
      vectorApisSource,
      'const commitVectorPointMutation =',
      'const getVectorSegmentProjection ='
    )

    expect(topologyCommitSource).toContain('core.changeComputedDataPatch(')
    expect(pointCommitSource).toContain('core.changeComputedDataPatch(')
    expectNoStrokeParameterSourceTokens(topologyCommitSource)
    expectNoStrokeParameterSourceTokens(pointCommitSource)
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('transaction-undo-boundary')
  })
})
