import type {
  ConstrainedDashedRuntimeStatusClassification,
  ConstrainedDashedSourceTopology
} from './constrained-dashed-stroke-packets'
import type { ConstrainedSolidOwnershipDiagnostics } from './constrained-solid-ownership-diagnostics'

export interface ConstrainedDashedRuntimeDiagnosticEntry
  extends ConstrainedDashedRuntimeStatusClassification {
  sourceId: string
  networkId?: string
  candidatePacketCount: number
}

export interface ConstrainedDashedRuntimeDiagnostics {
  entries: ConstrainedDashedRuntimeDiagnosticEntry[]
  acceptedCount: number
  blockedCount: number
  sourceTopologies: ConstrainedDashedSourceTopology[]
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
    sourceTopologies: [...new Set(entries.map((entry) => entry.sourceTopology))]
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
