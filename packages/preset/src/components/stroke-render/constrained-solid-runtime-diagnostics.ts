import type { PathTopologyModel } from './path-topology-model'
import {
  buildStrokeRuntimeDiagnosticBranch,
  type StrokeRuntimeDiagnosticBranch,
  type StrokeRuntimeDiagnosticDirtyStageTrace
} from './stroke-runtime-diagnostics'

export type ConstrainedSolidRuntimeStatus = 'accepted' | 'blocked'

export type ConstrainedSolidRuntimeReason =
  | 'accepted'
  | 'degenerate-topology'
  | 'unsupported-overlap-ownership'
  | 'unsupported-topology'
  | 'no-candidate-packets'

export interface ConstrainedSolidRuntimeDiagnosticEntry {
  sourceId: string
  networkId?: string
  status: ConstrainedSolidRuntimeStatus
  reason: ConstrainedSolidRuntimeReason
  candidatePacketCount: number
  topologyFamily: PathTopologyModel['topologyFamily']
  closed: boolean
  branchId?: string
  ownerSet?: string[]
  primaryOwner?: string
  ownershipStatus?: string
  legalDomainIds?: string[]
  sourceContourIds?: string[]
  dirtyStageTrace?: Partial<StrokeRuntimeDiagnosticDirtyStageTrace>
}

export interface ConstrainedSolidRuntimeDiagnostics {
  entries: ConstrainedSolidRuntimeDiagnosticEntry[]
  acceptedCount: number
  blockedCount: number
  topologyFamilies: PathTopologyModel['topologyFamily'][]
  branches: StrokeRuntimeDiagnosticBranch[]
}

export interface ConstrainedSolidRuntimeDiagnosticsGraphic {
  __asyraConstrainedSolidRuntimeDiagnostics?: ConstrainedSolidRuntimeDiagnostics
}

export const buildConstrainedSolidRuntimeDiagnostics = (
  entries: ConstrainedSolidRuntimeDiagnosticEntry[]
): ConstrainedSolidRuntimeDiagnostics => ({
  entries,
  acceptedCount: entries.filter((entry) => entry.status === 'accepted').length,
  blockedCount: entries.filter((entry) => entry.status === 'blocked').length,
  topologyFamilies: [...new Set(entries.map((entry) => entry.topologyFamily))],
  branches: entries.map((entry) =>
    buildStrokeRuntimeDiagnosticBranch({
      branchId:
        entry.branchId ??
        `product:constrained-solid:${entry.sourceId}:${entry.networkId ?? 'all-networks'}`,
      supportState: entry.status,
      blockedReason: entry.status === 'blocked' ? entry.reason : null,
      ownerProvenance: {
        primaryOwner: entry.primaryOwner,
        ownerSet: entry.ownerSet ?? [],
        ownershipStatus: entry.ownershipStatus,
        ownerCount: entry.ownerSet?.length ?? 0
      },
      legalDomainProvenance: {
        legalDomainIds: entry.legalDomainIds ?? [],
        sourceContourIds: entry.sourceContourIds ?? []
      },
      dirtyStageTrace: entry.dirtyStageTrace,
      evidence: {
        sourceId: entry.sourceId,
        networkId: entry.networkId,
        topologyFamily: entry.topologyFamily,
        closed: entry.closed,
        candidatePacketCount: entry.candidatePacketCount,
        branchKind: 'product'
      }
    })
  )
})

export const setConstrainedSolidRuntimeDiagnostics = <T extends object>(
  graphic: T,
  entries: ConstrainedSolidRuntimeDiagnosticEntry[]
) => {
  ;(
    graphic as T & ConstrainedSolidRuntimeDiagnosticsGraphic
  ).__asyraConstrainedSolidRuntimeDiagnostics =
    buildConstrainedSolidRuntimeDiagnostics(entries)
}

export const clearConstrainedSolidRuntimeDiagnostics = <T extends object>(
  graphic: T
) => {
  delete (graphic as T & ConstrainedSolidRuntimeDiagnosticsGraphic)
    .__asyraConstrainedSolidRuntimeDiagnostics
}
