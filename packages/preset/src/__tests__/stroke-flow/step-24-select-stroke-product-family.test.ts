import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { selectStrokeProductFamily } from '../../components/stroke-render/stroke-product-family'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
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
const productFamilySourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-product-family.ts'
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

const baseSourceFamily = {
  familyScope: 'simple-closed' as const
}

const baseDomainPlan = {
  planId: 'plan:step-24',
  sourceId: 'source:step-24',
  networkId: 'network:step-24',
  domainMode: 'closed-constrained-domain' as const,
  intervalDomainKind: 'source-path' as const
}

const expectNoVisibleGeometryFields = (record: unknown) => {
  const text = JSON.stringify(record)
  for (const forbiddenField of [
    'polygon',
    'geometry',
    'footprint',
    'strokeMask',
    'descriptorProduct',
    'renderEntries',
    'finalFaces',
    'resolvedJoin',
    'vertexAngle',
    'miterAngle',
    'capGeometry'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 24: select-stroke-product-family', () => {
  it('keeps select-stroke-product-family as the current or verified twenty-fourth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'select-stroke-product-family'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'select-stroke-product-family'
      ])
    }
  })

  it('declares the exact product-family selection implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'select-stroke-product-family'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry product family selection',
      allowedInputs: [
        'normalized stroke position and dash state',
        'resolved source family',
        'StrokeDomainPlan domain mode and selected legal side'
      ],
      requiredOutputs: [
        'selected center product route',
        'selected constrained solid product route',
        'selected constrained dashed co-execution route set'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts',
        'packages/preset/src/components/stroke-render/stroke-product-family.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'visible geometry',
        'source-vertex join footprint',
        'dash body polygon',
        'terminal body polygon',
        'descriptor geometry',
        'renderer projection output'
      ])
    )
  })

  it('selects center product routes without materializing product geometry', () => {
    const selection = selectStrokeProductFamily({
      stroke: { style: 'solid', position: 'center' },
      sourceFamily: baseSourceFamily,
      domainPlan: {
        ...baseDomainPlan,
        domainMode: 'center-product',
        intervalDomainKind: 'topology-arc-length'
      }
    })

    expect(selection).toMatchObject({
      productFamilyId: 'center',
      selectedRouteIds: ['build-center-stroke-products'],
      coExecutionRouteIds: [],
      predicateInputs: {
        strokeStyle: 'solid',
        strokePosition: 'center',
        domainMode: 'center-product',
        intervalDomainKind: 'topology-arc-length',
        sourceFamilyScope: 'simple-closed'
      }
    })
    expectNoVisibleGeometryFields(selection)
  })

  it('selects constrained solid route for non-dashed constrained domains', () => {
    const selection = selectStrokeProductFamily({
      stroke: { style: 'solid', position: 'inside' },
      sourceFamily: baseSourceFamily,
      domainPlan: baseDomainPlan
    })

    expect(selection).toMatchObject({
      productFamilyId: 'constrained-solid',
      selectedRouteIds: ['build-constrained-solid-products'],
      coExecutionRouteIds: [],
      sourceSignature: 'source:step-24:network:step-24:simple-closed',
      domainSignature: 'plan:step-24:closed-constrained-domain:source-path'
    })
    expectNoVisibleGeometryFields(selection)
  })

  it('selects constrained dashed co-execution route set without building products', () => {
    const selection = selectStrokeProductFamily({
      stroke: { style: 'dashed', position: 'outside' },
      sourceFamily: {
        familyScope: 'self-intersecting-closed'
      },
      domainPlan: {
        ...baseDomainPlan,
        domainMode: 'closed-constrained-domain',
        intervalDomainKind: 'domain-plan-split-range'
      },
      dashSignature: 'dash:20-10:0'
    })

    expect(selection).toMatchObject({
      productFamilyId: 'constrained-dashed',
      selectedRouteIds: [],
      coExecutionRouteIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      dashSignature: 'dash:20-10:0'
    })
    expectNoVisibleGeometryFields(selection)
  })

  it('returns no-product decision for invalid or unallocatable domains', () => {
    const nullDomain = selectStrokeProductFamily({
      stroke: { style: 'dashed', position: 'outside' },
      sourceFamily: baseSourceFamily,
      domainPlan: {
        ...baseDomainPlan,
        domainMode: null,
        intervalDomainKind: 'none'
      }
    })

    expect(nullDomain).toMatchObject({
      productFamilyId: 'none',
      selectedRouteIds: [],
      coExecutionRouteIds: [],
      diagnostics: ['stroke-domain-plan-has-no-product-family']
    })
    expectNoVisibleGeometryFields(nullDomain)
  })

  it('keeps product family selector free of product, join, cap, and renderer ownership', () => {
    const source = readFileSync(productFamilySourcePath, 'utf8')

    for (const forbiddenToken of [
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries',
      'strokePathStyle',
      'buildSolidCenterStrokeFinalFaces',
      'resolvedJoin',
      'vertexAngle',
      'angleSource',
      'miterAngle',
      'capPolicy'
    ]) {
      expect(source).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('select-stroke-product-family')
  })

})
