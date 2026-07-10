import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  normalizeResolvedStrokePacketGeometry,
  type SolidCenterStrokeResolvedPacket
} from '../../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeRegionPacketsFromFinalFaces } from '../../components/stroke-render/stroke-region-packet'
import type { StrokeFinalFace } from '../../components/stroke-render/stroke-final-face'

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
const solidCenterSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts'
)
const constrainedDashedSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
)

const extractFunctionSource = (source: string, declaration: string) => {
  const start = source.indexOf(declaration)
  expect(start).toBeGreaterThanOrEqual(0)

  const openBrace = source.indexOf('{', start)
  expect(openBrace).toBeGreaterThan(start)

  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  throw new Error(`Unable to extract function source for ${declaration}`)
}

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

const validPolygon = [
  { x: 2, y: 4 },
  { x: 18, y: 4 },
  { x: 18, y: 24 },
  { x: 2, y: 24 }
]

const invalidPolygon = [
  { x: 100, y: 100 },
  { x: 102, y: 102 }
]

const renderDescriptor = {
  clipPolygons: [[{ x: 0, y: 0 }]],
  strokePaths: [[{ x: 0, y: 0 }]]
}
const revisionSet = {
  sourceRevision: 'source:1',
  topologyRevision: 'topology:1',
  strokeRevision: 'stroke:1',
  dashRevision: 'dash:1',
  legalityRevision: 'legality:1',
  productRevision: 'product:1',
  renderRevision: 'render:1'
}
const productEvidenceEnvelope = {
  bodyProductIds: ['body:resolved'],
  terminalOwnershipOverlays: [],
  smoothContinuityOwnershipOverlays: []
}
const debugMeta = {
  ownerStepId: 'apply-legality',
  sourceOwnerStepId: 'build-source-vertex-join-products',
  sourceProductId: 'product:source-vertex-join',
  ownerStage: 'Stroke Geometry legality clipping',
  routeId: 'apply-legality',
  revisionSet,
  productEvidenceEnvelope
}
const paint = {
  geometryId: 'geometry:resolved',
  color: 0x777777,
  alpha: 1,
  paintKey: 'paint:identity'
}

const packet: SolidCenterStrokeResolvedPacket = {
  geometry: {
    geometryId: 'geometry:resolved',
    polygons: [invalidPolygon, validPolygon],
    bounds: {
      minX: 100,
      minY: 100,
      maxX: 102,
      maxY: 102
    },
    renderDescriptor,
    debugMeta
  },
  paint
}

