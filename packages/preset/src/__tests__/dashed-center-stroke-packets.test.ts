import { describe, expect, it } from 'vitest'
import { StrokeJoinTypes, createDefaultStroke } from '@asyra/utils'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildPathTopologyModel } from '../components/stroke-render/path-topology-model'
import {
  buildVectorGeometryModelPath,
  slicePathGeometryFrames
} from '../components/stroke-render/path-geometry'
import { buildSolidCenterStrokeResolvedPackets } from '../components/stroke-render/solid-center-stroke-packets'
import { buildStrokeFinalFacesFromResolvedPackets } from '../components/stroke-render/stroke-final-face'
import {
  DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
  createGeometryBackendCapabilities,
  registerGeometryBackend,
  selectGeometryBackend
} from '../components/stroke-render/geometry-backend'

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

    expect(packets).toHaveLength(4)
    expect(
      packets.map((packet) => ({
        minX: packet.geometry.bounds.minX,
        maxX: packet.geometry.bounds.maxX,
        dashPlacementMode: packet.geometry.debugMeta?.dashPlacementMode,
        intervalTerminalRole: packet.geometry.debugMeta?.intervalTerminalRole
      }))
    ).toEqual([
      {
        minX: 0,
        maxX: 10,
        dashPlacementMode: 'arc-length-pattern',
        intervalTerminalRole: 'path-start'
      },
      {
        minX: 20,
        maxX: 40,
        dashPlacementMode: 'arc-length-pattern',
        intervalTerminalRole: 'none'
      },
      {
        minX: 50,
        maxX: 70,
        dashPlacementMode: 'arc-length-pattern',
        intervalTerminalRole: 'none'
      },
      {
        minX: 80,
        maxX: 90,
        dashPlacementMode: 'arc-length-pattern',
        intervalTerminalRole: 'path-end'
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

  it('should run: allocate open dashed packets across segment boundaries at network level', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'open-polyline-network-dashed-center',
      [
        { x: 0, y: 0 },
        { x: 45, y: 0 },
        { x: 45, y: 45 }
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

    expect(
      packets.map((packet) => ({
        startDistance: packet.geometry.debugMeta?.startDistance,
        endDistance: packet.geometry.debugMeta?.endDistance,
        intervalTerminalRole: packet.geometry.debugMeta?.intervalTerminalRole
      }))
    ).toEqual([
      {
        startDistance: 0,
        endDistance: 10,
        intervalTerminalRole: 'path-start'
      },
      {
        startDistance: 20,
        endDistance: 40,
        intervalTerminalRole: 'none'
      },
      {
        startDistance: 50,
        endDistance: 70,
        intervalTerminalRole: 'none'
      },
      {
        startDistance: 80,
        endDistance: 90,
        intervalTerminalRole: 'path-end'
      }
    ])
  })

  it('should run: mark center dashed terminal eligibility without treating non-terminal overlap as stroke cutting', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'center-dashed-terminal-metadata',
      [
        { x: 0, y: 0 },
        { x: 50, y: 80 },
        { x: 100, y: 0 }
      ],
      false,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 12,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [60, 20],
          dashOffset: 0
        })
      ]
    )

    expect(packets.length).toBeGreaterThanOrEqual(2)
    expect(packets[0]?.geometry.debugMeta).toMatchObject({
      intervalId: 'interval:0',
      intervalTerminalRole: 'path-start',
      intervalStartCutKind: 'vertex',
      intervalEndCutKind: 'dash-boundary',
      strokeIntersectionEligible: true
    })

    const nonTerminalTurnPacket = packets.find(
      (packet) =>
        packet.geometry.debugMeta?.intervalTerminalRole === 'none' &&
        packet.geometry.polygons.length > 1
    )
    expect(nonTerminalTurnPacket).toBeDefined()
    expect(nonTerminalTurnPacket?.geometry.debugMeta).toMatchObject({
      intervalStartCutKind: 'dash-boundary',
      intervalEndCutKind: 'dash-boundary',
      strokeIntersectionEligible: false
    })
    expect(nonTerminalTurnPacket?.geometry.debugMeta?.intervalId).toBeDefined()
    const [face] = nonTerminalTurnPacket
      ? buildStrokeFinalFacesFromResolvedPackets([nonTerminalTurnPacket])
      : []
    expect(face?.intervalIds).toEqual([
      nonTerminalTurnPacket?.geometry.debugMeta?.intervalId
    ])
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
      resolutionStatus: 'center-product',
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

  it('should run: build source-path dashed center curves as single smooth interval outlines', () => {
    const sourcePath = buildVectorGeometryModelPath(
      {
        id: 'network-a',
        pointIds: ['a', 'b', 'c'],
        segmentIds: ['ab', 'bc'],
        closed: false
      },
      {
        a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'smooth' },
        aOut: {
          id: 'aOut',
          kind: 'control',
          x: 90,
          y: 180,
          controlRole: 'out'
        },
        b: { id: 'b', kind: 'anchor', x: 12, y: 210, anchorType: 'smooth' },
        bIn: {
          id: 'bIn',
          kind: 'control',
          x: -70,
          y: 140,
          controlRole: 'in'
        },
        bOut: {
          id: 'bOut',
          kind: 'control',
          x: 92,
          y: 268,
          controlRole: 'out'
        },
        c: { id: 'c', kind: 'anchor', x: 170, y: 330, anchorType: 'smooth' },
        cIn: {
          id: 'cIn',
          kind: 'control',
          x: 236,
          y: 284,
          controlRole: 'in'
        }
      },
      {
        ab: {
          id: 'ab',
          startId: 'a',
          endId: 'b',
          outControlId: 'aOut',
          inControlId: 'bIn'
        },
        bc: {
          id: 'bc',
          startId: 'b',
          endId: 'c',
          outControlId: 'bOut',
          inControlId: 'cIn'
        }
      }
    )
    const topology = buildPathTopologyModel({
      pathId: 'source-path-smooth-dashed',
      points: sourcePath.sampledPoints,
      closed: sourcePath.closed
    })

    const packets = buildDashedCenterStrokeResolvedPackets(
      'source-path-smooth-dashed',
      sourcePath.sampledPoints,
      sourcePath.closed,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 18,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [80, 30],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath
      }
    )

    expect(packets.length).toBeGreaterThan(2)
    packets.forEach((packet) => {
      expect(packet.geometry.polygons).toHaveLength(1)
      expect(packet.geometry.debugMeta?.intervalId).toBeDefined()
      expect([
        'simple-outline',
        'backend-offset',
        'fail-open-invalid-outline'
      ]).toContain(packet.geometry.debugMeta?.ribbonValidityStatus)
    })
    expect(
      Math.max(
        ...packets.map((packet) => packet.geometry.polygons[0]?.length ?? 0)
      )
    ).toBeLessThan(900)
  })

  it('should run: allocate source-path dashed intervals on the same arc-length domain used for slicing', () => {
    const sourcePath = buildVectorGeometryModelPath(
      {
        id: 'network-a',
        pointIds: ['a', 'b'],
        segmentIds: ['ab'],
        closed: false
      },
      {
        a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'smooth' },
        aOut: {
          id: 'aOut',
          kind: 'control',
          x: 30,
          y: 210,
          controlRole: 'out'
        },
        b: { id: 'b', kind: 'anchor', x: 180, y: 120, anchorType: 'smooth' },
        bIn: {
          id: 'bIn',
          kind: 'control',
          x: 150,
          y: -120,
          controlRole: 'in'
        }
      },
      {
        ab: {
          id: 'ab',
          startId: 'a',
          endId: 'b',
          outControlId: 'aOut',
          inControlId: 'bIn'
        }
      }
    )
    const sampledTopology = buildPathTopologyModel({
      pathId: 'source-path-domain-dashed',
      points: sourcePath.sampledPoints,
      closed: sourcePath.closed
    })
    const mismatchedTopology = {
      ...sampledTopology,
      totalLength: sourcePath.totalLength / 2
    }

    const packets = buildDashedCenterStrokeResolvedPackets(
      'source-path-domain-dashed',
      sourcePath.sampledPoints,
      sourcePath.closed,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 12,
          joinType: StrokeJoinTypes.MITER,
          dashPattern: [48, 24],
          dashOffset: 0
        })
      ],
      {
        topology: mismatchedTopology,
        sourcePath
      }
    )
    const pathEndPacket = packets.find(
      (packet) => packet.geometry.debugMeta?.intervalTerminalRole === 'path-end'
    )

    expect(sourcePath.totalLength).toBeGreaterThan(
      mismatchedTopology.totalLength + 1
    )
    expect(pathEndPacket?.geometry.debugMeta?.endDistance).toBeCloseTo(
      sourcePath.totalLength,
      4
    )
  })

  it('should run: build round-cap source-path dashed center curves through backend offset', async () => {
    const calls: { cap: string }[] = []
    const backendId = 'dashed-center-round-cap-offset-test-backend'
    registerGeometryBackend({
      backendId,
      load: () => ({
        backendId,
        backendVersion: 'test',
        capabilities: createGeometryBackendCapabilities(true),
        coordinatePolicy: DEFAULT_GEOMETRY_BACKEND_COORDINATE_POLICY,
        union: () => [],
        difference: () => [],
        intersection: () => [],
        offset: (path, _distance, options) => {
          calls.push({ cap: options.cap })
          const points = Array.isArray(path[0])
            ? (path[0] as { x: number; y: number }[])
            : (path as { x: number; y: number }[])
          const first = points[0] ?? { x: 0, y: 0 }
          const last = points[points.length - 1] ?? { x: 10, y: 0 }
          return [
            {
              polygons: [
                [
                  { x: first.x, y: first.y - 1 },
                  { x: last.x, y: last.y - 1 },
                  { x: last.x, y: last.y + 1 },
                  { x: first.x, y: first.y + 1 }
                ]
              ]
            }
          ]
        },
        buildArrangement: () => []
      })
    })
    selectGeometryBackend(backendId)

    const sourcePath = buildVectorGeometryModelPath(
      {
        id: 'network-a',
        pointIds: ['a', 'b', 'c'],
        segmentIds: ['ab', 'bc'],
        closed: false
      },
      {
        a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'smooth' },
        aOut: {
          id: 'aOut',
          kind: 'control',
          x: 90,
          y: 180,
          controlRole: 'out'
        },
        b: { id: 'b', kind: 'anchor', x: 12, y: 210, anchorType: 'smooth' },
        bIn: {
          id: 'bIn',
          kind: 'control',
          x: -70,
          y: 140,
          controlRole: 'in'
        },
        bOut: {
          id: 'bOut',
          kind: 'control',
          x: 92,
          y: 268,
          controlRole: 'out'
        },
        c: { id: 'c', kind: 'anchor', x: 170, y: 330, anchorType: 'smooth' },
        cIn: {
          id: 'cIn',
          kind: 'control',
          x: 236,
          y: 284,
          controlRole: 'in'
        }
      },
      {
        ab: {
          id: 'ab',
          startId: 'a',
          endId: 'b',
          outControlId: 'aOut',
          inControlId: 'bIn'
        },
        bc: {
          id: 'bc',
          startId: 'b',
          endId: 'c',
          outControlId: 'bOut',
          inControlId: 'cIn'
        }
      }
    )
    const topology = buildPathTopologyModel({
      pathId: 'source-path-round-cap-dashed',
      points: sourcePath.sampledPoints,
      closed: sourcePath.closed
    })
    const packets = buildDashedCenterStrokeResolvedPackets(
      'source-path-round-cap-dashed',
      sourcePath.sampledPoints,
      sourcePath.closed,
      [
        createDefaultStroke({
          style: 'dashed',
          position: 'center',
          width: 18,
          joinType: StrokeJoinTypes.MITER,
          capType: 'round',
          dashPattern: [80, 30],
          dashOffset: 0
        })
      ],
      {
        topology,
        sourcePath
      }
    )

    expect(packets.length).toBeGreaterThan(2)
    expect(
      packets.map((packet) => ({
        terminalRole: packet.geometry.debugMeta?.intervalTerminalRole,
        ribbonValidityStatus: packet.geometry.debugMeta?.ribbonValidityStatus
      }))
    ).toEqual(
      packets.map((packet) => {
        const terminalRole = packet.geometry.debugMeta?.intervalTerminalRole
        return {
          terminalRole,
          ribbonValidityStatus:
            terminalRole === 'path-start' || terminalRole === 'path-end'
              ? 'simple-outline'
              : 'backend-offset'
        }
      })
    )
    expect(calls.every((call) => call.cap === 'round')).toBe(true)
  })

  it('should run: only authored sharp anchors mark source-path ribbon joins as sharp', () => {
    const buildPath = (middleAnchorType: 'smooth' | 'sharp') =>
      buildVectorGeometryModelPath(
        {
          id: 'network-a',
          pointIds: ['a', 'b', 'c'],
          segmentIds: ['ab', 'bc'],
          closed: false
        },
        {
          a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'smooth' },
          aOut: {
            id: 'aOut',
            kind: 'control',
            x: 40,
            y: 80,
            controlRole: 'out'
          },
          b: {
            id: 'b',
            kind: 'anchor',
            x: 80,
            y: 100,
            anchorType: middleAnchorType
          },
          bIn: {
            id: 'bIn',
            kind: 'control',
            x: 30,
            y: 80,
            controlRole: 'in'
          },
          c: { id: 'c', kind: 'anchor', x: 160, y: 100, anchorType: 'sharp' }
        },
        {
          ab: {
            id: 'ab',
            startId: 'a',
            endId: 'b',
            outControlId: 'aOut',
            inControlId: 'bIn'
          },
          bc: {
            id: 'bc',
            startId: 'b',
            endId: 'c',
            outControlId: null,
            inControlId: null
          }
        }
      )

    const smoothPath = buildPath('smooth')
    const sharpPath = buildPath('sharp')
    const smoothFrames = slicePathGeometryFrames(
      smoothPath,
      0,
      smoothPath.totalLength,
      false
    )
    const sharpFrames = slicePathGeometryFrames(
      sharpPath,
      0,
      sharpPath.totalLength,
      false
    )
    const smoothJoinFrame = smoothFrames.find(
      (frame) => frame.point.x === 80 && frame.point.y === 100
    )
    const sharpJoinFrame = sharpFrames.find(
      (frame) => frame.point.x === 80 && frame.point.y === 100
    )

    expect(smoothJoinFrame?.sharpJoin).not.toBe(true)
    expect(sharpJoinFrame?.sharpJoin).toBe(true)
  })

  it('should not run: emit any packets for non-product dashed slices', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'non-product',
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
