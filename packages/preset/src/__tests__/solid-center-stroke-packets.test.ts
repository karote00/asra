import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import {
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  normalizeResolvedStrokePacketGeometry,
  toSolidCenterStrokeRenderEntries
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import { createGeometryBackendCapabilities } from '../components/stroke-render/geometry-backend'

describe('solid center stroke packets', () => {
  it('should run: derive render, hit, and export packets from the same final geometry source', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'center' })]
    )

    expect(packets).toHaveLength(1)

    const [resolved] = packets
    const [render] = toSolidCenterStrokeRenderEntries(packets)
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(render.cacheKey).toBe(resolved.geometry.geometryId)
    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(render.polygons).toBe(resolved.geometry.polygons)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
    expect(render.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(render.revisionSet).toBe(resolved.geometry.debugMeta?.revisionSet)
    expect(resolved.geometry.debugMeta?.revisionSet).toMatchObject({
      sourcePathRevision: expect.any(String),
      strokeSpecRevision: expect.any(String),
      intervalAllocationRevision: expect.any(String),
      topologyClassificationRevision: expect.any(String),
      ownershipRevision: expect.any(String),
      legalityRevision: expect.any(String),
      paintRevision: expect.any(String),
      previewModeRevision: 'preview:exact'
    })
  })

  it('should run: normalize duplicate polygons once before render, hit, and export packet emission', () => {
    const duplicatePolygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const reversedDuplicatePolygon = [...duplicatePolygon].reverse()
    const packets = [
      {
        geometry: {
          geometryId: 'duplicate:test',
          polygons: [duplicatePolygon, reversedDuplicatePolygon],
          bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
          debugMeta: {
            geometryFamily: 'constrained-solid' as const,
            resolutionStatus: 'exact-constrained' as const,
            runtimeStatus: 'accepted' as const,
            runtimeReason: 'constrained-solid-exact' as const
          }
        },
        paint: {
          geometryId: 'duplicate:test',
          color: 0xff0000,
          alpha: 1
        }
      }
    ]

    const [normalized] = normalizeResolvedStrokePacketGeometry(packets)
    const [render] = toSolidCenterStrokeRenderEntries(packets)
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(normalized.geometry.polygons).toHaveLength(1)
    expect(render.polygons).toHaveLength(1)
    expect(hit.polygons).toHaveLength(1)
    expect(exportPacket.polygons).toHaveLength(1)
    expect(hit.bounds).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20 })
    expect(exportPacket.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20
    })
  })

  it('should run: attach typed owner metadata to center solid packets and preserve it through hit/export packets', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'vector:test:network-a:center',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'center' })],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'vector:test:network-a:center',
      ownerKey: 'vector:test:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0
    })
    expect(buildSolidCenterStrokeHitTestPackets(packets)[0]?.debugMeta).toBe(
      packets[0]?.geometry.debugMeta
    )
    expect(buildSolidCenterStrokeExportPackets(packets)[0]?.debugMeta).toBe(
      packets[0]?.geometry.debugMeta
    )
    expect(buildSolidCenterStrokeHitTestPackets(packets)[0]).toMatchObject({
      primaryOwner: {
        ownerKey: 'vector:test:network-a:stroke:0',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0
      },
      ownerSet: [
        {
          ownerKey: 'vector:test:network-a:stroke:0',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0
        }
      ]
    })
    expect(buildSolidCenterStrokeExportPackets(packets)[0]).toMatchObject({
      primaryOwner: {
        ownerKey: 'vector:test:network-a:stroke:0',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0
      },
      ownerSet: [
        {
          ownerKey: 'vector:test:network-a:stroke:0',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0
        }
      ]
    })
  })

  it('should run: collapse dashed-center overlaps only for render while preserving interval packets', () => {
    const firstPolygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 8 },
      { x: 0, y: 8 }
    ]
    const secondPolygon = [
      { x: 10, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 8 },
      { x: 10, y: 8 }
    ]
    const unionPolygon = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 8 },
      { x: 0, y: 8 }
    ]
    const packets = [firstPolygon, secondPolygon].map((polygon, index) => ({
      geometry: {
        geometryId: `dashed-center:${index}`,
        polygons: [polygon],
        bounds: {
          minX: index === 0 ? 0 : 10,
          minY: 0,
          maxX: index === 0 ? 20 : 30,
          maxY: 8
        },
        debugMeta: {
          sourcePathId: 'vector:test:network-a:dashed-center',
          ownerKey: 'vector:test:network-a:stroke:0',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          intervalId: `interval:${index}`,
          sourceSpanIds: [`span:${index}`],
          geometryFamily: 'dashed-center' as const,
          resolutionStatus: 'native-center' as const,
          runtimeStatus: 'not-applicable' as const,
          runtimeReason: 'center-stroke' as const
        }
      },
      paint: {
        geometryId: `dashed-center:${index}`,
        color: 0xff0000,
        alpha: 0.5,
        paintKey: 'paint:red'
      }
    }))
    const exactBackend = {
      capabilities: createGeometryBackendCapabilities(false),
      union: () => [{ polygons: [unionPolygon] }]
    }
    exactBackend.capabilities.union = true

    const renderEntries = toSolidCenterStrokeRenderEntries(packets, {
      exactBackend
    })
    const rawRenderEntries = toSolidCenterStrokeRenderEntries(packets, {
      collapseDashedCenterVisualOverlaps: false,
      exactBackend
    })
    const hitPackets = buildSolidCenterStrokeHitTestPackets(packets)
    const exportPackets = buildSolidCenterStrokeExportPackets(packets)

    expect(renderEntries).toHaveLength(1)
    expect(renderEntries[0]?.polygons).toEqual([unionPolygon])
    expect(renderEntries[0]?.debugMeta).toMatchObject({
      intervalIds: ['interval:0', 'interval:1'],
      sourceSpanIds: ['span:0', 'span:1'],
      visualOverlapCollapseStatus: 'exact-union',
      visualOverlapSourceGeometryIds: ['dashed-center:0', 'dashed-center:1']
    })
    expect(rawRenderEntries).toHaveLength(2)
    expect(hitPackets).toHaveLength(2)
    expect(exportPackets).toHaveLength(2)
    expect(exportPackets.map((packet) => packet.intervalIds)).toEqual([
      ['interval:0'],
      ['interval:1']
    ])
  })

  it('should not run: emit packets for unsupported constrained slices', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toEqual([])
  })

  it('should run: create hit areas from the same canonical final polygons', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'rect:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'center' })]
    )

    const hitArea = createSolidCenterStrokeHitArea(packets)

    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-5, -5)).toBe(false)
  })

  it('should run: materialize canonical final faces with typed owner metadata', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'vector:test:network-a:center',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'center' })],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a'
        }
      }
    )

    const [face] = buildStrokeFinalFacesFromResolvedPackets(packets)

    expect(face).toMatchObject({
      faceId: packets[0]?.geometry.geometryId,
      sourceGeometryIds: [packets[0]?.geometry.geometryId],
      geometryFamily: 'solid-center',
      resolutionStatus: 'native-center',
      runtimeStatus: 'not-applicable',
      sourceTopology: 'open'
    })
    expect(face?.ownerSet).toEqual([
      {
        ownerKey: 'vector:test:network-a:stroke:0',
        sourcePathId: 'vector:test:network-a:center',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0
      }
    ])
    expect(face?.paintKey).toBe('solid:0:1')
    expect(face?.strokeSpecKey).toMatch(/^stroke-spec:/)
    expect(face?.visualPacketKey).toContain(face?.strokeSpecKey)
  })

  it('should not run: collapse local-side approximation duplicate final faces', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const basePacket = {
      geometry: {
        geometryId: 'duplicate:a',
        polygons: [polygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        debugMeta: {
          sourcePathId: 'vector:a',
          ownerKey: 'vector:a:stroke:0',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          contourId: 'contour-a',
          intervalId: 'interval-a',
          sourceSpanIds: ['span-a'],
          geometryFamily: 'constrained-dashed',
          resolutionStatus: 'local-side-approximation',
          runtimeStatus: 'accepted',
          revisionSet: {
            strokeSpecRevision: 'stroke-spec:shared',
            paintRevision: 'paint:shared'
          }
        }
      },
      paint: {
        geometryId: 'duplicate:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:red'
      }
    }
    const duplicateOwnerPacket = {
      ...basePacket,
      geometry: {
        ...basePacket.geometry,
        geometryId: 'duplicate:b',
        debugMeta: {
          ...basePacket.geometry.debugMeta,
          sourcePathId: 'vector:b',
          ownerKey: 'vector:b:stroke:0',
          networkId: 'network-b',
          contourId: 'contour-b',
          intervalId: 'interval-b',
          sourceSpanIds: ['span-b']
        }
      },
      paint: {
        ...basePacket.paint,
        geometryId: 'duplicate:b'
      }
    }

    const [face] = buildStrokeFinalFacesFromResolvedPackets(
      [basePacket, duplicateOwnerPacket],
      {
        collapseDuplicateFaces: true
      }
    )

    expect(face?.sourceGeometryIds).toEqual(['duplicate:a'])
    expect(face?.ownerSet.map((owner) => owner.ownerKey)).toEqual([
      'vector:a:stroke:0'
    ])
    expect(
      buildStrokeFinalFacesFromResolvedPackets(
        [basePacket, duplicateOwnerPacket],
        {
          collapseDuplicateFaces: true
        }
      )
    ).toHaveLength(2)
  })

  it('should run: collapse exact duplicate final faces only when visual packet keys match', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const basePacket = {
      geometry: {
        geometryId: 'duplicate:a',
        polygons: [polygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        debugMeta: {
          sourcePathId: 'vector:a',
          ownerKey: 'vector:a:stroke:0',
          networkId: 'network-a',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          contourId: 'contour-a',
          intervalId: 'interval-a',
          sourceSpanIds: ['span-a'],
          geometryFamily: 'constrained-dashed' as const,
          resolutionStatus: 'exact-constrained' as const,
          runtimeStatus: 'accepted' as const,
          arrangementStatus: 'exact' as const,
          arrangementFaceId: 'face:a',
          arrangementCandidateIds: ['duplicate:a'],
          arrangementLegalState: {
            insideFillDomain: true,
            outsideFillDomain: false
          },
          revisionSet: {
            strokeSpecRevision: 'stroke-spec:shared',
            paintRevision: 'paint:shared'
          }
        }
      },
      paint: {
        geometryId: 'duplicate:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:red'
      }
    }
    const duplicateOwnerPacket = {
      ...basePacket,
      geometry: {
        ...basePacket.geometry,
        geometryId: 'duplicate:b',
        debugMeta: {
          ...basePacket.geometry.debugMeta,
          sourcePathId: 'vector:b',
          ownerKey: 'vector:b:stroke:0',
          networkId: 'network-b',
          contourId: 'contour-b',
          intervalId: 'interval-b',
          sourceSpanIds: ['span-b'],
          arrangementFaceId: 'face:b',
          arrangementCandidateIds: ['duplicate:b']
        }
      },
      paint: {
        ...basePacket.paint,
        geometryId: 'duplicate:b'
      }
    }

    const faces = buildStrokeFinalFacesFromResolvedPackets(
      [basePacket, duplicateOwnerPacket],
      {
        collapseDuplicateFaces: true
      }
    )

    expect(faces).toHaveLength(1)
    expect(faces[0]?.sourceGeometryIds).toEqual(['duplicate:a', 'duplicate:b'])
    expect(faces[0]?.ownerSet.map((owner) => owner.ownerKey)).toEqual([
      'vector:a:stroke:0',
      'vector:b:stroke:0'
    ])
    expect(faces[0]?.intervalIds).toEqual(['interval-a', 'interval-b'])
    expect(faces[0]?.sourceSpanIds).toEqual(['span-a', 'span-b'])
    expect(faces[0]?.sourceContourIds).toEqual(['contour-a', 'contour-b'])
  })

  it('should not run: collapse duplicate geometry when paint differs', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const packet = {
      geometry: {
        geometryId: 'duplicate:a',
        polygons: [polygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        debugMeta: {
          ownerKey: 'owner:a',
          geometryFamily: 'constrained-dashed',
          revisionSet: {
            strokeSpecRevision: 'stroke-spec:shared'
          }
        }
      },
      paint: {
        geometryId: 'duplicate:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:red'
      }
    }
    const differentPaintPacket = {
      ...packet,
      geometry: {
        ...packet.geometry,
        geometryId: 'duplicate:b',
        debugMeta: {
          ...packet.geometry.debugMeta,
          ownerKey: 'owner:b'
        }
      },
      paint: {
        geometryId: 'duplicate:b',
        color: 0x0000ff,
        alpha: 1,
        paintKey: 'paint:blue'
      }
    }

    expect(
      buildStrokeFinalFacesFromResolvedPackets([packet, differentPaintPacket], {
        collapseDuplicateFaces: true
      })
    ).toHaveLength(2)
  })

  it('should not run: collapse duplicate geometry when opacity differs', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const packet = {
      geometry: {
        geometryId: 'duplicate:a',
        polygons: [polygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        debugMeta: {
          ownerKey: 'owner:a',
          geometryFamily: 'constrained-dashed',
          runtimeStatus: 'accepted',
          revisionSet: {
            strokeSpecRevision: 'stroke-spec:shared',
            paintRevision: 'paint:shared'
          }
        }
      },
      paint: {
        geometryId: 'duplicate:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:red'
      }
    }
    const differentOpacityPacket = {
      ...packet,
      geometry: {
        ...packet.geometry,
        geometryId: 'duplicate:b',
        debugMeta: {
          ...packet.geometry.debugMeta,
          ownerKey: 'owner:b'
        }
      },
      paint: {
        ...packet.paint,
        geometryId: 'duplicate:b',
        alpha: 0.5
      }
    }

    expect(
      buildStrokeFinalFacesFromResolvedPackets(
        [packet, differentOpacityPacket],
        { collapseDuplicateFaces: true }
      )
    ).toHaveLength(2)
  })

  it('should not run: collapse duplicate geometry when visual context differs', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const packet = {
      geometry: {
        geometryId: 'duplicate:a',
        polygons: [polygon],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        debugMeta: {
          ownerKey: 'owner:a',
          geometryFamily: 'constrained-dashed',
          runtimeStatus: 'accepted',
          visualContext: {
            blendMode: 'normal',
            stackingGroupKey: 'stack:a',
            maskKey: 'mask:none',
            clipKey: 'clip:none',
            effectKey: 'effect:none'
          },
          revisionSet: {
            strokeSpecRevision: 'stroke-spec:shared',
            paintRevision: 'paint:shared'
          }
        }
      },
      paint: {
        geometryId: 'duplicate:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:red'
      }
    }
    const differentStackPacket = {
      ...packet,
      geometry: {
        ...packet.geometry,
        geometryId: 'duplicate:b',
        debugMeta: {
          ...packet.geometry.debugMeta,
          ownerKey: 'owner:b',
          visualContext: {
            ...packet.geometry.debugMeta.visualContext,
            stackingGroupKey: 'stack:b'
          }
        }
      },
      paint: {
        ...packet.paint,
        geometryId: 'duplicate:b'
      }
    }

    const faces = buildStrokeFinalFacesFromResolvedPackets(
      [packet, differentStackPacket],
      { collapseDuplicateFaces: true }
    )

    expect(faces).toHaveLength(2)
    expect(faces[0]?.visualPacketKey).toContain('stackingGroupKey:stack:a')
    expect(faces[1]?.visualPacketKey).toContain('stackingGroupKey:stack:b')
  })
})
