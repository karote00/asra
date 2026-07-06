import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  toSolidCenterStrokeRenderEntriesFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { createGeometryBackendCapabilities } from '../../components/stroke-render/geometry-backend'

type RefactorStatus = 'locked' | 'active' | 'verified'

interface InspectorStep {
  id: string
  refactorStatus: RefactorStatus
  implementationFiles: string[]
  allowedInputs: string[]
  requiredOutputs: string[]
  ownerStage: string
  forbiddenContributors: string[]
  evidenceRequired: string[]
}

interface InspectorRoute {
  id: string
  cacheKeyInputs: string[]
  evidenceRequired: string[]
  limitations: string[]
  specRuleRefs: string[]
  computationContract?: {
    computedAt: string
    consumesArtifacts: string[]
    producesArtifacts: string[]
    consumedBy: string[]
    mustNotRecomputeAfter: string
    forbiddenLateComputation: string[]
  }
}

interface InspectorData {
  steps: InspectorStep[]
  conditionalRoutes: InspectorRoute[]
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

const routeById = (data: InspectorData, routeId: string): InspectorRoute => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as InspectorRoute
}

type RenderPacketInput = Parameters<
  typeof buildSolidCenterStrokeRenderEntriesFromRenderPackets
>[0][number]

type FinalFaceInput = Parameters<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[0][number]

type RenderEntryWithRuntimeOwnership = ReturnType<
  typeof toSolidCenterStrokeRenderEntriesFromFinalFaces
>[number] & {
  runtimeMeta?: {
    intervalIds?: string[]
    sourceSpanIds?: string[]
    sourceNetworkIds?: string[]
    sourceContourIds?: string[]
    legalDomainIds?: string[]
  }
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

const strokePathGroups = [
  {
    strokePaths: [[{ x: 0, y: 0 }]],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4,
      closed: false
    }
  }
]

const descriptorVisiblePacket = {
  channel: 'render' as const,
  visibility: 'visible' as const,
  geometryId: 'geometry:descriptor',
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  stroke: {
    color: 0x777777,
    alpha: 0.75,
    gradientStyle: null,
    paintKey: 'paint:descriptor'
  },
  primaryOwner: {
    ownerKey: 'owner:descriptor',
    strokeId: 'stroke:descriptor'
  },
  ownerSet: [
    {
      ownerKey: 'owner:descriptor',
      strokeId: 'stroke:descriptor'
    }
  ],
  descriptorRouteMode: 'descriptor-visible-route' as const,
  renderDescriptor: {
    strokePathGroups,
    strokeMaskPolygons: [evidencePolygon],
    fillClipPolygons: [evidencePolygon],
    fillExcludePolygons: [evidencePolygon],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'miter' as const,
      miterLimit: 4,
      closed: false
    }
  },
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'descriptor-visible-route',
    visibleContributor: 'declared visible strokePathGroups'
  }
} satisfies RenderPacketInput

const canonicalPacket = {
  channel: 'render' as const,
  visibility: 'visible' as const,
  geometryId: 'geometry:canonical',
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  stroke: {
    color: 0x333333,
    alpha: 1,
    gradientStyle: null,
    paintKey: 'paint:canonical'
  },
  primaryOwner: {
    ownerKey: 'owner:canonical',
    strokeId: 'stroke:canonical'
  },
  ownerSet: [
    {
      ownerKey: 'owner:canonical',
      strokeId: 'stroke:canonical'
    }
  ],
  descriptorRouteMode: 'canonical-product' as const,
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'canonical-final-face'
  }
} satisfies RenderPacketInput

const ownershipFinalFace = {
  faceId: 'face:ownership',
  sourceGeometryIds: ['geometry:ownership'],
  polygons: [visiblePolygon],
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 20,
    maxY: 20
  },
  visualPacketKey: 'visual:ownership',
  paintKey: 'paint:ownership',
  strokeSpecKey: 'stroke-spec:ownership',
  ownerSet: [
    {
      ownerKey: 'owner:ownership',
      strokeId: 'stroke:ownership',
      intervalId: 'interval:ownership'
    }
  ],
  intervalIds: ['interval:ownership'],
  sourceSpanIds: ['source-span:ownership'],
  sourceNetworkIds: ['network:ownership'],
  sourceContourIds: ['contour:ownership'],
  legalDomainIds: ['legal-domain:ownership'],
  productMode: 'post-legality-product',
  productSignature: 'canonical-final-face',
  domainMode: 'center',
  topologyFamily: 'open',
  paint: {
    geometryId: 'geometry:ownership',
    color: 0x4488cc,
    alpha: 1,
    gradientStyle: null,
    paintKey: 'paint:ownership'
  },
  debugMeta: {
    routeId: 'render-entries',
    productMode: 'post-legality-product',
    productSignature: 'canonical-final-face',
    domainMode: 'center',
    topologyFamily: 'open',
    strokePosition: 'center',
    revisionSet: {
      geometryRevision: 1,
      paintRevision: 1,
      dashAndGapRevision: 1,
      topologyRevision: 1,
      strokeSemanticsRevision: 1
    }
  }
} satisfies FinalFaceInput

