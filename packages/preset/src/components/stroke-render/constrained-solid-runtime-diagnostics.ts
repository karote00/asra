import type { PathTopologyModel } from './path-topology-model'

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
}

export interface ConstrainedSolidRuntimeDiagnostics {
  entries: ConstrainedSolidRuntimeDiagnosticEntry[]
  acceptedCount: number
  blockedCount: number
  topologyFamilies: PathTopologyModel['topologyFamily'][]
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
  topologyFamilies: [...new Set(entries.map((entry) => entry.topologyFamily))]
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
  delete (
    graphic as T & ConstrainedSolidRuntimeDiagnosticsGraphic
  ).__asyraConstrainedSolidRuntimeDiagnostics
}
