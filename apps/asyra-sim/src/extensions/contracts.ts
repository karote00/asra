import type {
  ExperimentSnapshot,
  MethodDescriptor
} from '../analysis/contracts'
import type { PairEvidence } from '../analysis/methods/continuous-query'

export const METHOD_CATALOG_LIMITS = Object.freeze({
  methods: 32,
  parameters: 32,
  text: 2000,
  scalarText: 200
})

export type MethodParameter =
  | {
      kind: 'number'
      label: string
      unit: string
      min: number
      max: number
      default: number
    }
  | { kind: 'boolean'; label: string; default: boolean }
  | { kind: 'enum'; label: string; values: readonly string[]; default: string }

export type MethodParameterSchema = Readonly<Record<string, MethodParameter>>

export interface MethodManifest {
  contractVersion: 1
  name: string
  origin: 'official' | 'example' | 'private'
  author: string
  source: string
  license: string
  purpose: string
  units: 'm-rad-s'
  coordinates: 'right-handed-z-up'
  applicability: string
  numericalSemantics: string
  controls: string
  reproducibility: string
  resources: string
  services: {
    network: boolean
    additionalFiles: boolean
    commercialRuntime: boolean
  }
  validation: {
    status: 'unverified' | 'conformance-tested' | 'numerically-validated'
    evidence: string
  }
}

export interface InstalledMethodDescriptor extends MethodDescriptor {
  manifest: MethodManifest
  parameterSchema: MethodParameterSchema
}

/** Geometry evidence contract v1; these are bounds, not a physical safety verdict. */
export interface MethodPairEvidence {
  pairId: string
  evidence: PairEvidence
}

export interface MethodEvidence {
  version: 1
  snapshotId: string
  method: { id: string; version: string }
  coverage: 'complete' | 'partial'
  evaluations: number
  pairs: readonly MethodPairEvidence[]
}

export interface MethodContext {
  readonly signal: AbortSignal
  checkpoint: () => void
  emitPair: (pair: MethodPairEvidence) => void
}

export interface MethodRegistration {
  descriptor: InstalledMethodDescriptor
  execute: (
    snapshot: ExperimentSnapshot,
    context: MethodContext
  ) => MethodEvidence | Promise<MethodEvidence>
}
