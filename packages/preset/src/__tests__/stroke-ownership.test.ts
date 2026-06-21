import { describe, expect, it } from 'vitest'
import { resolveStrokeOwnership } from '../components/stroke-render/stroke-ownership'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'

const square = () => [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]

describe('stroke ownership resolution', () => {
  it('should run: resolve ownerSet from typed metadata before secondary owner fields', () => {
    const ownership = resolveStrokeOwnership({
      ownerSet: [
        {
          ownerKey: 'typed-owner:a',
          networkId: 'network-a',
          strokeId: 'stroke:1',
          intervalId: 'interval:a'
        }
      ],
      owner: {
        ownerKey: 'secondary-owner',
        networkId: 'secondary-network'
      }
    })

    expect(ownership).toEqual({
      status: 'accepted',
      reason: 'explicit-owner-set',
      primaryOwner: {
        ownerKey: 'typed-owner:a',
        networkId: 'network-a',
        strokeId: 'stroke:1',
        intervalId: 'interval:a'
      },
      ownerSet: [
        {
          ownerKey: 'typed-owner:a',
          networkId: 'network-a',
          strokeId: 'stroke:1',
          intervalId: 'interval:a'
        }
      ]
    })
  })

  it('should run: derive secondary ownership from typed fields without parsing geometry ids', () => {
    const [face] = buildStrokeFinalFacesFromResolvedPackets([
      {
        geometry: {
          geometryId:
            'opaque-id-that-mentions-owner:wrong-network:wrong-stroke',
          polygons: [square()],
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          debugMeta: {
            sourcePathId: 'source:typed',
            ownerKey: 'owner:typed',
            networkId: 'network:typed',
            strokeId: 'stroke:typed',
            strokeIndex: 3,
            contourId: 'contour:typed',
            intervalId: 'interval:typed',
            productMode: 'closed-constrained-domain',
            productSignature: 'constrained-dashed:inside',
            domainMode: 'closed-constrained-domain',
            topologyFamily: 'self-intersecting'
          }
        },
        paint: {
          geometryId: 'paint:typed',
          color: 0xff0000,
          alpha: 1
        }
      }
    ])

    expect(face?.ownerSet).toEqual([
      {
        ownerKey: 'owner:typed',
        sourcePathId: 'source:typed',
        networkId: 'network:typed',
        strokeId: 'stroke:typed',
        strokeIndex: 3,
        contourId: 'contour:typed',
        intervalId: 'interval:typed'
      }
    ])
  })

  it('should not run: accept ownership when no typed owner metadata exists', () => {
    expect(resolveStrokeOwnership({})).toEqual({
      status: 'blocked',
      reason: 'missing-owner-metadata',
      ownerSet: []
    })
  })
})
