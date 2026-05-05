import { describe, expect, it } from 'vitest'
import {
  buildConstrainedDashedRuntimeDiagnostics,
  setConstrainedDashedRuntimeDiagnostics
} from '../components/stroke-render/constrained-dashed-runtime-diagnostics'

const entry = {
  sourceId: 'vector:test:network-0',
  networkId: 'network-0',
  candidatePacketCount: 1,
  status: 'accepted' as const,
  reason: 'single-owner' as const,
  sourceTopology: 'rectangle-equivalent' as const,
  ownership: {
    status: 'accepted' as const,
    reason: 'single-owner' as const,
    ownerKeys: ['vector:test:network-0:stroke:0'],
    packetCount: 1
  }
}

describe('constrained dashed runtime diagnostics', () => {
  it('should run: defer arrangement diagnostics until explicitly read', () => {
    let buildCount = 0
    const diagnostics = buildConstrainedDashedRuntimeDiagnostics(
      [entry],
      () => {
        buildCount += 1
        return {
          arrangementPolicy: {
            strategy: 'bounded-convex-subset-arrangement',
            epsilon: 0.000001,
            roundingFactor: 1000,
            maxExactSubsetCount: 4096,
            zeroAreaThreshold: 0.000001,
            tangentialTouchPolicy: 'boundary-overlap-without-zero-area-face',
            coincidentEdgePolicy: 'dedupe-rotated-polygon-signatures'
          },
          candidates: [],
          edges: [],
          components: [],
          arrangementFaces: [],
          ownedRegions: []
        }
      }
    )

    expect(diagnostics.acceptedCount).toBe(1)
    expect(buildCount).toBe(0)
    expect(Object.keys(diagnostics)).not.toContain('arrangementDiagnostics')
    expect(diagnostics.arrangementDiagnostics?.candidates).toEqual([])
    expect(diagnostics.arrangementDiagnostics?.ownedRegions).toEqual([])
    expect(buildCount).toBe(1)
  })

  it('should run: attach lazy arrangement diagnostics without computing during render diagnostics assignment', () => {
    let buildCount = 0
    const graphic = {}

    setConstrainedDashedRuntimeDiagnostics(graphic, [entry], () => {
      buildCount += 1
      return {
        arrangementPolicy: {
          strategy: 'bounded-convex-subset-arrangement',
          epsilon: 0.000001,
          roundingFactor: 1000,
          maxExactSubsetCount: 4096,
          zeroAreaThreshold: 0.000001,
          tangentialTouchPolicy: 'boundary-overlap-without-zero-area-face',
          coincidentEdgePolicy: 'dedupe-rotated-polygon-signatures'
        },
        candidates: [],
        edges: [],
        components: [],
        arrangementFaces: [],
        ownedRegions: []
      }
    })

    expect(buildCount).toBe(0)
    expect(
      (
        graphic as {
          __asyraConstrainedDashedRuntimeDiagnostics?: {
            arrangementDiagnostics?: { candidates: unknown[] }
          }
        }
      ).__asyraConstrainedDashedRuntimeDiagnostics?.arrangementDiagnostics
        ?.candidates
    ).toEqual([])
    expect(buildCount).toBe(1)
  })
})
