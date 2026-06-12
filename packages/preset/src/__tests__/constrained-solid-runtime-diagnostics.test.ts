import { describe, expect, it } from 'vitest'
import {
  buildConstrainedSolidRuntimeDiagnostics,
  setConstrainedSolidRuntimeDiagnostics
} from '../components/stroke-render/constrained-solid-runtime-diagnostics'

const entry = {
  sourceId: 'vector:solid:network-0',
  networkId: 'network-0',
  status: 'blocked' as const,
  reason: 'missing-domain-plan' as const,
  candidatePacketCount: 0,
  topologyFamily: 'self-intersecting' as const,
  closed: true,
  ownerSet: ['vector:solid:network-0:stroke:0'],
  primaryOwner: 'vector:solid:network-0:stroke:0',
  ownershipStatus: 'blocked',
  legalDomainIds: ['legal:network-0:shell'],
  sourceContourIds: ['contour:network-0:shell'],
  dirtyStageTrace: {
    changedRevisionKeys: ['legalityRevision' as const],
    dirtyKeys: ['legality' as const, 'resolved-regions' as const]
  }
}

describe('constrained solid runtime diagnostics', () => {
  it('should run: publish product branch identity, blocked reason, provenance, and dirty-stage trace', () => {
    const diagnostics = buildConstrainedSolidRuntimeDiagnostics([entry])

    expect(diagnostics).toMatchObject({
      acceptedCount: 0,
      blockedCount: 1,
      topologyFamilies: ['self-intersecting']
    })
    expect(diagnostics.branches).toEqual([
      {
        branchId: 'product:constrained-solid:vector:solid:network-0:network-0',
        supportState: 'blocked',
        blockedReason: 'missing-domain-plan',
        ownerProvenance: {
          primaryOwner: 'vector:solid:network-0:stroke:0',
          ownerSet: ['vector:solid:network-0:stroke:0'],
          ownershipStatus: 'blocked',
          ownerCount: 1
        },
        legalDomainProvenance: {
          legalDomainIds: ['legal:network-0:shell'],
          sourceContourIds: ['contour:network-0:shell'],
          mode: undefined,
          fillRule: undefined
        },
        dirtyStageTrace: {
          changedRevisionKeys: ['legalityRevision'],
          dirtyKeys: ['legality', 'resolved-regions'],
          revisionSet: undefined
        },
        evidence: {
          sourceId: 'vector:solid:network-0',
          networkId: 'network-0',
          topologyFamily: 'self-intersecting',
          closed: true,
          candidatePacketCount: 0,
          branchKind: 'product'
        }
      }
    ])
  })

  it('should run: attach the same branch shape to runtime graphics', () => {
    const graphic = {}

    setConstrainedSolidRuntimeDiagnostics(graphic, [entry])

    expect(
      (
        graphic as {
          __asyraConstrainedSolidRuntimeDiagnostics?: ReturnType<
            typeof buildConstrainedSolidRuntimeDiagnostics
          >
        }
      ).__asyraConstrainedSolidRuntimeDiagnostics?.branches[0]?.branchId
    ).toBe('product:constrained-solid:vector:solid:network-0:network-0')
  })
})
