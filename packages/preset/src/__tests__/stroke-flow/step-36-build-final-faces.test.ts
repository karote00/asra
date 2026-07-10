import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { buildArrangedStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-candidate-arrangement'
import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  createGeometryBackendCapabilities,
  type GeometryBackend
} from '../../components/stroke-render/geometry-backend'
import {
  buildStrokeFinalFacesFromPaintAttachedRegions,
  buildStrokeFinalFacesFromResolvedPackets
} from '../../components/stroke-render/stroke-final-face'

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
  crossStepArtifactLifecycleMatrix: Record<
    string,
    {
      artifactClassId: string
      computedAt: string
      preserveThrough: string[]
      consumedBy: string[]
      mustNotRecomputeAfter: string
      mayDropOnlyWhen: string[]
      dropEvidenceRequired: string[]
      downstreamAuthority: boolean
    }
  >
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
const finalFaceSourcePath = resolve(
  repoRoot,
  'packages/preset/src/components/stroke-render/stroke-final-face.ts'
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

const visiblePolygon = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 20 },
  { x: 0, y: 20 }
]

const evidencePolygon = [
  { x: 100, y: 100 },
  { x: 120, y: 100 },
  { x: 120, y: 120 },
  { x: 100, y: 120 }
]

const renderDescriptor = {
  strokePathGroups: [
    {
      strokePaths: [[{ x: 0, y: 0 }]],
      strokePathStyle: {
        width: 10,
        cap: 'butt' as const,
        join: 'miter' as const,
        miterLimit: 4
      }
    }
  ],
  descriptorProductPolygons: [evidencePolygon],
  fillClipPolygons: [evidencePolygon]
}

const paint = {
  geometryId: 'geometry:final',
  color: 0x777777,
  alpha: 1,
  paintKey: 'paint:final'
}

const arrangementBackend: GeometryBackend = {
  backendId: 'step-36-arrangement-test',
  backendVersion: 'step-36-arrangement-test@1',
  capabilities: createGeometryBackendCapabilities(true),
  coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  union: (regions) => regions,
  difference: (regions) => regions,
  intersection: (regions) => regions,
  offset: () => [],
  buildArrangement: (candidates) =>
    candidates.map((candidate) => ({
      faceId: `arranged:${candidate.candidateId}`,
      geometry: candidate.geometry,
      claimedBy: [candidate],
      legalState: {
        insideFillDomain: true,
        outsideFillDomain: true
      }
    }))
}

