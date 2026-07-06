import {
  FillKinds,
  StrokeCapTypes,
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultFill,
  createDefaultGradientData,
  createDefaultStroke
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { normalizeStrokeSpec } from '../../components/stroke-render/renderable-stroke'
import {
  buildStrokeRuntimeRevisionSet,
  computeStrokeDirtyKeys,
  type StrokeRevisionSet
} from '../../components/stroke-render/stroke-dirty-keys'
import {
  buildSolidCenterStrokeRenderEntriesFromRenderPackets,
  emitSolidCenterStrokeProductOutputPacketsFromFinalFaces
} from '../../components/stroke-render/solid-center-stroke-packets'
import { projectSolidCenterStrokeRenderEntries } from '../../components/stroke-render/solid-center-stroke-render'
import { buildStrokeFinalFacesFromResolvedPackets } from '../../components/stroke-render/stroke-final-face'
import { selectStrokeProductFamily } from '../../components/stroke-render/stroke-product-family'
import type { Vec2 } from '../../components/stroke-render/solid-stroke-geometry-core'

const points: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 }
]

const polygon: Vec2[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 10 },
  { x: 0, y: 10 }
]

const evidencePolygon: Vec2[] = [
  { x: 100, y: 100 },
  { x: 110, y: 100 },
  { x: 110, y: 110 }
]

const bounds = {
  minX: 0,
  minY: 0,
  maxX: 40,
  maxY: 10
}

const baseStroke = {
  visible: true,
  style: 'solid',
  position: 'outside',
  width: 12,
  join: 'miter',
  miterLimit: 4,
  cap: 'butt',
  dash: 0,
  gap: 0,
  kind: 'solid',
  color: 0x777777,
  alpha: 1,
  paintKey: 'solid:gray'
}

const buildRevisionSet = (
  strokeOverrides: Partial<typeof baseStroke> = {},
  inputOverrides: Partial<Parameters<typeof buildStrokeRuntimeRevisionSet>[0]> = {}
): StrokeRevisionSet =>
  buildStrokeRuntimeRevisionSet({
    points,
    closed: true,
    stroke: {
      ...baseStroke,
      ...strokeOverrides
    },
    productMode: 'constrained-solid',
    domainMode: 'closed-constrained-domain',
    ownerKey: 'vector:parameter-boundary',
    networkId: 'network:parameter-boundary',
    strokeId: 'stroke:parameter-boundary',
    ownerCount: 1,
    ...inputOverrides
  })

const expectDirtyFor = (
  previous: StrokeRevisionSet,
  next: StrokeRevisionSet,
  expectedDirtyKeys: string[],
  forbiddenDirtyKeys: string[]
) => {
  const result = computeStrokeDirtyKeys(previous, next)

  expect(result.dirtyKeys).toEqual(expect.arrayContaining(expectedDirtyKeys))
  for (const forbiddenDirtyKey of forbiddenDirtyKeys) {
    expect(result.dirtyKeys).not.toContain(forbiddenDirtyKey)
  }
  return result
}

