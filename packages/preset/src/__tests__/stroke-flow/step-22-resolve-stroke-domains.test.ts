import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from '../../components/stroke-render/path-topology-model'
import { resolveSourceFamily } from '../../components/stroke-render/resolved-source-family'
import { resolveStrokeDomains } from '../../components/stroke-render/stroke-domain-plan'

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
const domainPlanSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-domain-plan.ts'
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

const buildTopology = (
  id: string,
  points: { x: number; y: number }[],
  closed: boolean
) =>
  buildPathTopologyModel({
    pathId: `path:${id}`,
    sourceId: `source:${id}`,
    networkId: `network:${id}`,
    sourceRevision: `revision:${id}`,
    sourceFamily: 'vector',
    fillRule: 'evenodd',
    points,
    closed
  })

const withCompoundLegalDomains = (
  source: PathTopologyModel
): PathTopologyModel => ({
  ...source,
  contours: [
    ...source.contours,
    {
      ...source.contours[0],
      contourId: `${source.pathId}:contour:hole`,
      role: 'hole',
      nestingDepth: 1
    }
  ],
  legalDomainDescriptors: [
    ...source.legalDomainDescriptors,
    {
      legalDomainId: `${source.pathId}:legal-domain:hole`,
      role: 'hole',
      fillRule: source.fillRule,
      fillRuleBasis: source.fillRuleBasis,
      contourIds: [`${source.pathId}:contour:hole`]
    }
  ]
})

const normalizedLegalDomain = (source: PathTopologyModel) => ({
  legalDomainId: `${source.pathId}:normalized-legal-domain:0`,
  boundarySpans: [
    {
      boundarySpanId: `${source.pathId}:boundary-span:shell`,
      role: 'fill-exterior-edge' as const,
      geometry: source.normalizedPoints,
      sourceContourIds: [`${source.pathId}:contour:0`],
      sourceSpanIds: [`${source.pathId}:span:shell:0`],
      seamPoint: source.normalizedPoints[0] ?? null
    },
    {
      boundarySpanId: `${source.pathId}:boundary-span:hole`,
      role: 'fill-interior-edge' as const,
      geometry: [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 75, y: 75 },
        { x: 25, y: 75 }
      ],
      sourceContourIds: [`${source.pathId}:contour:hole`],
      sourceSpanIds: [`${source.pathId}:span:hole:0`],
      seamPoint: { x: 25, y: 25 }
    }
  ]
})

const stroke = (
  style: 'solid' | 'dashed',
  position: 'center' | 'inside' | 'outside',
  width = 12
) => ({ style, position, width })

const resolvePlan = (
  topology: PathTopologyModel,
  strokeSpec: ReturnType<typeof stroke>,
  options: Partial<Parameters<typeof resolveStrokeDomains>[0]> = {}
) =>
  resolveStrokeDomains({
    topology,
    sourceFamily: resolveSourceFamily({ topology, stroke: strokeSpec }),
    stroke: strokeSpec,
    ...options
  })

const expectNoVisibleStrokeProductFields = (record: unknown) => {
  const text = JSON.stringify(record, (_key, value) => {
    if (typeof value === 'function') {
      return '[function]'
    }
    return value
  })
  for (const forbiddenField of [
    'strokeMaskPolygons',
    'descriptorProductPolygons',
    'strokePathStyle',
    'renderEntries',
    'finalFaces',
    'DashProductInterval',
    'resolvedJoin',
    'vertexAngle',
    'angleSource',
    'miterAngle',
    'capPolicy',
    'sourceVertexJoinFootprint'
  ]) {
    expect(text).not.toContain(forbiddenField)
  }
}

