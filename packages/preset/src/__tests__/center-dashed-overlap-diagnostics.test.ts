import { describe, expect, it } from 'vitest'
import { createDefaultStroke } from '@asyra/utils'
import { buildDashedCenterStrokeResolvedPackets } from '../components/stroke-render/dashed-center-stroke-packets'
import { buildCenterDashedOverlapDiagnosticsFromResolvedPackets } from '../components/stroke-render/center-dashed-overlap-diagnostics'

describe('center dashed overlap diagnostics', () => {
  it('should run: real dashed-center packets produce deterministic ownership diagnostics on overlapping intervals', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'phase4a-diagnostics',
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
      ]
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
  })

  it('should run: forced component-local bailout preserves preview polygons on the real packet path', () => {
    const packets = buildDashedCenterStrokeResolvedPackets(
      'phase4a-diagnostics-bailout',
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
      ]
    )

    const diagnostics = buildCenterDashedOverlapDiagnosticsFromResolvedPackets(packets, {
      forceBailoutReason: 'owner-tie-unresolved'
    })

    expect(diagnostics.ownership.ownedRegions).toEqual([])
    expect(diagnostics.ownership.unresolvedBailouts.length).toBeGreaterThan(0)
    diagnostics.ownership.unresolvedBailouts.forEach((bailout) => {
      expect(bailout.reason).toBe('owner-tie-unresolved')
      expect(bailout.preservedPreviewPolygons.length).toBeGreaterThan(0)
    })
  })
})