describe('stroke flow step 34: build-resolved-stroke-regions', () => {
  it('keeps build-resolved-stroke-regions as the thirty-fourth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-resolved-stroke-regions'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-resolved-stroke-regions'
      ])
    }
  })

  it('declares the exact resolved packet implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'build-resolved-stroke-regions'
    )

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry resolved packet assembly',
      allowedInputs: [
        'legality-applied canonical product packets',
        'legality-applied descriptor-backed body product units',
        'terminal and smooth ownership overlays',
        'post-legality ConstrainedDashedProductEvidenceEnvelope',
        'stroke geometry debug metadata and revision sets',
        'paint packet references emitted by product builders',
        'declared source, topology/domain, dash-allocation, legal-domain, join-ownership, and normalized stroke cache signatures'
      ],
      requiredOutputs: [
        'ResolvedStrokeProductRecord records',
        'normalized packet polygons and bounds when canonical polygons exist',
        'unchanged body geometry programs and ownership overlays when descriptor-backed products exist',
        'unchanged ConstrainedDashedProductEvidenceEnvelope',
        'unchanged paint packet references',
        'unchanged renderDescriptor and debugMeta channels',
        'one immutable resolved-packet cache-key basis with early, full, and join-independent aliases'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('normalizes only packet polygons and bounds while preserving paint and metadata identities', () => {
    const normalized = normalizeResolvedStrokePacketGeometry([packet])

    expect(normalized).toHaveLength(1)
    expect(normalized[0].geometry.polygons).toEqual([validPolygon])
    expect(normalized[0].geometry.bounds).toEqual({
      minX: 2,
      minY: 4,
      maxX: 18,
      maxY: 24
    })
    expect(normalized[0].paint).toBe(paint)
    expect(normalized[0].geometry.renderDescriptor).toBe(renderDescriptor)
    expect(normalized[0].geometry.debugMeta).toBe(debugMeta)
    expect(normalized[0].geometry.debugMeta).toMatchObject({
      ownerStepId: 'apply-legality',
      sourceOwnerStepId: 'build-source-vertex-join-products',
      sourceProductId: 'product:source-vertex-join'
    })
    expect(normalized[0].geometry.debugMeta?.revisionSet).toBe(revisionSet)
    expect(normalized[0].geometry.debugMeta?.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
  })

  it('preserves final-face owner, terminal, and seam identity in region packets', () => {
    const face: StrokeFinalFace = {
      faceId: 'face:resolved-identity',
      sourceGeometryIds: ['geometry:resolved-identity'],
      polygons: [validPolygon],
      bounds: { minX: 2, minY: 4, maxX: 18, maxY: 24 },
      visualPacketKey: 'visual:resolved-identity',
      paintKey: 'paint:resolved-identity',
      strokeSpecKey: 'stroke:resolved-identity',
      ownerSet: [{ ownerKey: 'owner:resolved-identity' }],
      ownerStepIds: ['build-source-vertex-join-products'],
      intervalIds: ['interval:resolved-identity'],
      terminalRoles: ['start'],
      seamBoundaryIds: ['seam:resolved-identity'],
      sourceSpanIds: ['span:resolved-identity'],
      sourceNetworkIds: ['network:resolved-identity'],
      sourceContourIds: ['contour:resolved-identity'],
      legalDomainIds: ['legal:resolved-identity'],
      paint: {
        geometryId: 'geometry:resolved-identity',
        color: 0x777777,
        alpha: 1
      }
    }

    expect(buildStrokeRegionPacketsFromFinalFaces([face])).toEqual([
      expect.objectContaining({
        ownerStepIds: ['build-source-vertex-join-products'],
        intervalIds: ['interval:resolved-identity'],
        terminalRoles: ['start'],
        seamBoundaryIds: ['seam:resolved-identity'],
        sourceSpanIds: ['span:resolved-identity'],
        legalDomainIds: ['legal:resolved-identity']
      })
    ])
  })

  it('does not build final faces, render entries, hit/export packets, joins, caps, or descriptor-visible products', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperSource = extractFunctionSource(
      source,
      'export const normalizeResolvedStrokePacketGeometry = ('
    )

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'renderEntries',
      'hitPacket',
      'exportPacket',
      'endpointCap',
      'source-vertex-join',
      'strokePathStyle',
      'descriptorProductPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('composes the resolved-packet cache common basis once and derives every alias without semantic reserialization', () => {
    const source = readFileSync(constrainedDashedSourcePath, 'utf8')
    const basisDeclaration =
      'const buildConstrainedDashedPacketStageCacheKeyBasis = ('
    const fullAliasDeclaration =
      'const buildConstrainedDashedPacketStageCacheKey = ('
    const joinIndependentAliasDeclaration =
      'const buildConstrainedDashedJoinIndependentPacketStageCacheKey = ('
    const packetStageCacheLookupDeclaration =
      'const getCachedConstrainedDashedPacketStage = ('
    const resolvedPacketsDeclaration =
      'export const buildConstrainedDashedStrokeResolvedPackets = ('
    const basisStart = source.indexOf(basisDeclaration)
    const fullAliasStart = source.indexOf(fullAliasDeclaration)
    const joinIndependentAliasStart = source.indexOf(
      joinIndependentAliasDeclaration
    )
    const joinIndependentAliasEnd = source.indexOf(
      packetStageCacheLookupDeclaration,
      joinIndependentAliasStart
    )
    const resolvedPacketsStart = source.indexOf(resolvedPacketsDeclaration)

    expect(basisStart).toBeGreaterThanOrEqual(0)
    expect(fullAliasStart).toBeGreaterThan(basisStart)
    expect(joinIndependentAliasStart).toBeGreaterThan(fullAliasStart)
    expect(joinIndependentAliasEnd).toBeGreaterThan(joinIndependentAliasStart)
    expect(resolvedPacketsStart).toBeGreaterThan(joinIndependentAliasStart)

    const basisSource = source.slice(basisStart, fullAliasStart)
    const fullAliasSource = source.slice(
      fullAliasStart,
      joinIndependentAliasStart
    )
    const joinIndependentAliasSource = source.slice(
      joinIndependentAliasStart,
      joinIndependentAliasEnd
    )
    const resolvedPacketsSource = source.slice(resolvedPacketsStart)

    expect(
      basisSource.match(/buildImplicitFillRegionRelativeCacheSignature\(/g) ?? []
    ).toHaveLength(1)
    for (const aliasSource of [fullAliasSource, joinIndependentAliasSource]) {
      expect(aliasSource).not.toContain(
        'buildImplicitFillRegionRelativeCacheSignature('
      )
      expect(aliasSource).not.toContain('formatTranslationInvariantCacheNumber(')
    }
    expect(
      resolvedPacketsSource.match(
        /buildConstrainedDashedPacketStageCacheKeyBasis\(/g
      ) ?? []
    ).toHaveLength(1)
    expect(
      resolvedPacketsSource.match(/buildConstrainedDashedPacketStageCacheKey\(/g) ??
        []
    ).toHaveLength(2)
    expect(
      resolvedPacketsSource.match(
        /buildConstrainedDashedJoinIndependentPacketStageCacheKey\(/g
      ) ?? []
    ).toHaveLength(1)
    expect(resolvedPacketsSource).toContain(
      'packetStageCacheKeys.packetStageKey'
    )
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-resolved-stroke-regions')
  })
})