const outsideDescriptorFinalFace = {
  ...ownershipFinalFace,
  faceId: 'face:outside-descriptor',
  sourceGeometryIds: ['geometry:outside-descriptor'],
  visualPacketKey: 'visual:outside-descriptor',
  paintKey: 'paint:outside-descriptor',
  strokeSpecKey: 'stroke-spec:outside-descriptor',
  ownerSet: [
    {
      ownerKey: 'owner:outside-descriptor',
      strokeId: 'stroke:outside-descriptor',
      intervalId: 'interval:outside-descriptor'
    }
  ],
  intervalIds: ['interval:outside-descriptor'],
  sourceSpanIds: ['source-span:outside-descriptor'],
  sourceNetworkIds: ['network:outside-descriptor'],
  sourceContourIds: ['contour:outside-descriptor'],
  legalDomainIds: ['legal-domain:outside-descriptor'],
  productSignature: 'constrained-dashed-outside-descriptor',
  domainMode: 'outside',
  topologyFamily: 'self-intersecting',
  renderDescriptor: {
    strokePathGroups,
    descriptorProductPolygons: [evidencePolygon],
    clipPolygons: [evidencePolygon],
    fillExcludePolygons: [evidencePolygon],
    strokePathStyle: {
      width: 10,
      cap: 'butt' as const,
      join: 'bevel' as const,
      miterAngle: 28,
      miterLimit: 4,
      closed: false
    }
  },
  debugMeta: {
    ...ownershipFinalFace.debugMeta,
    productSignature: 'constrained-dashed-outside-descriptor',
    domainMode: 'outside',
    topologyFamily: 'self-intersecting',
    strokePosition: 'outside' as const,
    strokeWidth: 10,
    strokeJoin: 'bevel' as const,
    strokeCap: 'butt' as const,
    visibleContributor: 'dash-interval-body',
    routeId: 'render-entries'
  }
} satisfies FinalFaceInput

const overlapProbePolygon = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 30, y: 30 },
  { x: 10, y: 30 }
]

const outsidePolygonFace = (
  faceId: string,
  polygon: typeof visiblePolygon
) =>
  ({
    ...ownershipFinalFace,
    faceId,
    sourceGeometryIds: [`geometry:${faceId}`],
    polygons: [polygon],
    bounds: {
      minX: Math.min(...polygon.map((point) => point.x)),
      minY: Math.min(...polygon.map((point) => point.y)),
      maxX: Math.max(...polygon.map((point) => point.x)),
      maxY: Math.max(...polygon.map((point) => point.y))
    },
    visualPacketKey: `visual:${faceId}`,
    ownerSet: [
      {
        ownerKey: `owner:${faceId}`,
        strokeId: 'stroke:outside-overlap',
        intervalId: `interval:${faceId}`
      }
    ],
    intervalIds: [`interval:${faceId}`],
    productSignature: `constrained-dashed:outside:${faceId}`,
    domainMode: 'outside',
    topologyFamily: 'self-intersecting',
    debugMeta: {
      ...ownershipFinalFace.debugMeta,
      productSignature: `constrained-dashed:outside:${faceId}`,
      domainMode: 'outside',
      topologyFamily: 'self-intersecting',
      strokePosition: 'outside' as const,
      strokeWidth: 10,
      strokeJoin: 'bevel' as const,
      strokeCap: 'butt' as const,
      visibleContributor: 'dash-interval-body'
    }
  }) satisfies FinalFaceInput

const outsideDescriptorFace = (
  faceId: string,
  polygon: typeof visiblePolygon
) =>
  ({
    ...outsidePolygonFace(faceId, polygon),
    renderDescriptor: {
      descriptorProductPolygons: [polygon],
      clipPolygons: [polygon],
      strokePathGroups: [
        {
          strokePaths: [
            [
              { x: polygon[0].x, y: polygon[0].y + 10 },
              { x: polygon[1].x, y: polygon[1].y + 10 }
            ]
          ],
          strokePathStyle: {
            width: 10,
            cap: 'butt' as const,
            join: 'bevel' as const,
            miterAngle: 28,
            miterLimit: 4,
            closed: false
          }
        }
      ]
    }
  }) satisfies FinalFaceInput

