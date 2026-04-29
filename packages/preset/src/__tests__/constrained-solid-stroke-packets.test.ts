import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import {
  buildConstrainedSolidStrokeResolvedPackets,
  hasConstrainedSolidStrokeIntent
} from '../components/stroke-render/constrained-solid-stroke-packets'
import {
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeHitTestPackets,
  createSolidCenterStrokeHitArea
} from '../components/stroke-render/solid-center-stroke-packets'

describe('constrained solid stroke packets', () => {
  it('should detect constrained solid intent only for positive-width inside/outside solid strokes', () => {
    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })
      ])
    ).toBe(true)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'solid', position: 'center' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 4, style: 'dashed', position: 'inside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({ width: 0, style: 'solid', position: 'outside' })
      ])
    ).toBe(false)

    expect(
      hasConstrainedSolidStrokeIntent([
        createDefaultStroke({
          visible: false,
          width: 4,
          style: 'solid',
          position: 'inside'
        })
      ])
    ).toBe(false)
  })

  it('should run: derive render, hit, and export packets from the same constrained final geometry source', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
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

    expect(packets).toHaveLength(1)

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(hit.geometryId).toBe(resolved.geometry.geometryId)
    expect(exportPacket.geometryId).toBe(resolved.geometry.geometryId)
    expect(hit.polygons).toBe(resolved.geometry.polygons)
    expect(exportPacket.polygons).toBe(resolved.geometry.polygons)
    expect(hit.bounds).toEqual(resolved.geometry.bounds)
    expect(exportPacket.bounds).toEqual(resolved.geometry.bounds)
  })

  it('should run: derive open constrained solid packets from one-sided geometry', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)
    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(hit?.debugMeta).toBe(resolved?.geometry.debugMeta)
    expect(exportPacket?.debugMeta).toBe(resolved?.geometry.debugMeta)
    expect(resolved?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      sourceTopology: 'open',
      topologyFamily: 'open'
    })
    expect(packets[0].geometry.geometryId).toBe('line:test:0')
    expect(packets[0].geometry.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 4
    })
    expect(packets[0].geometry.polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 4 },
        { x: 0, y: 4 }
      ]
    ])
  })

  it('should run: attach typed owner and network metadata to constrained solid packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'opaque-cache-key',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'typed-vector:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets).toHaveLength(1)
    expect(packets[0].geometry.debugMeta).toMatchObject({
      sourcePathId: 'opaque-cache-key',
      ownerKey: 'typed-vector:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      contourId: 'opaque-cache-key:contour:0',
      legalDomainId: 'opaque-cache-key:legal-domain:0',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
  })

  it('should run: preserve constrained solid legal-domain metadata across render, hit, and export packets', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'rect:legal-domain',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })],
      {
        metadata: {
          ownerKeyPrefix: 'rect:legal-domain',
          networkId: 'shape'
        }
      }
    )

    const [resolved] = packets
    const [hit] = buildSolidCenterStrokeHitTestPackets(packets)
    const [exportPacket] = buildSolidCenterStrokeExportPackets(packets)

    expect(resolved.geometry.debugMeta).toMatchObject({
      sourcePathId: 'rect:legal-domain',
      ownerKey: 'rect:legal-domain:stroke:0',
      strokeIndex: 0,
      contourId: 'rect:legal-domain:contour:0',
      legalDomainId: 'rect:legal-domain:legal-domain:0',
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'exact-constrained',
      runtimeStatus: 'accepted',
      runtimeReason: 'constrained-solid-exact',
      sourceTopology: 'rectangle-equivalent',
      topologyFamily: 'rectangle-equivalent'
    })
    expect(hit.debugMeta).toBe(resolved.geometry.debugMeta)
    expect(exportPacket.debugMeta).toBe(resolved.geometry.debugMeta)
  })

  it('should run: keep non-overflow constrained hit inside the legal owner domain', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
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

    const hitArea = createSolidCenterStrokeHitArea(packets)

    expect(hitArea?.contains(1, 1)).toBe(true)
    expect(hitArea?.contains(10, 10)).toBe(false)
    expect(hitArea?.contains(-1, -1)).toBe(false)
  })

  it('should run: keep open constrained solid hit testing on the selected side only', () => {
    const insidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:inside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )
    const outsidePackets = buildConstrainedSolidStrokeResolvedPackets(
      'line:test:outside',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'outside' })]
    )

    const insideHitArea = createSolidCenterStrokeHitArea(insidePackets)
    const outsideHitArea = createSolidCenterStrokeHitArea(outsidePackets)

    expect(insideHitArea?.contains(10, 1)).toBe(true)
    expect(insideHitArea?.contains(10, -1)).toBe(false)
    expect(outsideHitArea?.contains(10, -1)).toBe(true)
    expect(outsideHitArea?.contains(10, 1)).toBe(false)
  })

  it('should run: emit local-side constrained solid packets for self-intersecting open paths', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'open-self-intersecting:test',
      [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ],
      false,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'inside' })]
    )

    expect(packets).toHaveLength(1)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      geometryFamily: 'constrained-solid',
      resolutionStatus: 'local-side-approximation',
      sourceTopology: 'open'
    })
  })
})
