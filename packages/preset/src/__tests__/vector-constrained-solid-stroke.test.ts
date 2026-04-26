import { beforeAll, describe, expect, it } from 'vitest'
import { BehaviorSubject, Subscription } from 'rxjs'
import { Container, Mesh } from 'pixi.js'
import core, {
  VECTOR_TOKENS,
  renderStrategyRegistry,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  createDefaultStroke
} from '@asyra/utils'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'

beforeAll(() => {
  core.defineSystemProperty<string | null>('pathEditingVectorId', null)
  core.defineSystemProperty<boolean>('pathEditingMode', false)
  core.defineSystemProperty<boolean>('mouseDragging', false)

  const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()
  const presetDeps = {
    sceneTree: {
      getElementById: () => undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  } as unknown as PresetDependencies

  applyPreset(
    {
      registerEvent: (event: string | { eventName: string }) => ({
        eventName: typeof event === 'string' ? event : event.eventName,
        publish: () => undefined,
        subscribe: () => new Subscription()
      }),
      registerDataChannelObserver: () => undefined,
      getPresetDependencies: () => presetDeps,
      registerRenderLayer: () => undefined,
      registerPropertySchema: () => undefined,
      defineSelection: () => undefined,
      getSelection: () => undefined,
      defineUIProperty: () => undefined,
      defineSystemProperty: <T>(key: string, defaultValue: T) => {
        const existing = systemPropertyMap.get(key)
        if (existing) {
          return existing as BehaviorSubject<T>
        }

        const state = new BehaviorSubject<T>(defaultValue)
        systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
        return state
      },
      getSystemPropertyObservable: <T>(key: string) =>
        systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
      createRenderGradientFillStyle: () => null as never
    },
    presetDeps
  )
})

class RecordingVectorGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    geometryId: string
    polygons: { x: number; y: number }[][]
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  }[]
  __asyraConstrainedSolidOwnershipDiagnostics?: {
    candidates: {
      candidateId: string
      strokeId: string
      polygons: { x: number; y: number }[][]
    }[]
    edges: [string, string][]
    components: {
      componentId: string
      candidateIds: string[]
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
      polygons: { x: number; y: number }[][]
    }[]
    ownedRegions: {
      regionId: string
      candidateIds: string[]
      ownerStrokeId: string
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
      polygon: { x: number; y: number }[]
    }[]
  }
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  moveTo() {
    return this
  }

  lineTo() {
    return this
  }

  bezierCurveTo() {
    return this
  }

  closePath() {
    return this
  }

  cut() {
    return this
  }

  fill() {
    return this
  }
}

class RecordingShapeGraphic extends Container {
  __asyraSolidCenterStrokeExportPackets?: {
    geometryId: string
    polygons: { x: number; y: number }[][]
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  }[]
  hitArea?: { contains: (x: number, y: number) => boolean } | null

  clear() {
    return this
  }

  rect() {
    return this
  }

  ellipse() {
    return this
  }

  fill() {
    return this
  }
}

interface TestAnchorPoint {
  id: string
  x: number
  y: number
}

const toVectorData = (anchors: TestAnchorPoint[], closed: boolean) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {
    'network-0': {
      id: 'network-0',
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }
  }

  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      anchorType: 'sharp',
      x: anchor.x,
      y: anchor.y
    }

    if (index === 0) {
      return
    }

    const previous = anchors[index - 1]
    const segmentId = `segment-${index - 1}`
    segments[segmentId] = {
      id: segmentId,
      startId: previous.id,
      endId: anchor.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  })

  if (closed && anchors.length > 1) {
    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    const segmentId = 'segment-close'
    segments[segmentId] = {
      id: segmentId,
      startId: last.id,
      endId: first.id,
      outControlId: null,
      inControlId: null
    }
    networks['network-0'].segmentIds.push(segmentId)
  }

  return {
    points,
    segments,
    networks
  }
}

