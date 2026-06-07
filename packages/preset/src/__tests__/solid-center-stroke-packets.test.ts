import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import {
  applySolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeExportPackets,
  buildSolidCenterStrokeExportPacketsFromFinalFaces,
  buildSolidCenterStrokeHitTestPackets,
  buildSolidCenterStrokeHitTestPacketsFromFinalFaces,
  buildSolidCenterStrokeResolvedPackets,
  createSolidCenterStrokeHitArea,
  normalizeResolvedStrokePacketGeometry,
  toSolidCenterStrokeRenderEntriesFromFinalFaces,
  toSolidCenterStrokeRenderEntries
} from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import { createGeometryBackendCapabilities } from '../components/stroke-render/geometry-backend'

type StrokeDiagnosticsMode = 'off' | 'summary' | 'full'

const withStrokeDiagnosticsMode = <T>(
  mode: StrokeDiagnosticsMode,
  run: () => T
): T => {
  const target = globalThis as typeof globalThis & {
    __ASYRA_STROKE_DIAGNOSTICS_MODE__?: StrokeDiagnosticsMode
  }
  const previous = target.__ASYRA_STROKE_DIAGNOSTICS_MODE__
  target.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = mode
  try {
    return run()
  } finally {
    if (previous === undefined) {
      delete target.__ASYRA_STROKE_DIAGNOSTICS_MODE__
    } else {
      target.__ASYRA_STROKE_DIAGNOSTICS_MODE__ = previous
    }
  }
}

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
    expect(render.debugMeta).toBeUndefined()
    expect(hit.debugMeta).toBeUndefined()
    expect(exportPacket.debugMeta).toBeUndefined()
    withStrokeDiagnosticsMode('full', () => {
      expect(toSolidCenterStrokeRenderEntries(packets)[0]?.debugMeta).toBe(
        resolved.geometry.debugMeta
      )
      expect(buildSolidCenterStrokeHitTestPackets(packets)[0]?.debugMeta).toBe(
        resolved.geometry.debugMeta
      )
      expect(buildSolidCenterStrokeExportPackets(packets)[0]?.debugMeta).toBe(
        resolved.geometry.debugMeta
      )
    })
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

  it('should run: project render, hit, and export packets directly from FinalFace[]', () => {
    const packets = buildSolidCenterStrokeResolvedPackets(
      'rect:final-face-projection',
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      [createDefaultStroke({ width: 4, style: 'solid', position: 'center' })]
    )
    const faces = buildStrokeFinalFacesFromResolvedPackets(packets)
    const [face] = faces
    const [render] = toSolidCenterStrokeRenderEntriesFromFinalFaces(faces)
    const [hit] = buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces)
    const [exportPacket] =
      buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)
    const graphic = {}

    expect(face).toBeDefined()
    expect(render.cacheKey).toBe(hit.geometryId)
    expect(exportPacket.geometryId).toBe(hit.geometryId)
    expect(render.polygons).toBe(face?.polygons)
    expect(hit.polygons).toBe(face?.polygons)
    expect(exportPacket.polygons).toBe(face?.polygons)
    expect(hit.bounds).toBe(face?.bounds)
    expect(exportPacket.bounds).toBe(face?.bounds)
    expect(render.debugMeta).toBeUndefined()
    expect(hit.debugMeta).toBeUndefined()
    expect(exportPacket.debugMeta).toBeUndefined()
    withStrokeDiagnosticsMode('full', () => {
      expect(
        toSolidCenterStrokeRenderEntriesFromFinalFaces(faces)[0]?.debugMeta
      ).toBe(face?.debugMeta)
      expect(
        buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces)[0]?.debugMeta
      ).toBe(face?.debugMeta)
      expect(
        buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)[0]?.debugMeta
      ).toBe(face?.debugMeta)
    })
    expect(hit.ownerSet).toBe(face?.ownerSet)
    expect(exportPacket.ownerSet).toBe(face?.ownerSet)
    expect(hit.intervalIds).toBe(face?.intervalIds)
    expect(exportPacket.intervalIds).toBe(face?.intervalIds)
    expect(hit.sourceSpanIds).toBe(face?.sourceSpanIds)
    expect(exportPacket.sourceSpanIds).toBe(face?.sourceSpanIds)
    expect(hit.sourceContourIds).toBe(face?.sourceContourIds)
    expect(exportPacket.sourceContourIds).toBe(face?.sourceContourIds)
    expect(hit.legalDomainIds).toBe(face?.legalDomainIds)
    expect(exportPacket.legalDomainIds).toBe(face?.legalDomainIds)

    applySolidCenterStrokeExportPacketsFromFinalFaces(graphic, faces)
    expect(
      (
        graphic as {
          __asyraSolidCenterStrokeExportPackets?: (typeof exportPacket)[]
        }
      ).__asyraSolidCenterStrokeExportPackets?.[0]
    ).toBe(exportPacket)
  })

  it('should run: preserve split-range terminal provenance through render, hit, and export projection', () => {
    const packet = {
      geometry: {
        geometryId: 'terminal-projection:a',
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 4 },
            { x: 0, y: 4 }
          ]
        ],
        bounds: { minX: 0, minY: 0, maxX: 10, maxY: 4 },
        debugMeta: {
          sourcePathId: 'source:terminal',
          ownerKey: 'owner:terminal',
          networkId: 'network:terminal',
          strokeId: 'stroke:0',
          strokeIndex: 0,
          contourId: 'contour:terminal',
          legalDomainId: 'legal:terminal',
          intervalId: 'interval:terminal-start',
          sourceSpanIds: ['span:terminal'],
          sourceContourIds: ['contour:terminal'],
          legalDomainIds: ['legal:terminal'],
          geometryFamily: 'constrained-dashed' as const,
          resolutionStatus: 'exact-constrained' as const,
          runtimeStatus: 'accepted' as const,
          sourceTopology: 'self-intersecting' as const,
          strokePosition: 'inside' as const,
          figmaLikeSplitRangeId: 'split-range:terminal',
          figmaLikeSplitRangeStartDistance: 0,
          figmaLikeSplitRangeEndDistance: 30,
          figmaLikeTerminalRole: 'start' as const,
          figmaLikeSideAuthority: 'implicit-fill-hole-domain' as const,
          figmaLikeSelectedSide: 1 as const,
          figmaLikeSideResolutionStatus: 'resolved' as const,
          figmaLikeSplitRangeTerminals: [
            {
              intervalId: 'interval:terminal-start',
              splitRangeId: 'split-range:terminal',
              splitRangeStartDistance: 0,
              splitRangeEndDistance: 30,
              terminalRole: 'start' as const,
              startDistance: 0,
              endDistance: 8
            }
          ]
        }
      },
      paint: {
        geometryId: 'terminal-projection:a',
        color: 0xff0000,
        alpha: 1,
        paintKey: 'paint:terminal'
      }
    }
    const faces = buildStrokeFinalFacesFromResolvedPackets([packet])
    const [render] = toSolidCenterStrokeRenderEntriesFromFinalFaces(faces)
    const [hit] = buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces)
    const [exportPacket] =
      buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)

    expect(render.debugMeta).toBeUndefined()
    expect(hit.debugMeta).toBeUndefined()
    expect(exportPacket.debugMeta).toBeUndefined()
    withStrokeDiagnosticsMode('full', () => {
      const [diagnosticRender] =
        toSolidCenterStrokeRenderEntriesFromFinalFaces(faces)
      const [diagnosticHit] =
        buildSolidCenterStrokeHitTestPacketsFromFinalFaces(faces)
      const [diagnosticExport] =
        buildSolidCenterStrokeExportPacketsFromFinalFaces(faces)

      expect(diagnosticRender.debugMeta?.figmaLikeSplitRangeTerminals).toEqual([
        {
          intervalId: 'interval:terminal-start',
          splitRangeId: 'split-range:terminal',
          splitRangeStartDistance: 0,
          splitRangeEndDistance: 30,
          terminalRole: 'start',
          startDistance: 0,
          endDistance: 8
        }
      ])
      expect(diagnosticHit.debugMeta?.figmaLikeSplitRangeTerminals).toBe(
        diagnosticRender.debugMeta?.figmaLikeSplitRangeTerminals
      )
      expect(diagnosticExport.debugMeta?.figmaLikeSplitRangeTerminals).toBe(
        diagnosticRender.debugMeta?.figmaLikeSplitRangeTerminals
      )
    })
    expect(hit.intervalIds).toBe(faces[0]?.intervalIds)
    expect(exportPacket.sourceSpanIds).toBe(faces[0]?.sourceSpanIds)
    expect(exportPacket.legalDomainIds).toBe(faces[0]?.legalDomainIds)
  })

  it('should run: filter invalid polygons once before render, hit, and export packet emission', () => {
    const validPolygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 }
    ]
    const invalidPolygon = [
      { x: 100, y: 100 },
      { x: 120, y: 100 }
    ]
    const packets = [
      {
        geometry: {
          geometryId: 'duplicate:test',
          polygons: [validPolygon, invalidPolygon],
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
    expect(
      buildSolidCenterStrokeHitTestPackets(packets)[0]?.debugMeta
    ).toBeUndefined()
    expect(
      buildSolidCenterStrokeExportPackets(packets)[0]?.debugMeta
    ).toBeUndefined()
    withStrokeDiagnosticsMode('full', () => {
      expect(buildSolidCenterStrokeHitTestPackets(packets)[0]?.debugMeta).toBe(
        packets[0]?.geometry.debugMeta
      )
      expect(buildSolidCenterStrokeExportPackets(packets)[0]?.debugMeta).toBe(
        packets[0]?.geometry.debugMeta
      )
    })
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
    expect(renderEntries[0]?.debugMeta).toBeUndefined()
    withStrokeDiagnosticsMode('full', () => {
      expect(
        toSolidCenterStrokeRenderEntries(packets, {
          exactBackend
        })[0]?.debugMeta
      ).toMatchObject({
        intervalIds: ['interval:0', 'interval:1'],
        sourceSpanIds: ['span:0', 'span:1'],
        visualOverlapCollapseStatus: 'exact-union',
        visualOverlapSourceGeometryIds: ['dashed-center:0', 'dashed-center:1']
      })
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
    expect(face?.strokeSpecKey).toMatch(/^render-output:/)
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
