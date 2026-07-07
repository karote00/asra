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
const renderStrategyRegistrySourcePath = resolve(
  repoRoot,
  'packages/render/src/registries/render-strategy.ts'
)
const renderLayerSourcePath = resolve(
  repoRoot,
  'packages/render/src/layers/scene/render-layer.ts'
)
const defineComponentSourcePath = resolve(
  repoRoot,
  'packages/core/src/define-component.ts'
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

describe('stroke flow step 17: render-strategy-entry', () => {
  it('keeps render-strategy-entry as the current or verified seventeenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-strategy-entry'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'render-strategy-entry'
      ])
    }
  })

  it('declares the render strategy entry implementation surface precisely', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'render-strategy-entry'
    )

    expect(step).toMatchObject({
      ownerStage: 'Render Mirror',
      allowedInputs: [
        'normalized render element data',
        'registered render strategy'
      ],
      requiredOutputs: [
        'render strategy invocation result',
        'cleared output on strategy error'
      ],
      implementationFiles: [
        'packages/render/src/registries/render-strategy.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/core/src/define-component.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('registers component render strategies without stroke semantic branching', () => {
    const registrySource = readRepoFile(renderStrategyRegistrySourcePath)
    const defineComponentSource = readRepoFile(defineComponentSourcePath)

    expect(registrySource).toContain('class RenderStrategyRegistry')
    expect(registrySource).toContain(
      'register(type: string, strategy: RenderStrategy)'
    )
    expect(registrySource).toContain(
      'get(type: string): RenderStrategy | undefined'
    )
    expect(defineComponentSource).toContain(
      'if (renderStrategy && renderStrategyRegistry.has(type))'
    )
    expect(defineComponentSource).toContain(
      'renderStrategyRegistry.register(type, renderStrategy)'
    )
    for (const forbiddenToken of [
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokeMaskPolygons',
      'descriptorProductPolygons'
    ]) {
      expect(registrySource).not.toContain(forbiddenToken)
      expect(defineComponentSource).not.toContain(forbiddenToken)
    }
  })

  it('invokes the registered strategy with render element data and clears on error', () => {
    const renderLayerSource = readRepoFile(renderLayerSourcePath)
    const renderGraphicSource = extractBetween(
      renderLayerSource,
      '  private renderGraphic(graphic: Graphics, data: RenderElementData) {',
      '  addContainer(containerData: RenderContainerData) {'
    )
    const updateElementSource = extractBetween(
      renderLayerSource,
      '  updateElement(',
      '  updateElementProperties('
    )

    expect(renderGraphicSource).toContain(
      '.__asyraLastRenderDataSnapshot = data'
    )
    expect(renderGraphicSource).toContain(
      'renderStrategyRegistry.get(data.type) || defaultStrategy'
    )
    expect(renderGraphicSource).toContain('strategy(graphic, data)')
    expect(renderGraphicSource).toContain(
      'graphic.visible = data.visible !== false'
    )
    expect(renderGraphicSource).toContain('graphic.clear()')
    expect(renderGraphicSource).toContain('graphic.visible = false')
    expect(updateElementSource).toContain('this.renderGraphic(element, data)')
    expect(updateElementSource).toContain(
      'this.updateElementProperties(element, key, after)'
    )
  })

  it('keeps vectorRenderStrategy as a delegation boundary, not a substitute geometry route', () => {
    const vectorSource = readRepoFile(vectorComponentSourcePath)
    const vectorStrategySource = extractBetween(
      vectorSource,
      'const vectorRenderStrategy: RenderStrategy = (graphic, data) => {',
      'defineComponent({'
    )
    const componentRegistrationStart = vectorSource.indexOf('defineComponent({')
    expect(componentRegistrationStart).toBeGreaterThanOrEqual(0)
    const componentRegistrationSource = vectorSource.slice(
      componentRegistrationStart
    )

    expect(vectorStrategySource).toContain(
      'renderVectorGraphic(graphic, data as unknown as VectorComputedData)'
    )
    expect(vectorStrategySource).toContain(
      'renderSolidCenterStrokeEntries(graphic, [])'
    )
    expect(vectorStrategySource).toContain('throw error')
    expect(componentRegistrationSource).toContain("type: 'vector'")
    expect(componentRegistrationSource).toContain(
      'renderStrategy: vectorRenderStrategy'
    )
    for (const forbiddenToken of [
      'buildSolidCenterStrokeResolvedPackets(',
      'buildConstrainedSolidStrokeResolvedPackets(',
      'buildConstrainedDashedStrokeResolvedPackets(',
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons'
    ]) {
      expect(vectorStrategySource).not.toContain(forbiddenToken)
    }
  })

  it('keeps render strategy entrypoints free of stroke parameter semantic reads', () => {
    const registrySource = readRepoFile(renderStrategyRegistrySourcePath)
    const renderLayerSource = readRepoFile(renderLayerSourcePath)
    const renderGraphicSource = extractBetween(
      renderLayerSource,
      '  private renderGraphic(graphic: Graphics, data: RenderElementData) {',
      '  addContainer(containerData: RenderContainerData) {'
    )
    const vectorSource = readRepoFile(vectorComponentSourcePath)
    const vectorStrategySource = extractBetween(
      vectorSource,
      'const vectorRenderStrategy: RenderStrategy = (graphic, data) => {',
      'defineComponent({'
    )

    expectNoStrokeParameterSourceTokens(registrySource)
    expectNoStrokeParameterSourceTokens(renderGraphicSource)
    expectNoStrokeParameterSourceTokens(vectorStrategySource)
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('render-strategy-entry')
  })
})
