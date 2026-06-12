import type {
  StrokeDirtyKey,
  StrokeRevisionKey,
  StrokeRevisionSet
} from './stroke-dirty-keys'

export type StrokeRuntimeDiagnosticSupportState =
  | 'accepted'
  | 'blocked'
  | 'deferred'
  | 'not-applicable'

export interface StrokeRuntimeDiagnosticOwnerProvenance {
  primaryOwner?: string
  ownerSet: string[]
  ownershipStatus?: string
  ownerCount: number
}

export interface StrokeRuntimeDiagnosticLegalDomainProvenance {
  legalDomainIds: string[]
  sourceContourIds: string[]
  mode?: 'inside' | 'outside' | 'center'
  fillRule?: 'evenodd' | 'nonzero'
}

export interface StrokeRuntimeDiagnosticDirtyStageTrace {
  changedRevisionKeys: StrokeRevisionKey[]
  dirtyKeys: StrokeDirtyKey[]
  revisionSet?: Partial<StrokeRevisionSet>
}

export interface StrokeRuntimeDiagnosticBranch {
  branchId: string
  supportState: StrokeRuntimeDiagnosticSupportState
  blockedReason: string | null
  ownerProvenance: StrokeRuntimeDiagnosticOwnerProvenance
  legalDomainProvenance: StrokeRuntimeDiagnosticLegalDomainProvenance
  dirtyStageTrace: StrokeRuntimeDiagnosticDirtyStageTrace
  evidence: Record<string, unknown>
}

export interface BuildStrokeRuntimeDiagnosticBranchInput {
  branchId: string
  supportState: StrokeRuntimeDiagnosticSupportState
  blockedReason?: string | null
  ownerProvenance?: Partial<StrokeRuntimeDiagnosticOwnerProvenance>
  legalDomainProvenance?: Partial<StrokeRuntimeDiagnosticLegalDomainProvenance>
  dirtyStageTrace?: Partial<StrokeRuntimeDiagnosticDirtyStageTrace>
  evidence?: Record<string, unknown>
}

export const buildStrokeRuntimeDiagnosticBranch = ({
  branchId,
  supportState,
  blockedReason = null,
  ownerProvenance,
  legalDomainProvenance,
  dirtyStageTrace,
  evidence = {}
}: BuildStrokeRuntimeDiagnosticBranchInput): StrokeRuntimeDiagnosticBranch => {
  const ownerSet = ownerProvenance?.ownerSet ?? []

  return {
    branchId,
    supportState,
    blockedReason,
    ownerProvenance: {
      primaryOwner: ownerProvenance?.primaryOwner ?? ownerSet[0],
      ownerSet,
      ownershipStatus: ownerProvenance?.ownershipStatus,
      ownerCount: ownerProvenance?.ownerCount ?? ownerSet.length
    },
    legalDomainProvenance: {
      legalDomainIds: legalDomainProvenance?.legalDomainIds ?? [],
      sourceContourIds: legalDomainProvenance?.sourceContourIds ?? [],
      mode: legalDomainProvenance?.mode,
      fillRule: legalDomainProvenance?.fillRule
    },
    dirtyStageTrace: {
      changedRevisionKeys: dirtyStageTrace?.changedRevisionKeys ?? [],
      dirtyKeys: dirtyStageTrace?.dirtyKeys ?? [],
      revisionSet: dirtyStageTrace?.revisionSet
    },
    evidence
  }
}
