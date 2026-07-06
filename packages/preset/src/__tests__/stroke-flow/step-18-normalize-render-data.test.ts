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

describe('stroke flow step 18: normalize-render-data', () => {
  it('keeps normalize-render-data as the current or verified eighteenth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'normalize-render-data'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'normalize-render-data'
      ])
    }
  })

  it('declares local source/topology preparation as the exact implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'normalize-render-data'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: ['normalized render data'],
      requiredOutputs: [
        'local source point map',
        'ordered authored networks',
        'raw stroke/fill payloads'
      ],
      implementationFiles: ['packages/preset/src/components/vector.ts']
    })
  })

  it('converts normalized render data into local authored source inputs before later stroke stages', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const preparationSource = extractBetween(
      source,
      '  const {\n    fills,\n    x,\n    y,\n    points: workspacePoints,\n    segments,\n    networks\n  } = renderData',
      '  const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)'
    )

    expect(preparationSource).toContain(
      'const points = toLocalPointNodeMap(workspacePoints, { x, y })'
    )
    expect(preparationSource).toContain(
      'const orderedNetworks = sortByStableId(Object.values(networks))'
    )
    expect(preparationSource).toContain('if (orderedNetworks.length === 0)')
    expect(preparationSource).toContain(
      'setElementGeometryLocalBounds(\n    graphic as Parameters<typeof setElementGeometryLocalBounds>[0],\n    { x: 0, y: 0, width: renderData.width, height: renderData.height }\n  )'
    )
    expect(preparationSource).toContain(
      'const fillPayload = getFillPayload(fills)'
    )
    expect(preparationSource).toContain(
      'const hasRenderableFill = getRenderableFills(fillPayload).length > 0'
    )
    expect(preparationSource).not.toContain(
      'normalizeStrokeSpec(renderData.strokes)'
    )
  })

  it('keeps this stage free of stroke spec, domain, product, and renderer projection ownership', () => {
    const source = readRepoFile(vectorComponentSourcePath)
    const preparationSource = extractBetween(
      source,
      '  const {\n    fills,\n    x,\n    y,\n    points: workspacePoints,\n    segments,\n    networks\n  } = renderData',
      '  const normalizedStrokeSpec = normalizeStrokeSpec(renderData.strokes)'
    )

    for (const forbiddenToken of [
      'normalizeStrokeSpec(',
      'buildStrokeDomainPlan',
      'buildSolidCenterStrokeResolvedPackets(',
      'buildConstrainedSolidStrokeResolvedPackets(',
      'buildConstrainedDashedStrokeResolvedPackets(',
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries(graphic, strokeRenderEntries)'
    ]) {
      expect(preparationSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('normalize-render-data')
  })

})
