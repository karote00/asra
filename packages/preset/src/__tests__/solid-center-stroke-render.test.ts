import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Mesh } from 'pixi.js'
import Clipper2ZFactory from 'clipper2-wasm'
import { renderSolidCenterStrokeEntries } from '../components/stroke-render/solid-center-stroke-render'
import { buildStrokeRuntimeRevisionSet } from '../components/stroke-render/stroke-dirty-keys'
import {
  buildSolidCenterStrokeExportPacketsFromFinalFaces,
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  type SolidCenterStrokeGeometryDebugMeta,
  type SolidCenterStrokePaintPacket
} from '../components/stroke-render/solid-center-stroke-packets'
import type { StrokeFinalFace } from '../components/stroke-render/stroke-final-face'
import {
  registerGeometryBackend,
  selectGeometryBackend,
  type GeometryBackend
} from '../components/stroke-render/geometry-backend'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'

class MeshTestHost extends Container {}

const require = createRequire(import.meta.url)
const clipperWasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

let exactBackend: GeometryBackend | null = null

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(clipperWasmPath)
  })) as Clipper2Module

beforeAll(async () => {
  const backendId = 'clipper2-solid-center-render-test'
  exactBackend = createClipper2GeometryBackend(await loadClipperModule(), {
    backendId,
    backendVersion: `${backendId}@test`
  })
  registerGeometryBackend({
    backendId,
    load: () => exactBackend as GeometryBackend
  })
  selectGeometryBackend(backendId)
})

const getProjectionMeshes = (host: Container) =>
  host.children.flatMap((child) => {
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Mesh => grandchild instanceof Mesh
    )
  })

const getProjectionGraphics = (host: Container) =>
  host.children.flatMap((child) => {
    if (child instanceof Graphics) {
      return [child]
    }

    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Graphics => grandchild instanceof Graphics
    )
  })

const buildOutsideConstrainedDashedFace = (
  faceId: string,
  intervalId: string,
  polygons: { x: number; y: number }[][]
): StrokeFinalFace<
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokePaintPacket
> => ({
  faceId,
  sourceGeometryIds: [faceId],
  polygons,
  bounds: {
    minX: Math.min(...polygons.flat().map((point) => point.x)),
    minY: Math.min(...polygons.flat().map((point) => point.y)),
    maxX: Math.max(...polygons.flat().map((point) => point.x)),
    maxY: Math.max(...polygons.flat().map((point) => point.y))
  },
  visualPacketKey: 'outside-constrained-dashed',
  paintKey: 'solid:red:1',
  strokeSpecKey: 'outside-dashed-round',
  ownerSet: [
    {
      ownerKey: 'owner:outside',
      sourcePathId: 'source:outside',
      networkId: 'network:outside',
      strokeId: 'stroke:outside',
      strokeIndex: 0,
      intervalId
    }
  ],
  intervalIds: [intervalId],
  sourceSpanIds: [`source-span:${intervalId}`],
  sourceContourIds: ['source-contour:outside'],
  legalDomainIds: ['legal-domain:outside'],
  geometryFamily: 'constrained-dashed',
  debugMeta: {
    geometryFamily: 'constrained-dashed',
    finalCoverageBuilderStatus: 'product-final',
    sourcePathId: 'source:outside',
    ownerKey: 'owner:outside',
    networkId: 'network:outside',
    strokeId: 'stroke:outside',
    strokeIndex: 0,
    intervalId,
    strokePosition: 'outside',
    figmaLikeBoundaryDomainId: 'boundary:outside',
    figmaLikeBoundaryPoints: [
      { x: -2, y: 0 },
      { x: 20, y: 0 }
    ],
    figmaLikeSelectedSide: -1,
    figmaLikeSplitRangeTerminals: [
      {
        intervalId,
        boundaryDomainId: 'boundary:outside',
        boundaryPoints: [
          { x: -2, y: 0 },
          { x: 20, y: 0 }
        ],
        splitRangeId: 'split:outside',
        splitRangeStartDistance: 0,
        splitRangeEndDistance: 20,
        terminalRole: 'middle',
        startDistance: 0,
        endDistance: 10,
        selectedSide: -1
      }
    ]
  },
  paint: {
    geometryId: faceId,
    kind: 'solid',
    color: 0xdf0606,
    alpha: 1,
    paintKey: 'solid:red:1'
  }
})

