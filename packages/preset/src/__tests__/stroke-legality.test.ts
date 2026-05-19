import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import { buildConstrainedSolidLegalityClippingResult } from '../components/stroke-render/constrained-solid-legality-clipping'
import type { SolidCenterStrokeResolvedPacket } from '../components/stroke-render/solid-center-stroke-packets'

describe('stroke legality application', () => {
  it('should run: clip constrained solid candidate geometry without replacing packet identity', () => {
    const packet: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'opaque-candidate:inside-overflow',
        polygons: [
          [
            { x: -5, y: 2 },
            { x: 15, y: 2 },
            { x: 15, y: 8 },
            { x: -5, y: 8 }
          ]
        ],
        bounds: { minX: -5, minY: 2, maxX: 15, maxY: 8 },
        debugMeta: {
          sourcePathId: 'source:typed',
          ownerKey: 'owner:typed',
          networkId: 'network:typed',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          contourId: 'contour:typed',
          legalDomainId: 'legal:typed',
          intervalId: 'interval:typed',
          sourceSpanIds: ['span:a'],
          legalDomainIds: ['legal:typed'],
          ownerSet: [
            {
              ownerKey: 'owner:typed',
              sourcePathId: 'source:typed',
              networkId: 'network:typed',
              strokeId: 'stroke:0',
              strokeIndex: 0,
              contourId: 'contour:typed',
              intervalId: 'interval:typed'
            }
          ],
          figmaLikeSplitRangeId: 'split-range:typed',
          figmaLikeSplitRangeStartDistance: 0,
          figmaLikeSplitRangeEndDistance: 20,
          figmaLikeTerminalRole: 'start',
          figmaLikeSideAuthority: 'implicit-fill-hole-domain',
          figmaLikeSelectedSide: 1,
          figmaLikeSideResolutionStatus: 'resolved',
          figmaLikeSideResolutionReason: 'legal-domain-probe',
          figmaLikeSplitRangeTerminals: [
            {
              intervalId: 'interval:typed',
              splitRangeId: 'split-range:typed',
              splitRangeStartDistance: 0,
              splitRangeEndDistance: 20,
              terminalRole: 'start',
              startDistance: 0,
              endDistance: 5
            }
          ],
          geometryFamily: 'constrained-solid',
          resolutionStatus: 'exact-constrained',
          runtimeStatus: 'accepted',
          strokePosition: 'inside'
        }
      },
      paint: {
        geometryId: 'opaque-candidate:inside-overflow',
        color: 0xff0000,
        alpha: 1
      }
    }

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          width: 4,
          style: 'solid',
          position: 'inside'
        })
      ],
      [packet]
    )

    expect(result.packets).toHaveLength(1)
    expect(result.eligibleOverflowGeometryIds).toEqual([
      'opaque-candidate:inside-overflow'
    ])
    expect(result.preservedGeometryIds).toEqual([
      'opaque-candidate:inside-overflow'
    ])
    expect(result.packets[0]?.geometry.geometryId).toBe(
      'opaque-candidate:inside-overflow'
    )
    expect(result.packets[0]?.geometry.debugMeta).toBe(
      packet.geometry.debugMeta
    )
    expect(result.packets[0]?.geometry.debugMeta).toMatchObject({
      ownerSet: packet.geometry.debugMeta?.ownerSet,
      sourceSpanIds: ['span:a'],
      legalDomainIds: ['legal:typed'],
      figmaLikeSplitRangeId: 'split-range:typed',
      figmaLikeTerminalRole: 'start',
      figmaLikeSplitRangeTerminals: [
        {
          intervalId: 'interval:typed',
          splitRangeId: 'split-range:typed',
          terminalRole: 'start',
          startDistance: 0,
          endDistance: 5
        }
      ]
    })
    expect(result.packets[0]?.paint).toBe(packet.paint)
    expect(result.packets[0]?.geometry.bounds).toEqual({
      minX: 0,
      minY: 2,
      maxX: 10,
      maxY: 8
    })
  })

  it('should not run: create replacement center-band geometry during legality', () => {
    const packet: SolidCenterStrokeResolvedPacket = {
      geometry: {
        geometryId: 'candidate:outside-with-interior',
        polygons: [
          [
            { x: -4, y: -4 },
            { x: 14, y: -4 },
            { x: 14, y: 14 },
            { x: -4, y: 14 }
          ]
        ],
        bounds: { minX: -4, minY: -4, maxX: 14, maxY: 14 },
        debugMeta: {
          sourcePathId: 'source:outside',
          ownerKey: 'owner:outside',
          networkId: 'network:outside',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          geometryFamily: 'constrained-solid',
          resolutionStatus: 'exact-constrained',
          runtimeStatus: 'accepted',
          strokePosition: 'outside'
        }
      },
      paint: {
        geometryId: 'candidate:outside-with-interior',
        color: 0x0000ff,
        alpha: 1
      }
    }

    const result = buildConstrainedSolidLegalityClippingResult(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          width: 4,
          style: 'solid',
          position: 'outside'
        })
      ],
      [packet]
    )

    expect(result.packets[0]?.geometry.geometryId).toBe(
      'candidate:outside-with-interior'
    )
    expect(
      result.packets[0]?.geometry.polygons.every((polygon) =>
        polygon.every(
          (point) =>
            point.x <= 0 || point.x >= 10 || point.y <= 0 || point.y >= 10
        )
      )
    ).toBe(true)
  })
})
