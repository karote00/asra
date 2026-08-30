export type AtlasRunStatus =
  'ready' | 'running' | 'succeeded' | 'rejected' | 'failed'

export interface AtlasEvidence {
  readonly caseId: string
  readonly runId: string
  readonly sequence: number
  readonly actionId: string
  readonly label: string
  readonly owner: string
  readonly description: string
  readonly lifecycleStatus: string
  readonly output: unknown
  readonly failure?: string
}

export interface AtlasRunSnapshot {
  readonly caseId: string
  readonly runId: string
  readonly sequence: number
  readonly status: AtlasRunStatus
  readonly actionIndex: number
  readonly actionCount: number
  readonly evidence: readonly AtlasEvidence[]
  readonly result: Record<string, unknown>
}

export interface AtlasRunHandle {
  readonly definition: unknown
  readonly runId: string
  sequence: number
  actionIndex: number
  status: AtlasRunStatus
  readonly evidence: AtlasEvidence[]
  readonly runtime: unknown
}

export function createAtlasRun(caseId: string): Promise<AtlasRunHandle>
export function getAtlasRunSnapshot(run: AtlasRunHandle): AtlasRunSnapshot
export function advanceAtlasRun(run: AtlasRunHandle): Promise<AtlasRunSnapshot>
export function disposeAtlasRun(run: AtlasRunHandle): Promise<void>
export function runCaseToCompletion(caseId: string): Promise<AtlasRunSnapshot>
