import { describe, expect, it } from 'vitest'
import { StrokeJoinTypes, createDefaultStroke } from '@asyra/utils'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildSolidCenterStrokeResolvedPackets } from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'

describe('dashed center stroke packets', () => {
  it('should run: build true arc-length packets on an open center path when dashOffset is zero', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'open-line',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [20, 10],
          dashOffset: 0
        })
      ]
    )

    expect(packets).toHaveLength(3)
    expect(
      packets.map((packet) => ({
        minX: packet.geometry.bounds.minX,
        maxX: packet.geometry.bounds.maxX,
        dashPlacementMode: packet.geometry.debugMeta?.dashPlacementMode
      }))
    ).toEqual([
      {
        minX: 0,
        maxX: 20,
        dashPlacementMode: 'arc-length-pattern'
      },
      {
        minX: 30,
        maxX: 50,
        dashPlacementMode: 'arc-length-pattern'
      },
      {
        minX: 60,
        maxX: 80,
        dashPlacementMode: 'arc-length-pattern'
      }
    ])
  })

  it('should run: attach typed owner metadata to center dashed interval packets', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'vector:test:network-a:dashed-center',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [20, 10],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a'
        }
      }
    )

    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      sourcePathId: 'vector:test:network-a:dashed-center',
      ownerKey: 'vector:test:network-a:stroke:0',
      networkId: 'network-a',
      strokeId: 'stroke:0',
      strokeIndex: 0,
      intervalId: 'interval:0',
      sourceSpanIds: [
        'vector:test:network-a:dashed-center:contour:0:source-span:0'
      ]
    })
  })

  it('should run: materialize dashed center intervals as final faces without bridge collapse', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'vector:test:network-a:dashed-center',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [20, 10],
          dashOffset: 0
        })
      ],
      {
        metadata: {
          ownerKeyPrefix: 'vector:test:network-a',
          networkId: 'network-a'
        }
      }
    )

    const faces = buildStrokeFinalFacesFromResolvedPackets(packets)

    expect(faces).toHaveLength(packets.length)
    expect(faces[0]).toMatchObject({
      faceId: packets[0]?.geometry.geometryId,
      sourceGeometryIds: [packets[0]?.geometry.geometryId],
      geometryFamily: 'dashed-center',
      resolutionStatus: 'native-center',
      runtimeStatus: 'not-applicable',
      sourceTopology: 'open',
      intervalIds: ['interval:0'],
      sourceSpanIds: [
        'vector:test:network-a:dashed-center:contour:0:source-span:0'
      ]
    })
    expect(faces[0]?.ownerSet).toEqual([
      {
        ownerKey: 'vector:test:network-a:stroke:0',
        sourcePathId: 'vector:test:network-a:dashed-center',
        networkId: 'network-a',
        strokeId: 'stroke:0',
        strokeIndex: 0,
        intervalId: 'interval:0'
      }
    ])
  })

  it('should not run: emit any packets for unsupported dashed slices', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'unsupported',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'inside',
          width: 4,
          dashPattern: [20, 10]
        })
      ]
    )

    expect(packets).toEqual([])
  })

  it('should run: preserve supported butt and square cap semantics on open dashed intervals', () => {
    const buttPackets = buildDashedCenterStrokeResolvedPackets(
      'open-line-butt',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          capType: 'butt',
          dashPattern: [20, 10]
        })
      ]
    )

    const squarePackets = buildDashedCenterStrokeResolvedPackets(
      'open-line-square',
      [
        { x: 0, y: 0 },
        { x: 90, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          capType: 'square',
          dashPattern: [20, 10]
        })
      ]
    )

    expect(buttPackets[0]?.geometry.bounds.minX).toBe(0)
    expect(squarePackets[0]?.geometry.bounds.minX).toBe(-2)
  })

  it('should run: changing one stroke offset does not rebuild unrelated dashed packet geometry', () => {
    const baseline = buildDashedCenterStrokeResolvedPackets(
      'multi-stroke',
      [
        { x: 0, y: 0 },
        { x: 160, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [20, 20],
          dashOffset: 0
        }),
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [30, 10],
          dashOffset: 0
        })
      ]
    )

    const shifted = buildDashedCenterStrokeResolvedPackets(
      'multi-stroke',
      [
        { x: 0, y: 0 },
        { x: 160, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [20, 20],
          dashOffset: 5
        }),
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          dashPattern: [30, 10],
          dashOffset: 0
        })
      ]
    )

    const baselineFirstStroke = baseline
      .filter((packet) => packet.geometry.debugMeta?.strokeId === 'stroke:0')
      .map((packet) => packet.geometry.bounds)
    const shiftedFirstStroke = shifted
      .filter((packet) => packet.geometry.debugMeta?.strokeId === 'stroke:0')
      .map((packet) => packet.geometry.bounds)
    const baselineSecondStroke = baseline
      .filter((packet) => packet.geometry.debugMeta?.strokeId === 'stroke:1')
      .map((packet) => ({
        intervalId: packet.geometry.debugMeta?.intervalId,
        bounds: packet.geometry.bounds
      }))
    const shiftedSecondStroke = shifted
      .filter((packet) => packet.geometry.debugMeta?.strokeId === 'stroke:1')
      .map((packet) => ({
        intervalId: packet.geometry.debugMeta?.intervalId,
        bounds: packet.geometry.bounds
      }))

    expect(shiftedFirstStroke).not.toEqual(baselineFirstStroke)
    expect(shiftedSecondStroke).toEqual(baselineSecondStroke)
  })

  it('should run: a closed dash interval that covers the full loop keeps seam join continuity instead of open caps', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 }
    ]

    const dashedPackets = buildDashedCenterStrokeResolvedPackets(
      'closed-full-loop',
      points,
      true,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 4,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [400, 20],
          dashOffset: 0
        })
      ]
    )

    const solidPackets = buildSolidCenterStrokeResolvedPackets(
      'closed-solid-reference',
      points,
      true,
      [
        createDefaultStroke({
          style: 'solid',
          position: 'center',
          width: 4,
          joinType: StrokeJoinTypes.MITER
        })
      ]
    )

    expect(dashedPackets).toHaveLength(1)
    expect(solidPackets).toHaveLength(1)
    expect(dashedPackets[0]?.geometry.polygons).toEqual(
      solidPackets[0]?.geometry.polygons
    )
  })
})
