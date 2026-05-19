import type {
  ConstrainedDashedRuntimeStatusClassification,
  ConstrainedDashedSourceTopology
} from './constrained-dashed-stroke-packets'
import type { ConstrainedSolidOwnershipDiagnostics } from './constrained-solid-ownership-diagnostics'
import {
  buildStrokeRuntimeDiagnosticBranch,
  type StrokeRuntimeDiagnosticBranch,
  type StrokeRuntimeDiagnosticDirtyStageTrace
} from './stroke-runtime-diagnostics'

export interface ConstrainedDashedRuntimeDiagnosticEntry
  extends ConstrainedDashedRuntimeStatusClassification {
  sourceId: string
  networkId?: string
  candidatePacketCount: number
  branchId?: string
  legalDomainIds?: string[]
  sourceContourIds?: string[]
  dirtyStageTrace?: Partial<StrokeRuntimeDiagnosticDirtyStageTrace>
}

export interface ConstrainedDashedRuntimeDiagnostics {
  entries: ConstrainedDashedRuntimeDiagnosticEntry[]
  acceptedCount: number
  blockedCount: number
  sourceTopologies: ConstrainedDashedSourceTopology[]
  branches: StrokeRuntimeDiagnosticBranch[]
  arrangementDiagnostics?: ConstrainedSolidOwnershipDiagnostics
}

export interface ConstrainedDashedRuntimeDiagnosticsRuntimeGraphic {
  __asyraConstrainedDashedRuntimeDiagnostics?: ConstrainedDashedRuntimeDiagnostics
}

export const buildConstrainedDashedRuntimeDiagnostics = (
  entries: ConstrainedDashedRuntimeDiagnosticEntry[],
  arrangementDiagnostics?:
    | ConstrainedSolidOwnershipDiagnostics
    | (() => ConstrainedSolidOwnershipDiagnostics)
): ConstrainedDashedRuntimeDiagnostics => {
  const diagnostics: ConstrainedDashedRuntimeDiagnostics = {
    entries,
    acceptedCount: entries.filter((entry) => entry.status === 'accepted')
      .length,
    blockedCount: entries.filter((entry) => entry.status === 'blocked').length,
    sourceTopologies: [
      ...new Set(entries.map((entry) => entry.sourceTopology))
    ],
    branches: entries.map((entry) =>
      buildStrokeRuntimeDiagnosticBranch({
        branchId:
          entry.branchId ??
          `product:constrained-dashed:${entry.sourceId}:${entry.networkId ?? 'all-networks'}`,
        supportState: entry.status,
        blockedReason: entry.status === 'blocked' ? entry.reason : null,
        ownerProvenance: {
          primaryOwner: entry.ownership.ownerKeys[0],
          ownerSet: entry.ownership.ownerKeys,
          ownershipStatus: entry.ownership.status,
          ownerCount: entry.ownership.ownerKeys.length
        },
        legalDomainProvenance: {
          legalDomainIds: entry.legalDomainIds ?? [],
          sourceContourIds: entry.sourceContourIds ?? []
        },
        dirtyStageTrace: entry.dirtyStageTrace,
        evidence: {
          sourceId: entry.sourceId,
          networkId: entry.networkId,
          sourceTopology: entry.sourceTopology,
          candidatePacketCount: entry.candidatePacketCount,
          branchKind: 'product'
        }
      })
    )
  }

  if (!arrangementDiagnostics) {
    return diagnostics
  }

  if (typeof arrangementDiagnostics !== 'function') {
    diagnostics.arrangementDiagnostics = arrangementDiagnostics
    return diagnostics
  }

  let cachedDiagnostics: ConstrainedSolidOwnershipDiagnostics | undefined
  Object.defineProperty(diagnostics, 'arrangementDiagnostics', {
    enumerable: false,
    configurable: true,
    get: () => {
      cachedDiagnostics ??= arrangementDiagnostics()
      return cachedDiagnostics
    }
  })

  return diagnostics
}

export const setConstrainedDashedRuntimeDiagnostics = <T extends object>(
  graphic: T,
  entries: ConstrainedDashedRuntimeDiagnosticEntry[],
  arrangementDiagnostics?:
    | ConstrainedSolidOwnershipDiagnostics
    | (() => ConstrainedSolidOwnershipDiagnostics)
) => {
  ;(
    graphic as T & ConstrainedDashedRuntimeDiagnosticsRuntimeGraphic
  ).__asyraConstrainedDashedRuntimeDiagnostics =
    buildConstrainedDashedRuntimeDiagnostics(entries, arrangementDiagnostics)
}

export const clearConstrainedDashedRuntimeDiagnostics = <T extends object>(
  graphic: T
) => {
  delete (graphic as T & ConstrainedDashedRuntimeDiagnosticsRuntimeGraphic)
    .__asyraConstrainedDashedRuntimeDiagnostics
}
