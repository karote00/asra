import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys,
  expectNoStrokeParameterSourceTokens
} from './stroke-parameter-coverage-test-helper'
import {
  buildPathTopologyModel,
  type PathTopologyModel
} from '../../components/stroke-render/path-topology-model'
import {
  getStrokeProductFamilyMatrix,
  resolveSourceFamily
} from '../../components/stroke-render/resolved-source-family'

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
const sourceFamilyPath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/resolved-source-family.ts'
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

const solidInsideStroke = {
  style: 'solid' as const,
  position: 'inside' as const
}
const dashedOutsideStroke = {
  style: 'dashed' as const,
  position: 'outside' as const
}

const forbiddenEvidenceTerms =
  /\b(visual|pixel|screenshot|projection|runtime|render|final faces?)\b/i

describe('stroke flow step 21: resolve-source-families', () => {
  it('keeps resolve-source-families as the current or verified twenty-first step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'resolve-source-families'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'resolve-source-families'
      ])
    }
  })

  it('declares the exact source-family implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'resolve-source-families'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry',
      allowedInputs: [
        'PathTopologyModel records from shared geometry',
        'normalized stroke style and position'
      ],
      requiredOutputs: [
        'ResolvedSourceFamily records',
        'familyScope product-rule evidence',
        'legal-domain hints for downstream StrokeDomainPlan'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/resolved-source-family.ts'
      ]
    })
    expect(step?.forbiddenContributors).toEqual(
      expect.arrayContaining([
        'StrokeDomainPlan output',
        'DashProductInterval output',
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'render entries',
        'renderer projection output'
      ])
    )
  })

  it('classifies source families from topology evidence only', () => {
    const open = resolveSourceFamily({
      topology: buildTopology(
        'open',
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 }
        ],
        false
      ),
      stroke: solidInsideStroke
    })
    const simpleClosed = resolveSourceFamily({
      topology: buildTopology(
        'simple',
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        true
      ),
      stroke: solidInsideStroke
    })
    const compoundClosed = resolveSourceFamily({
      topology: withCompoundLegalDomains(simpleClosedTopology()),
      stroke: solidInsideStroke
    })
    const selfIntersecting = resolveSourceFamily({
      topology: buildTopology(
        'bowtie',
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
          { x: 100, y: 0 }
        ],
        true
      ),
      stroke: dashedOutsideStroke
    })
    const degenerate = resolveSourceFamily({
      topology: buildTopology('degenerate', [{ x: 0, y: 0 }], false),
      stroke: solidInsideStroke
    })

    expect(open.productRuleEvidence.familyScope).toBe('open')
    expect(open.legalDomainHints).toMatchObject({
      closed: false,
      compound: false,
      selfIntersecting: false,
      fillRule: 'evenodd'
    })
    expect(simpleClosed.productRuleEvidence.familyScope).toBe('simple-closed')
    expect(simpleClosed.legalDomainHints.legalDomainIds).toHaveLength(1)
    expect(compoundClosed.productRuleEvidence.familyScope).toBe(
      'compound-closed'
    )
    expect(compoundClosed.legalDomainHints).toMatchObject({
      closed: true,
      compound: true,
      selfIntersecting: false
    })
    expect(selfIntersecting.productRuleEvidence.familyScope).toBe(
      'self-intersecting-closed'
    )
    expect(selfIntersecting.legalDomainHints.selfIntersecting).toBe(true)
    expect(degenerate.productRuleEvidence).toMatchObject({
      familyScope: 'degenerate',
      status: 'not-applicable',
      requiredForCompletion: false,
      gaps: []
    })
    expectNoStrokeParameterOutputKeys({
      open,
      simpleClosed,
      compoundClosed,
      selfIntersecting,
      degenerate
    })
  })

  it('consumes only stroke style and position while ignoring other stroke-like fields', () => {
    const topology = buildTopology(
      'style-position-only',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ],
      false
    )
    const base = resolveSourceFamily({
      topology,
      stroke: solidInsideStroke
    })
    const withIgnoredStrokeFields = resolveSourceFamily({
      topology,
      stroke: {
        ...solidInsideStroke,
        fill: {
          visible: false,
          kind: 'gradient',
          color: '#ff0000',
          opacity: 0.2,
          gradient: { type: 'linear' },
          colorFormat: 'rgb',
          defaultColorFormat: 'hex'
        },
        width: 99,
        dash: 1,
        gap: 2,
        capType: 'round',
        joinType: 'miter',
        miterAngle: 12
      } as unknown as typeof solidInsideStroke
    })

    expect(withIgnoredStrokeFields).toEqual(base)
    expectNoStrokeParameterOutputKeys(withIgnoredStrokeFields)
  })

  it('keeps product-rule evidence free of downstream visual correctness claims', () => {
    const matrix = getStrokeProductFamilyMatrix()

    expect(matrix.length).toBeGreaterThan(0)
    for (const entry of matrix) {
      for (const evidence of entry.evidence) {
        expect(evidence).not.toMatch(forbiddenEvidenceTerms)
      }
      for (const gap of entry.gaps) {
        expect(gap).not.toMatch(forbiddenEvidenceTerms)
      }
    }
  })

  it('keeps source-family code free of downstream ownership and render output', () => {
    const source = readFileSync(sourceFamilyPath, 'utf8')

    expectNoStrokeParameterSourceTokens(source, [
      'stroke.style',
      'stroke.position'
    ])
    for (const forbiddenToken of [
      'resolveStrokeDomains',
      'allocateStrokeIntervals',
      'DashProductInterval',
      'buildSourceVertexJoinFootprint',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'renderSolidCenterStrokeEntries',
      'strokePathStyle',
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
    assertStrokeParameterCoverageForStep('resolve-source-families')
  })
})

const simpleClosedTopology = () =>
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
