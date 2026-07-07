import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'

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

describe('stroke flow step 16: stage-product-cache', () => {
  it('keeps stage-product-cache as the current or verified sixteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'stage-product-cache')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'stage-product-cache'
      ])
    }
  })

  it('limits this step implementation to the vector stage cache consumer', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'stage-product-cache')

    expect(step).toMatchObject({
      ownerStage: 'Render Mirror',
      allowedInputs: [
        'stage dirty keys',
        'normalized vector source revision',
        'geometry-affecting stroke signature',
        'paint payload'
      ],
      requiredOutputs: [
        'cached or rebuilt semantic product descriptors',
        'stage cache hit/miss/store counters',
        'hidden-output early return for invisible product'
      ],
      implementationFiles: ['packages/preset/src/components/vector.ts']
    })
  })

  it('keys cached products by source revision and geometry-affecting stroke signature', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const signatureSource = extractBetween(
      source,
      'const buildStrokeProductGeometrySignature = (',
      'const getStrokePaintKey = (stroke: RenderableStroke) =>'
    )

    for (const requiredToken of [
      "'stroke-product-geometry'",
      'vectorId',
      '[network.id, sourceRevision.key].join',
      'stroke.kind',
      'stroke.style',
      'stroke.position',
      'stroke.width.toFixed(4)',
      'stroke.cap',
      'stroke.join',
      'stroke.miterLimit.toFixed(4)',
      '[stroke.dash, stroke.gap].map'
    ]) {
      expect(signatureSource).toContain(requiredToken)
    }
  })

  it('keeps display-only paint format fields out of product and paint cache keys', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const signatureSource = extractBetween(
      source,
      'const buildStrokeProductGeometrySignature = (',
      'const getStrokePaintKey = (stroke: RenderableStroke) =>'
    )
    const paintKeySource = extractBetween(
      source,
      'const getStrokePaintKey = (stroke: RenderableStroke) =>',
      'const retintStrokeFinalFaces = ('
    )

    for (const forbiddenToken of ['colorFormat', 'defaultColorFormat']) {
      expect(signatureSource).not.toContain(forbiddenToken)
      expect(paintKeySource).not.toContain(forbiddenToken)
    }
    expect(paintKeySource).toContain('stroke.paintKey')
    expect(paintKeySource).toContain('stroke.color')
    expect(paintKeySource).toContain('stroke.alpha')
  })

  it('renders cache hits from cached semantic descriptors without rebuilding product geometry', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const hitSource = extractBetween(
      source,
      '  const cachedProduct =',
      '  emitStrokePipelineCounter(\n    stageCache.products.size > 0'
    )

    expect(hitSource).toContain(
      'stageCache.products.get(strokeProductGeometrySignature)'
    )
    expect(hitSource).toContain('cachedProduct.renderEntries.length > 0')
    expect(hitSource).toContain('fillPayload.length === 0')
    expect(hitSource).toContain('stroke-stage-cache:product-geometry-hit')
    expect(hitSource).toContain('retintStrokeFinalFaces(')
    expect(hitSource).toContain('retintStrokeRenderEntries(')
    expect(hitSource).toContain('renderSolidCenterStrokeEntries(')
    expect(hitSource).toContain(
      'graphicCache.__asyraStrokePipelineStageCache = stageCache'
    )
    for (const forbiddenToken of [
      'buildSolidCenterStrokeResolvedPackets(',
      'buildConstrainedSolidStrokeResolvedPackets(',
      'buildConstrainedDashedStrokeResolvedPackets(',
      'buildDashedCenterStrokeResolvedPackets(',
      'buildResolvedVectorGeometryModel(',
      'buildVectorGeometryModelPath('
    ]) {
      expect(hitSource).not.toContain(forbiddenToken)
    }
  })

  it('stores rebuilt semantic products without miter/style replay shims', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const storeSource = extractBetween(
      source,
      '  if (\n    !shouldAttachFullStrokeDiagnostics &&\n    canUseStrokeProductGeometryCache',
      "  measureVectorRenderPhase('mesh render', () =>"
    )

    expect(storeSource).toContain(
      'geometrySignature: strokeProductGeometrySignature'
    )
    expect(storeSource).toContain('finalFaces: semanticStrokeFinalFaces')
    expect(storeSource).toContain('renderEntries: strokeRenderEntries')
    expect(storeSource).toContain(
      'stageCache.products.set(strokeProductGeometrySignature, productCacheEntry)'
    )
    expect(storeSource).toContain('stroke-stage-cache:product-geometry-store')

    for (const forbiddenToken of [
      'styleReplayable',
      'isMiterStyleReplayableStrokeProduct',
      'miter-style-replay',
      'ignoreMiterLimit'
    ]) {
      expect(source).not.toContain(forbiddenToken)
    }
  })

  it('keeps hidden output as an output-channel clear without rebuilding geometry', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const hiddenSource = extractBetween(
      source,
      '  if (!hasRenderableFill && renderableStrokesForVisibility.length === 0) {',
      '  let previewFill = false'
    )

    expect(hiddenSource).toContain('stroke-stage-cache:render-output-hidden')
    expect(hiddenSource).toContain(
      'applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, [])'
    )
    expect(hiddenSource).toContain(
      'renderSolidCenterStrokeEntries(graphic, [])'
    )
    for (const forbiddenToken of [
      'buildSolidCenterStrokeResolvedPackets(',
      'buildConstrainedSolidStrokeResolvedPackets(',
      'buildConstrainedDashedStrokeResolvedPackets(',
      'buildDashedCenterStrokeResolvedPackets(',
      'buildResolvedVectorGeometryModel('
    ]) {
      expect(hiddenSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('stage-product-cache')
  })
})