describe('stroke flow step 38: render-entries', () => {
  it('keeps render-entries as the current or verified thirty-eighth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'render-entries')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual(['render-entries'])
    }
  })

  it('declares the exact render-entry implementation surface', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'render-entries')

    expect(step).toMatchObject({
      ownerStage: 'Product Output render-entry materialization',
      allowedInputs: [
        'visible render packets',
        'renderDescriptor strokePathGroups, strokePaths, strokeMaskPolygons, descriptorProductPolygons, fillClipPolygons, fillExcludePolygons, and product metadata'
      ],
      requiredOutputs: [
        'renderer-ready strokePathGroups or strokePaths for descriptor-visible routes',
        'renderer-ready strokeMaskPolygons only for visible polygon or cap-mask routes',
        'fillClip/fillExclude constraints and descriptor evidence carried separately'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/vector.ts'
      ]
    })
    expect(step?.evidenceRequired).toEqual(
      expect.arrayContaining([
        'descriptorProductPolygons evidence-only reason when strokePathGroups exist',
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap'
      ])
    )
  })

  it('declares render entries as the final stage for visible overlap and alpha decisions', () => {
    const data = loadInspectorData()
    const route = routeById(data, 'canonical-final-face-render-entry')

    expect(route.cacheKeyInputs).toContain('same-paint overlap signature')
    expect(route.evidenceRequired).toEqual(
      expect.arrayContaining([
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap'
      ])
    )
    expect(route.limitations.join(' ')).toContain(
      'Same-paint overlap must be resolved as a single-composite render entry or carry equivalent alpha-safe evidence before renderer projection.'
    )
    expect(route.computationContract).toMatchObject({
      computedAt: 'render-entries',
      consumesArtifacts: ['artifact:finalFaces'],
      producesArtifacts: ['artifact:renderEntries'],
      consumedBy: ['renderer-projection', 'runtime-diagnostics'],
      mustNotRecomputeAfter: 'renderer-projection'
    })
    expect(route.computationContract?.forbiddenLateComputation).toEqual(
      expect.arrayContaining([
        'join shape decision',
        'cap shape decision',
        'same-paint alpha decision without render-entry evidence',
        'descriptor evidence promotion'
      ])
    )
    expect(route.specRuleRefs).toContain(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
    )
  })

  it('keeps strokePathGroups as the visible descriptor route without promoting evidence to strokeMaskPolygons', () => {
    const [entry] = buildSolidCenterStrokeRenderEntriesFromRenderPackets([
      descriptorVisiblePacket
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        channel: 'render-entry',
        visibility: 'visible',
        cacheKey: 'geometry:descriptor',
        polygons: [visiblePolygon],
        stroke: descriptorVisiblePacket.stroke,
        strokePathGroups,
        fillClipPolygons: [evidencePolygon],
        fillExcludePolygons: [evidencePolygon],
        strokePathStyle: {
          width: 10,
          cap: 'butt',
          join: 'miter',
          miterLimit: 4,
          closed: false
        },
        evidenceChannel: {
          descriptorProductPolygonsVisible: false,
          reason: 'descriptor-visible-route'
        }
      })
    )
    expect(entry?.strokeMaskPolygons).toBeUndefined()
  })

  it('uses strokeMaskPolygons only for canonical visible polygon routes', () => {
    const [entry] = buildSolidCenterStrokeRenderEntriesFromRenderPackets([
      canonicalPacket
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        channel: 'render-entry',
        visibility: 'visible',
        cacheKey: 'geometry:canonical',
        strokeMaskPolygons: [visiblePolygon],
        evidenceChannel: {
          descriptorProductPolygonsVisible: false,
          reason: 'canonical-visible-product'
        }
      })
    )
    expect(entry).not.toHaveProperty('strokePathGroups')
    expect(entry).not.toHaveProperty('strokePaths')
  })

  it('carries final-face ownership metadata into render-entry runtime metadata', () => {
    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      ownershipFinalFace
    ]) as RenderEntryWithRuntimeOwnership[]

    expect(entry?.runtimeMeta).toMatchObject({
      intervalIds: ['interval:ownership'],
      sourceSpanIds: ['source-span:ownership'],
      sourceNetworkIds: ['network:ownership'],
      sourceContourIds: ['contour:ownership'],
      legalDomainIds: ['legal-domain:ownership']
    })
  })

  it('keeps constrained outside dashed descriptor strokePathGroups visible without polygon collapse', () => {
    const [entry] = toSolidCenterStrokeRenderEntriesFromFinalFaces([
      outsideDescriptorFinalFace
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        strokePathGroups,
        fillExcludePolygons: [evidencePolygon]
      })
    )
    expect(entry?.polygons).toEqual([visiblePolygon])
    expect(entry?.strokeMaskPolygons).toBeUndefined()
    expect(entry?.runtimeMeta).toMatchObject({
      intervalIds: ['interval:outside-descriptor'],
      sourceSpanIds: ['source-span:outside-descriptor'],
      sourceNetworkIds: ['network:outside-descriptor'],
      sourceContourIds: ['contour:outside-descriptor'],
      legalDomainIds: ['legal-domain:outside-descriptor']
    })
  })

  it('bypasses constrained dashed descriptor overlap collapse when strokePathGroups own visible output', () => {
    let intersectionCalls = 0
    let unionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        unionCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsideDescriptorFace('outside-descriptor-a', visiblePolygon),
        outsideDescriptorFace('outside-descriptor-b', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(intersectionCalls).toBe(0)
    expect(unionCalls).toBe(0)
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.polygons)).toEqual([
      [visiblePolygon],
      [overlapProbePolygon]
    ])
    expect(entries.every((entry) => entry.strokePathGroups?.length === 1)).toBe(
      true
    )
    expect(entries.every((entry) => entry.strokeMaskPolygons === undefined)).toBe(
      true
    )
  })

  it('keeps constrained dashed descriptor faces out of mixed polygon collapse groups', () => {
    let intersectionCalls = 0
    let unionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        unionCalls += 1
        return []
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsideDescriptorFace('outside-descriptor-mixed', visiblePolygon),
        outsidePolygonFace('outside-polygon-mixed', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(intersectionCalls).toBe(0)
    expect(unionCalls).toBe(0)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        polygons: [visiblePolygon],
        strokePathGroups: expect.any(Array),
        strokeMaskPolygons: undefined
      })
    )
    expect(entries[1]).toEqual(
      expect.objectContaining({
        polygons: [overlapProbePolygon],
        strokePathGroups: undefined
      })
    )
  })

  it('trusts exact outside dashed overlap decisions without approximate fallback collapse', () => {
    let intersectionCalls = 0
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(true),
      intersection: () => {
        intersectionCalls += 1
        return []
      },
      union: () => {
        throw new Error('unexpected outside dashed union')
      }
    }

    const entries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      [
        outsidePolygonFace('outside-a', visiblePolygon),
        outsidePolygonFace('outside-b', overlapProbePolygon)
      ],
      { exactBackend }
    )

    expect(entries).toHaveLength(2)
    expect(intersectionCalls).toBe(0)
    expect(entries.map((entry) => entry.cacheKey)).toEqual([
      'geometry:outside-a',
      'geometry:outside-b'
    ])
  })

  it('keeps render-entry materialization free of geometry construction or renderer projection', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')
    const helperStart = source.indexOf(
      'export const buildSolidCenterStrokeRenderEntriesFromRenderPackets = ('
    )
    const helperEnd = source.indexOf(
      'const defineLazySolidCenterStrokeExportPackets',
      helperStart
    )
    expect(helperStart).toBeGreaterThanOrEqual(0)
    expect(helperEnd).toBeGreaterThan(helperStart)
    const helperSource = source.slice(helperStart, helperEnd)

    for (const forbiddenToken of [
      'buildStrokeFinalFaces',
      'buildSourceVertexJoin',
      'endpoint cap repair',
      'renderSolidCenterStrokeEntries',
      'descriptor.descriptorProductPolygons',
      'strokeMaskPolygons: descriptorProductPolygons',
      'strokePathStyle.join'
    ]) {
      expect(helperSource).not.toContain(forbiddenToken)
    }
  })

  it('preserves source-vertex join owner metadata when render entries merge overlap groups', () => {
    const source = readFileSync(solidCenterSourcePath, 'utf8')

    expect(source).toContain('const selectPrimaryRenderMetadataFace = (')
    expect(source).toContain(
      "face.debugMeta?.visibleContributor === 'source-vertex-join'"
    )
    expect(source).toContain('selectPrimaryRenderMetadataFace(faces)')
  })
  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('render-entries')
  })

})