const toMultiNetworkVectorData = (
  networksInput: { networkId: string; anchors: TestAnchorPoint[]; closed: boolean }[]
) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {}

  networksInput.forEach(({ networkId, anchors, closed }) => {
    networks[networkId] = {
      id: networkId,
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }

    anchors.forEach((anchor, index) => {
      points[anchor.id] = {
        id: anchor.id,
        kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
        anchorType: 'sharp',
        x: anchor.x,
        y: anchor.y
      }

      if (index === 0) {
        return
      }

      const previous = anchors[index - 1]
      const segmentId = `${networkId}-segment-${index - 1}`
      segments[segmentId] = {
        id: segmentId,
        startId: previous.id,
        endId: anchor.id,
        outControlId: null,
        inControlId: null
      }
      networks[networkId].segmentIds.push(segmentId)
    })

    if (closed && anchors.length > 1) {
      const first = anchors[0]
      const last = anchors[anchors.length - 1]
      const segmentId = `${networkId}-segment-close`
      segments[segmentId] = {
        id: segmentId,
        startId: last.id,
        endId: first.id,
        outControlId: null,
        inControlId: null
      }
      networks[networkId].segmentIds.push(segmentId)
    }
  })

  return {
    points,
    segments,
    networks
  }
}

const runVectorRenderStrategy = (data: Record<string, unknown>) => {
  const strategy = renderStrategyRegistry.get('vector')
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingVectorGraphic()
  ;(
    strategy as unknown as (
      graphic: RecordingVectorGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, data)

  return graphic
}

const runShapeRenderStrategy = (
  type: 'rect' | 'oval',
  data: Record<string, unknown>
) => {
  const strategy = renderStrategyRegistry.get(type)
  expect(strategy).toBeTypeOf('function')

  const graphic = new RecordingShapeGraphic()
  ;(
    strategy as unknown as (
      graphic: RecordingShapeGraphic,
      data: Record<string, unknown>
    ) => void
  )(graphic, data)

  return graphic
}

const roundBounds = (bounds: {
  minX: number
  minY: number
  maxX: number
  maxY: number
}) => ({
  minX: Number(bounds.minX.toFixed(6)),
  minY: Number(bounds.minY.toFixed(6)),
  maxX: Number(bounds.maxX.toFixed(6)),
  maxY: Number(bounds.maxY.toFixed(6))
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

describe('vector constrained solid stroke product wiring', () => {
  it('should run: render closed inside vectors through the constrained solid path on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-inside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 0 },
          { id: 'c', x: 40, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
    expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 40,
      maxY: 40
    })
    expect(graphic.hitArea?.contains(1, 1)).toBe(true)
    expect(graphic.hitArea?.contains(-1, -1)).toBe(false)
  })

  ;[
    { label: 'inside', position: StrokePositions.INSIDE },
    { label: 'outside', position: StrokePositions.OUTSIDE }
  ].forEach(({ label, position }) => {
    it(`should run: render open-path solid ${label} vectors as centered fallback on the main render path`, () => {
      const graphic = runVectorRenderStrategy({
        id: `vector-open-${label}`,
        x: 0,
        y: 0,
        width: 40,
        height: 20,
        ...toVectorData(
          [
            { id: 'a', x: 0, y: 10 },
            { id: 'b', x: 40, y: 10 }
          ],
          false
        ),
        closed: false,
        fills: [],
        strokes: [
          createDefaultStroke({
            width: 4,
            style: StrokeStyles.SOLID,
            position
          })
        ]
      })

      expect(getProjectionMeshes(graphic)).toHaveLength(1)
      expect(graphic.__asyraSolidCenterStrokeExportPackets).toHaveLength(1)
      expect(graphic.__asyraSolidCenterStrokeExportPackets?.[0].bounds).toEqual({
        minX: 0,
        minY: 8,
        maxX: 40,
        maxY: 12
      })
      expect(graphic.hitArea?.contains(20, 10)).toBe(true)
      expect(graphic.hitArea?.contains(20, 16)).toBe(false)
    })
  })

  it('should not run: reject self-intersecting constrained vectors deterministically on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-self-intersecting-inside',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 40, y: 40 },
          { id: 'c', x: 0, y: 40 },
          { id: 'd', x: 40, y: 0 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.INSIDE
        })
      ]
    })

    expect(getProjectionMeshes(graphic)).toHaveLength(0)
    expect(graphic.__asyraSolidCenterStrokeExportPackets).toEqual([])
    expect(graphic.hitArea).toBeNull()
  })

  it('should run: merge multi-network constrained ownership diagnostics with unique ids on the main render path', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-multi-network-ownership',
      x: 0,
      y: 0,
      width: 180,
      height: 80,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 60, y: 0 },
            { id: 'a2', x: 60, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 90, y: 0 },
            { id: 'b1', x: 150, y: 0 },
            { id: 'b2', x: 150, y: 40 },
            { id: 'b3', x: 90, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff0000'
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0000ff'
        })
      ]
    })

    const diagnostics = graphic.__asyraConstrainedSolidOwnershipDiagnostics
    expect(diagnostics).toBeDefined()

    const candidateIds = diagnostics?.candidates.map(({ candidateId }) => candidateId) ?? []
    expect(new Set(candidateIds).size).toBe(candidateIds.length)

    const componentIds =
      diagnostics?.components.map(({ componentId }) => componentId) ?? []
    expect(new Set(componentIds).size).toBe(componentIds.length)

    const regionIds = diagnostics?.ownedRegions.map(({ regionId }) => regionId) ?? []
    expect(new Set(regionIds).size).toBe(regionIds.length)

    diagnostics?.components.forEach((component) => {
      component.candidateIds.forEach((candidateId) => {
        expect(candidateIds).toContain(candidateId)
      })
    })

    diagnostics?.ownedRegions.forEach((region) => {
      region.candidateIds.forEach((candidateId) => {
        expect(candidateIds).toContain(candidateId)
      })
    })
  })

  it('should run: route multi-network constrained vector render packets through ownership-clipped legality results instead of raw constrained packets', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-multi-network-clipped-constrained',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 16,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff0000'
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0000ff'
        }),
        createDefaultStroke({
          width: 8,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ff00'
        }),
        createDefaultStroke({
          width: 6,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#ff00ff'
        }),
        createDefaultStroke({
          width: 4,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#00ffff'
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const fifthStrokePackets = exportPackets.filter((packet) =>
      packet.geometryId.includes(':constrained:4')
    )

    expect(fifthStrokePackets).toHaveLength(2)
    expect(fifthStrokePackets.every((packet) => packet.polygons.length === 0)).toBe(
      true
    )
  })

  it('should run: shape-generated and vector-generated closed rectangles keep equivalent local miter remainders when a bevel owner clips the broader subtraction path', () => {
    const strokes = [
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#da0000',
        joinType: StrokeJoinTypes.BEVEL
      }),
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#0044ff',
        joinType: StrokeJoinTypes.MITER
      })
    ]

    const rectGraphic = runShapeRenderStrategy('rect', {
      id: 'rect-broader-local-remainder',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fills: [],
      strokes
    })

    const vectorGraphic = runVectorRenderStrategy({
      id: 'vector-broader-local-remainder',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...toVectorData(
        [
          { id: 'a', x: 0, y: 0 },
          { id: 'b', x: 80, y: 0 },
          { id: 'c', x: 80, y: 40 },
          { id: 'd', x: 0, y: 40 }
        ],
        true
      ),
      closed: true,
      fills: [],
      strokes
    })

    const serializePackets = (
      packets:
        | {
            geometryId: string
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      (packets ?? []).map((packet) => ({
        geometryId: packet.geometryId.split(':').slice(-2).join(':'),
        polygonCount: packet.polygons.length,
        bounds: packet.bounds
      }))

    expect(serializePackets(rectGraphic.__asyraSolidCenterStrokeExportPackets)).toEqual(
      serializePackets(vectorGraphic.__asyraSolidCenterStrokeExportPackets)
    )
  })

  it('should run: keep local miter remainders on the broader subtraction path when a mixed-topology vector includes a non-orthogonal non-convex piece', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-broader-mixed-ear-remainder',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#da0000',
          joinType: StrokeJoinTypes.BEVEL
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0044ff',
          joinType: StrokeJoinTypes.MITER
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const secondaryPackets = exportPackets.filter((packet) =>
      packet.geometryId.includes(':constrained:1')
    )

    expect(secondaryPackets).toHaveLength(2)
    expect(secondaryPackets.every((packet) => packet.polygons.length > 0)).toBe(true)
    expect(secondaryPackets.some((packet) => packet.polygons.length > 4)).toBe(true)
    expect(secondaryPackets[0]?.bounds.minX).toBe(-12)
    expect(secondaryPackets[0]?.bounds.minY).toBe(-12)
    expect(secondaryPackets[0]?.bounds.maxX).toBe(92)
    expect(secondaryPackets[0]?.bounds.maxY).toBeCloseTo(59.41640786499874)
    expect(secondaryPackets[1]?.bounds).toEqual({
      minX: 108,
      minY: -12,
      maxX: 212,
      maxY: 52
    })
  })

  it('should run: keep deterministic broader owner-domain packets for equivalent mixed-topology vectors when one disconnected sub-packet is a non-orthogonal non-convex piece', () => {
    const strokes = [
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#da0000',
        joinType: StrokeJoinTypes.BEVEL
      }),
      createDefaultStroke({
        width: 12,
        style: StrokeStyles.SOLID,
        position: StrokePositions.OUTSIDE,
        color: '#0044ff',
        joinType: StrokeJoinTypes.MITER
      })
    ]

    const canonicalGraphic = runVectorRenderStrategy({
      id: 'vector-mixed-ear-equivalence-canonical',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes
    })

    const equivalentGraphic = runVectorRenderStrategy({
      id: 'vector-mixed-ear-equivalence-reversed',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 40 },
            { id: 'a1', x: 40, y: 20 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 80, y: 0 },
            { id: 'a4', x: 0, y: 0 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 40 },
            { id: 'b1', x: 200, y: 40 },
            { id: 'b2', x: 200, y: 0 },
            { id: 'b3', x: 120, y: 0 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes
    })

    const serializePackets = (
      packets:
        | {
            polygons: { x: number; y: number }[][]
            bounds: { minX: number; minY: number; maxX: number; maxY: number }
          }[]
        | undefined
    ) =>
      [...(packets ?? [])]
        .map((packet) => ({
          polygonCount: packet.polygons.length,
          bounds: roundBounds(packet.bounds)
        }))
        .sort((left, right) =>
          JSON.stringify(left.bounds).localeCompare(JSON.stringify(right.bounds))
        )

    const serializeOwnedRegions = (
      diagnostics:
        | {
            ownedRegions: { candidateIds: string[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }[]
          }
        | undefined
    ) =>
      [...(diagnostics?.ownedRegions ?? [])]
        .map((region) => ({
          candidateIds: region.candidateIds,
          bounds: roundBounds(region.bounds)
        }))
        .sort((left, right) =>
          JSON.stringify(left.bounds).localeCompare(JSON.stringify(right.bounds))
        )

    expect(
      serializePackets(canonicalGraphic.__asyraSolidCenterStrokeExportPackets)
    ).toEqual(serializePackets(equivalentGraphic.__asyraSolidCenterStrokeExportPackets))
    expect(
      serializeOwnedRegions(canonicalGraphic.__asyraConstrainedSolidOwnershipDiagnostics)
    ).toEqual(
      serializeOwnedRegions(equivalentGraphic.__asyraConstrainedSolidOwnershipDiagnostics)
    )
  })

  it('should run: keep local miter remainders on the broader subtraction path when a mixed-topology vector includes multiple non-orthogonal non-convex pieces', () => {
    const graphic = runVectorRenderStrategy({
      id: 'vector-broader-mixed-multi-ear-remainder',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      ...toMultiNetworkVectorData([
        {
          networkId: 'network-a',
          closed: true,
          anchors: [
            { id: 'a0', x: 0, y: 0 },
            { id: 'a1', x: 80, y: 0 },
            { id: 'a2', x: 80, y: 40 },
            { id: 'a3', x: 40, y: 20 },
            { id: 'a4', x: 0, y: 40 }
          ]
        },
        {
          networkId: 'network-b',
          closed: true,
          anchors: [
            { id: 'b0', x: 120, y: 0 },
            { id: 'b1', x: 200, y: 0 },
            { id: 'b2', x: 200, y: 40 },
            { id: 'b3', x: 160, y: 20 },
            { id: 'b4', x: 120, y: 40 }
          ]
        }
      ]),
      closed: true,
      fills: [],
      strokes: [
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#da0000',
          joinType: StrokeJoinTypes.BEVEL
        }),
        createDefaultStroke({
          width: 12,
          style: StrokeStyles.SOLID,
          position: StrokePositions.OUTSIDE,
          color: '#0044ff',
          joinType: StrokeJoinTypes.MITER
        })
      ]
    })

    const exportPackets = graphic.__asyraSolidCenterStrokeExportPackets ?? []
    const secondaryPackets = exportPackets.filter((packet) =>
      packet.geometryId.includes(':constrained:1')
    )

    expect(secondaryPackets).toHaveLength(2)
    expect(secondaryPackets.every((packet) => packet.polygons.length > 0)).toBe(true)
    expect(secondaryPackets.every((packet) => packet.polygons.length > 4)).toBe(true)
    expect(secondaryPackets.every((packet) => packet.bounds.maxY > 52)).toBe(true)
    expect(secondaryPackets.every((packet) => packet.bounds.minY === -12)).toBe(true)
  })
})