describe('new stroke flow integration: full parameter pipeline boundaries', () => {
  it('routes style, position, and dash presence through product family selection only', () => {
    const sourceFamily = {
      familyScope: 'self-intersecting-closed' as const
    }
    const constrainedDomain = {
      planId: 'domain:parameters',
      sourceId: 'source:parameters',
      networkId: 'network:parameters',
      domainMode: 'closed-constrained-domain' as const,
      intervalDomainKind: 'domain-plan-split-range' as const
    }

    const cases = [
      {
        stroke: { style: 'solid' as const, position: 'center' as const },
        domainPlan: {
          ...constrainedDomain,
          domainMode: 'center-product' as const,
          intervalDomainKind: 'topology-arc-length' as const
        },
        expectedFamily: 'center',
        expectedSelectedRoutes: ['build-center-stroke-products'],
        expectedCoExecutionRoutes: []
      },
      {
        stroke: { style: 'solid' as const, position: 'inside' as const },
        domainPlan: constrainedDomain,
        expectedFamily: 'constrained-solid',
        expectedSelectedRoutes: ['build-constrained-solid-products'],
        expectedCoExecutionRoutes: []
      },
      {
        stroke: { style: 'solid' as const, position: 'outside' as const },
        domainPlan: constrainedDomain,
        expectedFamily: 'constrained-solid',
        expectedSelectedRoutes: ['build-constrained-solid-products'],
        expectedCoExecutionRoutes: []
      },
      {
        stroke: { style: 'dashed' as const, position: 'inside' as const },
        domainPlan: constrainedDomain,
        expectedFamily: 'constrained-dashed',
        expectedSelectedRoutes: [],
        expectedCoExecutionRoutes: [
          'build-dash-interval-body-products',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products'
        ]
      },
      {
        stroke: { style: 'dashed' as const, position: 'outside' as const },
        domainPlan: constrainedDomain,
        expectedFamily: 'constrained-dashed',
        expectedSelectedRoutes: [],
        expectedCoExecutionRoutes: [
          'build-dash-interval-body-products',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products'
        ]
      }
    ]

    for (const testCase of cases) {
      const selection = selectStrokeProductFamily({
        stroke: testCase.stroke,
        sourceFamily,
        domainPlan: testCase.domainPlan,
        dashSignature:
          testCase.stroke.style === 'dashed' ? 'dash:20-10:0' : 'dash:none'
      })

      expect(selection).toMatchObject({
        productFamilyId: testCase.expectedFamily,
        selectedRouteIds: testCase.expectedSelectedRoutes,
        coExecutionRouteIds: testCase.expectedCoExecutionRoutes,
        diagnostics: []
      })
      expect(JSON.stringify(selection)).not.toContain('polygon')
      expect(JSON.stringify(selection)).not.toContain('resolvedJoin')
      expect(JSON.stringify(selection)).not.toContain('strokeMaskPolygons')
    }
  })

  it('classifies each stroke parameter change into its intended dirty-stage boundary', () => {
    const base = buildRevisionSet()

    const paintOnly = expectDirtyFor(
      base,
      buildRevisionSet({
        color: 0xff0000,
        paintKey: 'solid:red'
      }),
      ['paint-payload', 'render-hit-export'],
      [
        'path-topology',
        'stroke-product',
        'stroke-domain',
        'interval-allocation',
        'join-ownership'
      ]
    )
    expect(paintOnly.changedRevisionKeys).toEqual(['paintRevision'])

    expectDirtyFor(
      base,
      buildRevisionSet({
        dash: 20,
          gap: 10
      }),
      [
        'interval-allocation',
        'dash-product-intervals',
        'endpoint-cap-policy',
        'join-ownership',
        'render-hit-export'
      ],
      ['path-topology', 'paint-payload']
    )

    expectDirtyFor(
      base,
      buildRevisionSet({
        cap: 'round'
      }),
      [
        'endpoint-cap-policy',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ],
      ['path-topology', 'paint-payload', 'interval-allocation']
    )

    expectDirtyFor(
      base,
      buildRevisionSet({
        join: 'round',
        miterLimit: 2
      }),
      [
        'join-ownership',
        'smooth-continuity',
        'product-materialization',
        'legality',
        'resolved-regions',
        'render-hit-export'
      ],
      ['path-topology', 'paint-payload', 'interval-allocation']
    )

    expectDirtyFor(
      base,
      buildRevisionSet({
        width: 24
      }),
      [
        'stroke-domain',
        'interval-allocation',
        'endpoint-cap-policy',
        'join-ownership',
        'render-hit-export'
      ],
      ['path-topology', 'paint-payload']
    )

    expectDirtyFor(
      base,
      buildRevisionSet({
        style: 'dashed',
        position: 'inside',
        dash: 16,
          gap: 8
      }),
      [
        'stroke-product',
        'stroke-domain',
        'interval-allocation',
        'dash-product-intervals',
        'render-hit-export'
      ],
      ['path-topology', 'paint-payload']
    )
  })

  it('keeps normalized parameter values intact through final face render, hit/export, and diagnostics channels', () => {
    const [stroke] = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:channel',
        style: StrokeStyles.DASHED,
        position: StrokePositions.OUTSIDE,
        width: 14,
        dash: 22,
          gap: 11,
        joinType: StrokeJoinTypes.ROUND,
        capType: StrokeCapTypes.SQUARE,
        miterAngle: 42,
        fill: createDefaultFill({
          color: '#778899',
          opacity: 0.6
        })
      })
    ]).strokes

    const [finalFace] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId: 'geometry:channel',
          polygons: [polygon],
          bounds,
          debugMeta: {
            routeId: 'build-final-faces',
            ownerKey: 'owner:channel',
            strokeId: 'stroke:channel',
            productMode: 'post-legality-product',
            productSignature: 'constrained-dashed-post-legality',
            domainMode: 'closed-constrained-domain',
            strokePosition: 'outside',
            strokeWidth: stroke.width,
            strokeJoin: stroke.join,
            strokeCap: stroke.cap,
            miterAngle: stroke.miterAngle,
            legalDomainIds: ['legal:outside']
          },
          renderDescriptor: {
            strokePathGroups: [
              {
                strokePaths: [[{ x: 0, y: 0 }, { x: 40, y: 0 }]],
                strokePathStyle: {
                  width: stroke.width,
                  cap: stroke.cap,
                  join: stroke.join,
                  miterLimit: stroke.miterLimit,
                  closed: false
                }
              }
            ],
            descriptorProductPolygons: [evidencePolygon],
            fillClipPolygons: [polygon],
            fillExcludePolygons: [evidencePolygon]
          }
        },
        paint: {
          geometryId: 'geometry:channel',
          kind: stroke.kind,
          color: stroke.color,
          alpha: stroke.alpha,
          gradientStyle: stroke.gradientStyle,
          paintKey: stroke.paintKey
        }
      }
    ])

    const packets = emitSolidCenterStrokeProductOutputPacketsFromFinalFaces([
      finalFace
    ])
    const renderEntries = buildSolidCenterStrokeRenderEntriesFromRenderPackets(
      packets.renderPackets
    )
    const projections = projectSolidCenterStrokeRenderEntries(renderEntries)

    expect(packets.renderPackets[0]).toMatchObject({
      channel: 'render',
      visibility: 'visible',
      descriptorRouteMode: 'descriptor-visible-route',
      stroke: {
        kind: 'solid',
        color: 0x778899,
        alpha: 0.6,
        paintKey: 'solid:7833753:0.6'
      },
      debugMeta: expect.objectContaining({
        strokeWidth: 14,
        strokeJoin: 'round',
        strokeCap: 'square',
        miterAngle: 42
      })
    })
    expect(packets.hitTestPackets[0]).toMatchObject({
      channel: 'hit-test',
      visibility: 'hit-export',
      equivalenceReason: 'descriptor-evidence-projection'
    })
    expect(packets.exportPackets[0]).toMatchObject({
      channel: 'export',
      visibility: 'hit-export',
      equivalenceReason: 'descriptor-evidence-projection'
    })
    expect(packets.diagnosticPackets[0]).toMatchObject({
      channel: 'diagnostic',
      visibility: 'non-visible',
      diagnosticKind: 'descriptor-evidence',
      evidenceChannel: {
        descriptorProductPolygons: [evidencePolygon],
        fillClipPolygons: [polygon],
        fillExcludePolygons: [evidencePolygon]
      }
    })
    expect(renderEntries[0]).toMatchObject({
      channel: 'render-entry',
      visibility: 'visible',
      strokePathGroups: [
        {
          strokePaths: [[{ x: 0, y: 0 }, { x: 40, y: 0 }]],
          strokePathStyle: {
            width: 14,
            cap: 'square',
            join: 'round',
            miterLimit: stroke.miterLimit,
            closed: false
          }
        }
      ],
      evidenceChannel: {
        descriptorProductPolygonsVisible: false,
        reason: 'descriptor-visible-route'
      }
    })
    expect(renderEntries[0]).not.toHaveProperty('strokeMaskPolygons')
    expect(renderEntries[0]).not.toHaveProperty('descriptorProductPolygons')
    expect(projections[0]).toMatchObject({
      channel: 'renderer-projection',
      visibility: 'visible-pixels',
      drawRouteType: 'stroke-path-groups',
      metadataMutation: false
    })
    expect(projections[0]).not.toHaveProperty('strokeMaskPolygons')
    expect(JSON.stringify(projections[0])).not.toContain(
      'descriptorProductPolygons'
    )
  })

  it('preserves gradient paint as paint data only while geometry parameters remain source-owned', () => {
    const [stroke] = normalizeStrokeSpec([
      createDefaultStroke({
        id: 'stroke:gradient-channel',
        style: StrokeStyles.SOLID,
        position: StrokePositions.CENTER,
        width: 6,
        joinType: StrokeJoinTypes.BEVEL,
        capType: StrokeCapTypes.ROUND,
        fill: createDefaultFill({
          kind: FillKinds.GRADIENT,
          gradient: createDefaultGradientData()
        })
      })
    ]).strokes

    expect(stroke).toMatchObject({
      kind: 'gradient',
      style: 'solid',
      position: 'center',
      width: 6,
      join: 'bevel',
      cap: 'round'
    })
    expect(stroke.gradientStyle).toBeTruthy()
    expect(stroke.paintKey).toContain('"kind":"gradient"')
    expect(stroke).not.toHaveProperty('polygons')
    expect(stroke).not.toHaveProperty('renderDescriptor')
  })
})
