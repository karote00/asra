import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildCenterDashedOverlapDiagnosticsFromResolvedPackets } from '../components/stroke-render/center-dashed-overlap-diagnostics'
import type { SolidCenterStrokeResolvedPacket } from '../components/stroke-render/solid-center-stroke-packets'

const createSyntheticPacket = (
  geometryId: string,
  strokeId: string,
  polygon: { x: number; y: number }[],
  authoredVisibleIntervalIndex = 0
): SolidCenterStrokeResolvedPacket => ({
  geometry: {
    geometryId,
    polygons: [polygon],
    bounds: {
      minX: Math.min(...polygon.map((point) => point.x)),
      minY: Math.min(...polygon.map((point) => point.y)),
      maxX: Math.max(...polygon.map((point) => point.x)),
      maxY: Math.max(...polygon.map((point) => point.y))
    },
    debugMeta: {
      strokeId,
      intervalId: geometryId,
      authoredVisibleIntervalIndex,
      startDistance: 0,
      endDistance: 1,
      wrapsSeam: false,
      previousVisibleIntervalId: null,
      nextVisibleIntervalId: null
    }
  },
  paint: {
    geometryId,
    color: 0xff0000,
    alpha: 1
  }
})

describe('center dashed overlap diagnostics', () => {
  it('should run: real dashed-center packets produce deterministic ownership diagnostics on overlapping intervals', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'center-dashed-overlap-diagnostics',
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#ff0000',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 0
        }),
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#00ff00',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:diagnostics:network-0',
          networkId: 'network-0'
        }
      }
    )

    const diagnostics =
      buildCenterDashedOverlapDiagnosticsFromResolvedPackets(packets)

    expect(diagnostics.components.length).toBeGreaterThan(0)
    expect(diagnostics.edges.length).toBeGreaterThan(0)
    expect(diagnostics.ownership.unresolvedBailouts).toEqual([])
    expect(diagnostics.ownership.ownedRegions.length).toBeGreaterThan(0)
    expect(
      new Set(
        diagnostics.ownership.ownedRegions.map((region) => region.ownerStrokeId)
      )
    ).toEqual(new Set(['stroke:0']))
    expect(
      new Set(
        diagnostics.ownership.ownedRegions.map((region) => region.ownerKey)
      )
    ).toEqual(new Set(['vector:diagnostics:network-0:stroke:0']))
    expect(
      new Set(
        diagnostics.ownership.ownedRegions.map((region) => region.networkId)
      )
    ).toEqual(new Set(['network-0']))
  })

  it('should run: forced component-local bailout preserves preview polygons on the real packet path', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'center-dashed-overlap-diagnostics-bailout',
      [
        { x: 0, y: 0 },
        { x: 120, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#ff0000',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 0
        }),
        createDefaultStroke({
          visible: true,
          style: 'dashed',
          position: 'center',
          width: 12,
          color: '#00ff00',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96,
          dashPattern: [30, 12],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:diagnostics-bailout:network-0',
          networkId: 'network-0'
        }
      }
    )

    const diagnostics = buildCenterDashedOverlapDiagnosticsFromResolvedPackets(
      packets,
      {
        forceBailoutReason: 'owner-tie-unresolved'
      }
    )

    expect(diagnostics.ownership.ownedRegions).toEqual([])
    expect(diagnostics.ownership.unresolvedBailouts.length).toBeGreaterThan(0)
    diagnostics.ownership.unresolvedBailouts.forEach((bailout) => {
      expect(bailout.reason).toBe('owner-tie-unresolved')
      expect(bailout.preservedOwnerKeys).toEqual([
        'vector:diagnostics-bailout:network-0:stroke:0',
        'vector:diagnostics-bailout:network-0:stroke:1'
      ])
      expect(bailout.preservedPreviewPolygons.length).toBeGreaterThan(0)
    })
  })

  it('should run: tangential center-dashed adjacency does not emit owned overlap regions', () => {
    const diagnostics = buildCenterDashedOverlapDiagnosticsFromResolvedPackets([
      createSyntheticPacket('tangent-center:0', 'stroke:0', [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]),
      createSyntheticPacket('tangent-center:1', 'stroke:1', [
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 10, y: 10 }
      ], 1)
    ])

    expect(diagnostics.edges).toEqual([
      ['tangent-center:0', 'tangent-center:1']
    ])
    expect(diagnostics.components).toHaveLength(1)
    expect(diagnostics.ownership.ownedRegions).toEqual([])
    expect(diagnostics.ownership.unresolvedBailouts).toEqual([])
  })
})
