import type { AtlasCaseDefinition } from './case-definitions.mjs'

export type AtlasEvidenceStatus = 'completed' | 'rejected' | 'failed'

export interface AtlasEvidenceEntry {
  readonly actionId: string
  readonly bypasses: readonly string[]
  readonly caseId: string
  readonly conditions: readonly string[]
  readonly failure?: { readonly message: string; readonly name: string }
  readonly input: Readonly<Record<string, unknown>>
  readonly label: string
  readonly output?: unknown
  readonly owner: string
  readonly runId: string
  readonly sequence: number
  readonly status: AtlasEvidenceStatus
}

export interface AtlasRuntimeSnapshot {
  readonly actionIndex: number
  readonly caseId: string
  readonly complete: boolean
  readonly definition: AtlasCaseDefinition
  readonly disposed: boolean
  readonly evidence: readonly AtlasEvidenceEntry[]
  readonly runId: string
  readonly sequence: number
  readonly terminal: boolean
}

export interface AtlasCaseExecutor {
  advance(
    actionId: string,
    input: Readonly<Record<string, unknown>>
  ):
    | Promise<{ status?: AtlasEvidenceStatus; output?: unknown }>
    | {
        status?: AtlasEvidenceStatus
        output?: unknown
      }
  dispose?(): Promise<void> | void
}

export class AtlasRuntimeUnavailableError extends Error {}

export function createAtlasRuntimeHarness(options: {
  caseId: string
  createExecutor(definition: AtlasCaseDefinition): AtlasCaseExecutor
}): {
  advance(): Promise<AtlasRuntimeSnapshot>
  dispose(): Promise<void>
  snapshot(): AtlasRuntimeSnapshot
}

export function createAtlasCaseExecutor(
  definition: AtlasCaseDefinition
): AtlasCaseExecutor

export function createAtlasRuntime(
  caseId: string
): ReturnType<typeof createAtlasRuntimeHarness>
