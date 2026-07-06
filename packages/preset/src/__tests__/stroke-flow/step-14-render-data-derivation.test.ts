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

const readRepoFile = (path: string) => readFileSync(path, 'utf8')

const extractBetween = (source: string, start: string, end: string): string => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  expect(startIndex).toBeGreaterThanOrEqual(0)
  expect(endIndex).toBeGreaterThan(startIndex)
  return source.slice(startIndex, endIndex)
}

describe('stroke flow step 14: render-data-derivation', () => {
  it('keeps render-data-derivation as the current or verified fourteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-data-derivation'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'render-data-derivation'
      ])
    }
  })

  it('limits this step implementation to render snapshot and vector normalization boundaries', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-data-derivation'
    )

    expect(step).toMatchObject({
      ownerStage: 'Render Mirror',
      allowedInputs: ['render mirror snapshot'],
      requiredOutputs: ['normalized render data'],
      implementationFiles: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('derives renderer-ready data from the render mirror snapshot', () => {
    const source = readRepoFile(renderSceneTreeStoreSourcePath)
    const mirrorSource = extractBetween(
      source,
      'class ComputedDataMirror {',
      'class RenderSceneTree {'
    )
    const renderFlushSource = extractBetween(
      source,
      '  private _getRenderData(id: string) {',
      'let activeRenderSceneTree: RenderSceneTree | null = null'
    )

    expect(mirrorSource).toContain('rawDataSnapshot: { ...rawDataSnapshot }')
    expect(mirrorSource).toContain(
      'computedDataSnapshot: { ...computedDataSnapshot }'
    )
    expect(mirrorSource).toContain('renderDataSnapshot: {')
    expect(mirrorSource).toContain('...rawDataSnapshot')
    expect(mirrorSource).toContain('...computedDataSnapshot')
    expect(mirrorSource).toContain('return entry.renderDataSnapshot')
    expect(renderFlushSource).toContain(
      'return this.computedDataMirror.composeRenderData(id)'
    )
    expect(renderFlushSource).toContain('const data = this._getRenderData(id)')
    expect(renderFlushSource).toContain('render.updateElement(')
    expect(renderFlushSource).toContain("'computed'")
  })

  it('normalizes vector render data before local geometry or stroke normalization', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const normalizeSource = extractBetween(
      source,
      'const normalizeVectorRenderData = (data: unknown): VectorComputedData => {',
      'const getNumericSuffix = (value: string) => {'
    )
    const renderBoundarySource = extractBetween(
      source,
      'const renderVectorGraphic = (',
      'const vectorRenderStrategy: RenderStrategy = (graphic, data) => {'
    )

    expect(normalizeSource).toContain('isNormalizedVectorRenderDataInput(data)')
    expect(normalizeSource).toContain("pointCoordinateSpace: 'workspace'")
    expect(normalizeSource).toContain(
      'fills: Array.isArray(data.fills) ? data.fills : []'
    )
    expect(normalizeSource).toContain(
      'strokes: Array.isArray(data.strokes) ? data.strokes : []'
    )
    expect(normalizeSource).toContain(
      'networks: normalizeVectorNetworkMap(rawData.networks, points, segments)'
    )
    expect(
      renderBoundarySource.indexOf('normalizeVectorRenderData(data)')
    ).toBeLessThan(
      renderBoundarySource.indexOf(
        'toLocalPointNodeMap(workspacePoints, { x, y })'
      )
    )
    expect(
      renderBoundarySource.indexOf('normalizeVectorRenderData(data)')
    ).toBeLessThan(
      renderBoundarySource.indexOf('normalizeStrokeSpec(renderData.strokes)')
    )
  })

  it('preserves raw stroke parameter arrays until the later stroke-spec normalization step', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const normalizeSource = extractBetween(
      source,
      'const normalizeVectorRenderData = (data: unknown): VectorComputedData => {',
      'const getNumericSuffix = (value: string) => {'
    )
    const renderBoundarySource = extractBetween(
      source,
      'const renderVectorGraphic = (',
      'const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)'
    )

    expect(normalizeSource).toContain(
      'fills: Array.isArray(data.fills) ? data.fills : []'
    )
    expect(normalizeSource).toContain(
      'strokes: Array.isArray(data.strokes) ? data.strokes : []'
    )
    expect(renderBoundarySource).toContain('normalizeVectorRenderData(data)')
    expect(renderBoundarySource).not.toContain('normalizeStrokeSpec(')
    expectNoStrokeParameterSourceTokens(normalizeSource)
  })

  it('keeps render-data derivation free of feature-local state and stroke product ownership', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const normalizeSource = extractBetween(
      source,
      'const normalizeVectorRenderData = (data: unknown): VectorComputedData => {',
      'const getNumericSuffix = (value: string) => {'
    )
    const renderBoundarySource = extractBetween(
      source,
      'const renderVectorGraphic = (',
      'const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)'
    )

    for (const forbiddenToken of [
      'sceneTree',
      'propsManager',
      'common-apis',
      'featureSession',
      'renderSceneTreeStore',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      '__asyraStrokeRenderEntries'
    ]) {
      expect(normalizeSource).not.toContain(forbiddenToken)
      expect(renderBoundarySource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('render-data-derivation')
  })

})