describe('solid center stroke render', () => {
  it('should run: render canonical solid-center polygons into a mesh projection', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_0',
        stroke: {
          color: 0x3366ff,
          alpha: 0.75
        },
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 0, y: 4 }
          ]
        ]
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(1)
  })

  it('should run: render self-intersecting exact-union center strokes through a masked solid fill', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_self_intersecting',
        stroke: {
          color: 0x3366ff,
          alpha: 0.75
        },
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 0, y: 4 }
          ]
        ],
        debugMeta: {
          geometryFamily: 'solid-center',
          sourceTopology: 'self-intersecting',
          visualOverlapCollapseStatus: 'exact-union'
        }
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(0)
    expect(getProjectionGraphics(host)).toHaveLength(2)
    const cacheEntry = (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { kind?: string }>
      }
    ).__asyraStrokeMeshCache?.get('solid_center_self_intersecting')
    expect(cacheEntry?.kind).toBe('masked-solid')
  })

  it('should run: render constrained dashed product visuals as dashed fill clipped by legal mask', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'constrained_dashed_product_final',
        stroke: {
          color: 0xdf0606,
          alpha: 0.5
        },
        polygons: [
          [
            { x: 2, y: 2 },
            { x: 8, y: 2 },
            { x: 8, y: 8 },
            { x: 2, y: 8 }
          ]
        ],
        fillPolygons: [
          [
            { x: -4, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 10 },
            { x: -4, y: 10 }
          ]
        ],
        clipPolygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        ],
        debugMeta: {
          geometryFamily: 'constrained-dashed',
          finalCoverageBuilderStatus: 'product-final'
        }
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(0)
    expect(getProjectionGraphics(host)).toHaveLength(2)
    const cacheEntry = (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { kind?: string }>
      }
    ).__asyraStrokeMeshCache?.get('constrained_dashed_product_final')
    expect(cacheEntry?.kind).toBe('masked-solid')
  })

  it('should run: render constrained dashed product-final polygon coverage directly as mesh projection', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'constrained_dashed_product_final_polygons_only',
        stroke: {
          color: 0xdf0606,
          alpha: 0.5
        },
        polygons: [
          [
            { x: 2, y: 2 },
            { x: 8, y: 2 },
            { x: 8, y: 8 },
            { x: 2, y: 8 }
          ],
          [
            { x: 20, y: 2 },
            { x: 26, y: 2 },
            { x: 26, y: 8 },
            { x: 20, y: 8 }
          ]
        ],
        debugMeta: {
          geometryFamily: 'constrained-dashed',
          finalCoverageBuilderStatus: 'product-final',
          sourceContourIds: ['source-a', 'source-b']
        }
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(1)
    expect(getProjectionGraphics(host)).toHaveLength(0)
    const cacheEntry = (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { kind?: string }>
      }
    ).__asyraStrokeMeshCache?.get(
      'constrained_dashed_product_final_polygons_only'
    )
    expect(cacheEntry?.kind).toBe('solid')
  })

  it('should run: render self-intersecting constrained dashed source-path polygons through the product mesh cache', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'self_intersecting_constrained_dashed_source_path',
        stroke: {
          color: 0xdf0606,
          alpha: 0.5
        },
        polygons: [
          [
            { x: 2, y: 2 },
            { x: 8, y: 2 },
            { x: 8, y: 8 },
            { x: 2, y: 8 }
          ],
          [
            { x: 20, y: 2 },
            { x: 26, y: 2 },
            { x: 26, y: 8 },
            { x: 20, y: 8 }
          ]
        ],
        debugMeta: {
          geometryFamily: 'constrained-dashed',
          sourceTopology: 'self-intersecting',
          finalCoverageBuilderStatus: 'product-final',
          sourceContourIds: ['source-a', 'source-b']
        }
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(1)
    expect(getProjectionGraphics(host)).toHaveLength(0)
    const cacheEntry = (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { kind?: string }>
      }
    ).__asyraStrokeMeshCache?.get(
      'self_intersecting_constrained_dashed_source_path'
    )
    expect(cacheEntry?.kind).toBe('solid')
  })

  it('should run: keep outside constrained dashed projection seam bridges on the selected side before render/export', () => {
    expect(exactBackend).not.toBeNull()
    const faces = [
      buildOutsideConstrainedDashedFace('outside-a', 'interval:a', [
        [
          { x: 0, y: -5 },
          { x: 7.9, y: -5 },
          { x: 7.9, y: -0.2 },
          { x: 0, y: -0.2 }
        ]
      ]),
      buildOutsideConstrainedDashedFace('outside-b', 'interval:b', [
        [
          { x: 8.1, y: -5 },
          { x: 16, y: -5 },
          { x: 16, y: -0.2 },
          { x: 8.1, y: -0.2 }
        ]
      ])
    ]

    const renderEntries = toSolidCenterStrokeRenderEntriesFromFinalFaces(
      faces,
      {
        exactBackend: exactBackend ?? undefined
      }
    )
    const exportPackets =
      buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)
    const projectedRenderPolygons = renderEntries.flatMap(
      (entry) => entry.polygons
    )
    const projectedExportPolygons = exportPackets.flatMap(
      (packet) => packet.polygons
    )

    expect(renderEntries).toHaveLength(1)
    expect(exportPackets).toHaveLength(1)
    expect(projectedRenderPolygons.length).toBeGreaterThanOrEqual(2)
    expect(projectedExportPolygons.length).toBeGreaterThanOrEqual(2)
    for (const point of [
      ...projectedRenderPolygons.flat(),
      ...projectedExportPolygons.flat()
    ]) {
      expect(point.y).toBeLessThanOrEqual(1e-4)
    }
  })

  it('should run: paint constrained dashed fill polygons and native stroke paths together under the legal mask', () => {
    const host = new MeshTestHost()
    const polySpy = vi.spyOn(Graphics.prototype, 'poly')
    const strokeSpy = vi.spyOn(Graphics.prototype, 'stroke')

    try {
      renderSolidCenterStrokeEntries(host, [
        {
          cacheKey: 'constrained_dashed_product_final_mixed',
          stroke: {
            color: 0xdf0606,
            alpha: 0.5
          },
          polygons: [
            [
              { x: 2, y: 2 },
              { x: 8, y: 2 },
              { x: 8, y: 8 },
              { x: 2, y: 8 }
            ]
          ],
          fillPolygons: [
            [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 8, y: 4 },
              { x: 0, y: 4 }
            ]
          ],
          clipPolygons: [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 }
            ]
          ],
          strokePaths: [
            [
              { x: 1, y: 7 },
              { x: 9, y: 7 }
            ]
          ],
          strokePathStyle: {
            width: 2,
            cap: 'round',
            join: 'round',
            miterLimit: 4
          },
          debugMeta: {
            geometryFamily: 'constrained-dashed',
            finalCoverageBuilderStatus: 'product-final'
          }
        }
      ])

      expect(getProjectionMeshes(host)).toHaveLength(0)
      expect(getProjectionGraphics(host)).toHaveLength(2)
      expect(polySpy).toHaveBeenCalled()
      expect(strokeSpy).toHaveBeenCalled()
    } finally {
      polySpy.mockRestore()
      strokeSpy.mockRestore()
    }
  })

  it('should not run: emit mesh projections for non-polygon solid-center fragments', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_0',
        stroke: {
          color: 0x3366ff,
          alpha: 0.75
        },
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
          ]
        ]
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(0)
  })

  it('should run: reuse the same mesh projection when only paint changes', () => {
    const host = new MeshTestHost()
    const entry = {
      cacheKey: 'solid_center_0',
      stroke: {
        color: 0x3366ff,
        alpha: 0.75
      },
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 4 },
          { x: 0, y: 4 }
        ]
      ]
    }

    renderSolidCenterStrokeEntries(host, [entry])
    const mesh = getProjectionMeshes(host)[0]

    renderSolidCenterStrokeEntries(host, [
      {
        ...entry,
        stroke: {
          color: 0xff0000,
          alpha: 1
        }
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(1)
    expect(getProjectionMeshes(host)[0]).toBe(mesh)
  })

  it('should run: record runtime dirty keys from packet revisions', () => {
    const host = new MeshTestHost()
    const baseRevisionSet = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 0, y: 4 }
      ],
      closed: true,
      stroke: {
        style: 'solid',
        position: 'center',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt',
        color: 0x3366ff,
        alpha: 0.75
      },
      geometryFamily: 'solid-center',
      resolutionStatus: 'native-center',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      ownerKey: 'rect:a:stroke:0',
      strokeId: 'stroke:0'
    })
    const paintRevisionSet = buildStrokeRuntimeRevisionSet({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 0, y: 4 }
      ],
      closed: true,
      stroke: {
        style: 'solid',
        position: 'center',
        width: 4,
        join: 'miter',
        miterLimit: 4,
        cap: 'butt',
        color: 0xff0000,
        alpha: 1
      },
      geometryFamily: 'solid-center',
      resolutionStatus: 'native-center',
      runtimeStatus: 'not-applicable',
      runtimeReason: 'center-stroke',
      ownerKey: 'rect:a:stroke:0',
      strokeId: 'stroke:0'
    })
    const polygons = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 0, y: 4 }
      ]
    ]

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_0',
        stroke: {
          color: 0x3366ff,
          alpha: 0.75
        },
        polygons,
        revisionSet: baseRevisionSet
      }
    ])
    const mesh = getProjectionMeshes(host)[0]

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_0',
        stroke: {
          color: 0xff0000,
          alpha: 1
        },
        polygons,
        revisionSet: paintRevisionSet
      }
    ])

    const cacheEntry = (
      host as typeof host & {
        __asyraStrokeMeshCache?: Map<string, { lastDirtyKeys?: string[] }>
      }
    ).__asyraStrokeMeshCache?.get('solid_center_0')

    expect(getProjectionMeshes(host)[0]).toBe(mesh)
    expect(cacheEntry?.lastDirtyKeys).toEqual([
      'paint-payload',
      'render-hit-export'
    ])
  })

  it('should run: reuse the same graphics projection when only gradient paint changes', () => {
    const host = new MeshTestHost()
    const entry = {
      cacheKey: 'solid_center_gradient_0',
      stroke: {
        kind: 'gradient' as const,
        color: 0x000000,
        alpha: 1,
        gradientStyle: {
          fill: {
            mocked: true,
            options: {
              type: 'linear',
              start: { x: 0, y: 0.5 },
              end: { x: 1, y: 0.5 }
            }
          }
        },
        paintKey: 'gradient:red-blue'
      },
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 4 },
          { x: 0, y: 4 }
        ]
      ]
    }

    renderSolidCenterStrokeEntries(host, [entry])
    const graphics = getProjectionGraphics(host)[0]

    renderSolidCenterStrokeEntries(host, [
      {
        ...entry,
        stroke: {
          ...entry.stroke,
          gradientStyle: {
            fill: {
              mocked: true,
              options: {
                type: 'linear',
                start: { x: 0, y: 0.5 },
                end: { x: 1, y: 0.5 }
              }
            }
          },
          paintKey: 'gradient:blue-red'
        }
      }
    ])

    expect(getProjectionGraphics(host)).toHaveLength(1)
    expect(getProjectionGraphics(host)[0]).toBe(graphics)
  })

  it('should run: render multiple closed solid-center polygons without dropping corner coverage', () => {
    const host = new MeshTestHost()

    renderSolidCenterStrokeEntries(host, [
      {
        cacheKey: 'solid_center_ring',
        stroke: {
          color: 0x3366ff,
          alpha: 1
        },
        polygons: [
          [
            { x: -2, y: -2 },
            { x: 22, y: -2 },
            { x: 20, y: 2 },
            { x: 0, y: 2 }
          ],
          [
            { x: 18, y: 0 },
            { x: 22, y: -2 },
            { x: 22, y: 22 },
            { x: 18, y: 20 }
          ],
          [
            { x: 0, y: 18 },
            { x: 20, y: 18 },
            { x: 22, y: 22 },
            { x: -2, y: 22 }
          ],
          [
            { x: -2, y: -2 },
            { x: 2, y: 0 },
            { x: 2, y: 20 },
            { x: -2, y: 22 }
          ]
        ]
      }
    ])

    expect(getProjectionMeshes(host)).toHaveLength(1)
  })
})
