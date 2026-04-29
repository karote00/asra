import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import { buildConstrainedSolidLegalityDiagnostics } from '../components/stroke-render/constrained-solid-legality-diagnostics'
import { buildConstrainedSolidStrokeResolvedPackets } from '../components/stroke-render/constrained-solid-stroke-packets'

describe('constrained solid legality diagnostics', () => {
  it('should run: supported closed constrained packets produce canonical legality diagnostics without rewriting packet identity', () => {
    const packets = buildConstrainedSolidStrokeResolvedPackets(
      'constrained-solid-legality',
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      true,
      [
        createDefaultStroke({
          visible: true,
          style: 'solid',
          position: 'inside',
          width: 6,
          color: '#00ff00',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96
        })
      ]
    )

    const diagnostics = buildConstrainedSolidLegalityDiagnostics(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 40 },
            { x: 0, y: 40 }
          ],
          closed: true
        }
      ],
      [
        createDefaultStroke({
          visible: true,
          style: 'solid',
          position: 'inside',
          width: 6,
          color: '#00ff00',
          opacity: 1,
          joinType: 'miter',
          capType: 'butt',
          miterAngle: 28.96
        })
      ],
      packets
    )

    expect(diagnostics.domains).toHaveLength(1)
    expect(diagnostics.domains[0]).toMatchObject({
      strokeId: 'stroke:0',
      mode: 'inside',
      canonicalPolygonForm: 'simple-closed-polygon',
      fillRule: 'nonzero',
      geometryId: packets[0]?.geometry.geometryId
    })
    expect(diagnostics.acceptedGeometryIds).toEqual(
      packets.map((packet) => packet.geometry.geometryId)
    )
    expect(packets[0]?.geometry.polygons).toEqual(
      buildConstrainedSolidStrokeResolvedPackets(
        'constrained-solid-legality',
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 }
        ],
        true,
        [
          createDefaultStroke({
            visible: true,
            style: 'solid',
            position: 'inside',
            width: 6,
            color: '#00ff00',
            opacity: 1,
            joinType: 'miter',
            capType: 'butt',
            miterAngle: 28.96
          })
        ]
      )[0]?.geometry.polygons
    )
  })
})