describe('stroke flow step 22: resolve-stroke-domains', () => {
  it('keeps resolve-stroke-domains as the current or verified twenty-second step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'resolve-stroke-domains'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'resolve-stroke-domains'
      ])
    }
  })

  it('declares the exact StrokeDomainPlan implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'resolve-stroke-domains'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: [
        'PathTopologyModel source-domain evidence',
        'ResolvedSourceFamily classification',
        'normalized stroke style, position, and width',
        'optional resolved self-intersection split ranges',
        'optional normalized legal-domain boundary spans'
      ],
      requiredOutputs: [
        'StrokeDomainPlan record',
        'domainMode',
        'intervalDomainKind',
        'sideAuthority',
        'splitRangeDomains and legalBoundaryDomains as domain references',
        'domain diagnostics'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'DashProductInterval output',
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'final faces',
        'render entries',
        'renderer projection output'
      ])
    )
  })

  it('resolves center, simple constrained, compound, self-intersection, and degenerate domain modes', () => {
    const simpleClosed = buildTopology(
      'simple',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      true
    )
    const open = buildTopology(
      'open',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 }
      ],
      false
    )
    const compound = withCompoundLegalDomains(
      buildTopology(
        'compound',
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        true
      )
    )
    const bowtie = buildTopology(
      'bowtie',
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      true
    )
    const degenerate = buildTopology('degenerate', [{ x: 0, y: 0 }], false)

    const centerPlan = resolvePlan(simpleClosed, stroke('solid', 'center'))
    const simpleInsidePlan = resolvePlan(
      simpleClosed,
      stroke('solid', 'inside')
    )
    const openOutsidePlan = resolvePlan(open, stroke('solid', 'outside'))
    const compoundPlan = resolvePlan(compound, stroke('solid', 'inside'), {
      normalizedLegalDomain: normalizedLegalDomain(compound)
    })
    const missingSelfIntersectingPlan = resolvePlan(
      bowtie,
      stroke('dashed', 'outside')
    )
    const degeneratePlan = resolvePlan(degenerate, stroke('solid', 'inside'))

    expect(centerPlan).toMatchObject({
      domainMode: 'center-product',
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'none',
      requiresImplicitFillHoleSideResolution: false,
      diagnostics: ['center-or-unconstrained-stroke-uses-topology-arc-length']
    })
    expect(simpleInsidePlan).toMatchObject({
      domainMode: 'closed-constrained-domain',
      intervalDomainKind: 'source-path',
      sideAuthority: 'source-path-orientation',
      requiresImplicitFillHoleSideResolution: false,
      diagnostics: ['simple-closed-constrained-side-uses-source-orientation']
    })
    expect(openOutsidePlan).toMatchObject({
      domainMode: 'center-product',
      intervalDomainKind: 'topology-arc-length',
      sideAuthority: 'none',
      diagnostics: ['unbounded-open-center-product']
    })
    expect(compoundPlan).toMatchObject({
      domainMode: 'closed-constrained-domain',
      intervalDomainKind: 'legal-boundary-span',
      sideAuthority: 'implicit-fill-hole-domain',
      requiresImplicitFillHoleSideResolution: true,
      splitRangeDomains: [],
      diagnostics: [
        'compound-constrained-uses-normalized-legal-boundary-domains',
        'side-authority-is-implicit-fill-hole-domain'
      ]
    })
    expect(compoundPlan.legalBoundaryDomains).toHaveLength(2)
    expect(missingSelfIntersectingPlan).toMatchObject({
      domainMode: null,
      intervalDomainKind: 'none',
      sideAuthority: 'none',
      diagnostics: ['self-intersecting-split-range-source-path-missing']
    })
    expect(degeneratePlan).toMatchObject({
      domainMode: null,
      intervalDomainKind: 'none',
      sideAuthority: 'none',
      diagnostics: ['degenerate-topology-has-no-product']
    })

    expectNoVisibleStrokeProductFields({
      centerPlan,
      simpleInsidePlan,
      openOutsidePlan,
      compoundPlan,
      missingSelfIntersectingPlan,
      degeneratePlan
    })
  })

  it('keeps StrokeDomainPlan code free of product, join, cap, and renderer ownership', () => {
    const source = readFileSync(domainPlanSourcePath, 'utf8')

    for (const forbiddenToken of [
      'DashProductInterval',
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries',
      'strokePathStyle',
      'buildSolidCenterStrokeFinalFaces',
      'toSolidCenterStrokeRenderEntriesFromFinalFaces',
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
    assertStrokeParameterCoverageForStep('resolve-stroke-domains')
  })

})
