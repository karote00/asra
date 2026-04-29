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
})
