import { describe, expect, it } from 'vitest'
import { Container, Graphics, Mesh } from 'pixi.js'
import { renderSolidCenterStrokeEntries } from '../components/stroke-render/solid-center-stroke-render'
import { buildStrokeRuntimeRevisionSet } from '../components/stroke-render/stroke-dirty-keys'

class MeshTestHost extends Container {}

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
    if (!(child instanceof Container)) {
      return []
    }

    return child.children.filter(
      (grandchild): grandchild is Graphics => grandchild instanceof Graphics
    )
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