describe('stroke flow step 36: build-final-faces', () => {
  it('keeps build-final-faces as the thirty-sixth runtime step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'build-final-faces')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'build-final-faces'
      ])
    }
  })

  it('declares the exact final face implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'build-final-faces')

    expect(step).toMatchObject({
      ownerStage: 'Stroke Geometry final face assembly',
      allowedInputs: [
        'paint-attached semantic stroke records',
        'canonical product packets',
        'descriptor-backed body product units with visible/evidence route separation',
        'terminal and smooth ownership overlays',
        'complete ConstrainedDashedProductEvidenceEnvelope'
      ],
      requiredOutputs: [
        'final faces for canonical visible product packets',
        'final faces carrying renderDescriptor for descriptor-visible routes',
        'final-face product identity set preserving body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal domain, and source span ids for downstream render/hit/export consumption',
        'final faces carrying the unchanged ConstrainedDashedProductEvidenceEnvelope',
        'separated hit/export product evidence references and optional non-product diagnostic evidence references'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
  })

  it('declares final-face identity as the downstream data-format gate', () => {
    const data = loadInspectorData()
    const lifecycle =
      data.crossStepArtifactLifecycleMatrix['artifact:finalFaces']

    expect(lifecycle).toMatchObject({
      artifactClassId: 'required-product-artifact',
      computedAt: 'build-final-faces',
      mustNotRecomputeAfter: 'materialize-stroke-product-descriptors',
      downstreamAuthority: true
    })
    expect(lifecycle.preserveThrough).toEqual(
      expect.arrayContaining([
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries',
        'hit-export'
      ])
    )
    expect(lifecycle.dropEvidenceRequired).toEqual(
      expect.arrayContaining([
        'final-face id',
        'owner / interval / terminal / seam / legal-domain / source-span identity set',
        'empty-output reason when no legal final face exists'
      ])
    )
  })

  it('builds final faces from canonical visible product polygons while carrying descriptor channels unchanged', () => {
    const productEvidenceEnvelope = {
      bodyProductIds: ['body:final'],
      terminalOwnershipOverlays: [
        { overlayId: 'terminal:final' }
      ],
      smoothContinuityOwnershipOverlays: [
        { overlayId: 'smooth:final' }
      ]
    }
    const faces = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:final',
          polygons: [visiblePolygon],
          bounds: {
            minX: 0,
            minY: 0,
            maxX: 20,
            maxY: 20
          },
          debugMeta: {
            productMode: 'post-legality-product',
            productSignature: 'source-vertex-join',
            routeId: 'build-final-faces',
            ownerStepId: 'apply-legality',
            sourceOwnerStepId: 'build-source-vertex-join-products',
            ownerKey: 'owner:face',
            strokeId: 'stroke:face',
            intervalIds: ['interval:face'],
            terminalRoles: ['start'],
            seamBoundaryIds: ['seam:face'],
            legalDomainIds: ['legal:face'],
            sourceSpanIds: ['source-span:face'],
            productEvidenceEnvelope
          },
          renderDescriptor
        },
        paint
      }
    ])

    expect(faces).toHaveLength(1)
    expect(faces[0]).toMatchObject({
      faceId: 'geometry:final',
      sourceGeometryIds: ['geometry:final'],
      polygons: [visiblePolygon],
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 20,
        maxY: 20
      },
      ownerStepIds: [
        'apply-legality',
        'build-source-vertex-join-products'
      ],
      intervalIds: ['interval:face'],
      terminalRoles: ['start'],
      seamBoundaryIds: ['seam:face'],
      legalDomainIds: ['legal:face'],
      sourceSpanIds: ['source-span:face'],
      productMode: 'post-legality-product',
      productSignature: 'source-vertex-join',
      productEvidenceEnvelope
    })
    expect(faces[0].productEvidenceEnvelope).toBe(productEvidenceEnvelope)
    expect(faces[0].debugMeta?.productEvidenceEnvelope).toBe(
      productEvidenceEnvelope
    )
    expect(faces[0].renderDescriptor).toBe(renderDescriptor)
    expect(faces[0].paint).toBe(paint)
    expect(faces[0].polygons).not.toEqual([evidencePolygon])
  })

  it('preserves post-legality canonical polygon boundaries without final-face cleanup', () => {
    const postLegalityPolygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 0.01 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const [face] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:post-legality-boundary',
          polygons: [postLegalityPolygon],
          bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
          debugMeta: {
            productMode: 'post-legality-product',
            productSignature: 'constrained-dashed:inside:source-vertex-join',
            strokePosition: 'inside',
            routeId: 'legality-product-unit-clipping',
            ownerStepId: 'apply-legality',
            sourceOwnerStepId: 'build-source-vertex-join-products',
            ownerKey: 'owner:post-legality-boundary',
            strokeId: 'stroke:post-legality-boundary',
            legalDomainIds: ['legal:post-legality-boundary']
          }
        },
        paint: {
          ...paint,
          geometryId: 'geometry:post-legality-boundary'
        }
      }
    ])

    expect(face?.polygons).toEqual([postLegalityPolygon])
  })

  it('preserves descriptor-visible channels when exact arrangement promotes a final face', () => {
    const [face] = buildArrangedStrokeFinalFacesFromResolvedPackets(
      [
        {
          geometry: {
            geometryId: 'geometry:arranged-descriptor',
            polygons: [visiblePolygon],
            bounds: {
              minX: 0,
              minY: 0,
              maxX: 20,
              maxY: 20
            },
            debugMeta: {
              productMode: 'closed-constrained-domain',
              productSignature: 'constrained-solid:inside:mask-model',
              routeId:
                'constrained-solid-same-owner-smooth-span-descriptor',
              ownerStepId: 'build-constrained-solid-products',
              ownerKey: 'owner:arranged-descriptor',
              strokeId: 'stroke:arranged-descriptor',
              strokePosition: 'inside',
              sourceSpanIds: ['source-span:arranged-descriptor'],
              legalDomainIds: ['legal:arranged-descriptor'],
              arrangementStatus: 'exact'
            },
            renderDescriptor
          },
          paint
        }
      ],
      { backend: arrangementBackend }
    )

    expect(face).toBeDefined()
    expect(face?.renderDescriptor).toBe(renderDescriptor)
    expect(face?.polygons).toEqual([visiblePolygon])
  })

  it('preserves paint-attached region identity in final faces', () => {
    const [face] = buildStrokeFinalFacesFromPaintAttachedRegions([
      {
        regionId: 'region:final-identity',
        sourceGeometryIds: ['geometry:final-identity'],
        polygons: [visiblePolygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        ownerSet: [{ ownerKey: 'owner:final-identity' }],
        ownerStepIds: ['build-terminal-body-products'],
        intervalIds: ['interval:final-identity'],
        terminalRoles: ['end'],
        seamBoundaryIds: ['seam:final-identity'],
        sourceSpanIds: ['span:final-identity'],
        sourceNetworkIds: ['network:final-identity'],
        sourceContourIds: ['contour:final-identity'],
        legalDomainIds: ['legal:final-identity'],
        paintKey: 'paint:final-identity',
        paint: {
          geometryId: 'region:final-identity',
          color: 0x777777,
          alpha: 1,
          paintKey: 'paint:final-identity',
          paintBounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 }
        }
      }
    ])

    expect(face).toMatchObject({
      ownerStepIds: ['build-terminal-body-products'],
      intervalIds: ['interval:final-identity'],
      terminalRoles: ['end'],
      seamBoundaryIds: ['seam:final-identity'],
      sourceSpanIds: ['span:final-identity'],
      legalDomainIds: ['legal:final-identity']
    })
  })

  it('keeps final face assembly free of render entry and hit/export construction', () => {
    const source = readFileSync(finalFaceSourcePath, 'utf8')
    const start = source.indexOf(
      'export const buildStrokeFinalFacesFromResolvedPackets = <'
    )
    const end = source.indexOf(
      'const buildDebugMetaFromPaintAttachedRegion',
      start
    )
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const helperSource = source.slice(start, end)

    for (const forbiddenToken of [
      'renderEntries',
      'hitPacket',
      'exportPacket',
      'diagnosticGeometry',
      'masked-source-stroke',
      'descriptorProductPolygons'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('build-final-faces')
  })
})
