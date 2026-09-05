import type { ExperimentSnapshot } from '../analysis/contracts'
import { validateHistoricalSnapshot } from '../analysis/snapshot'
import {
  validateHistoricalResult,
  type AnalysisResult
} from '../analysis/result'
import { hasExactOwnKeys } from '../domain/records'
import {
  validCandidateLineage,
  type CandidateLineage
} from '../common-apis/candidate-lineage'

export interface RunRecord {
  version: 1
  name: string
  retainedAt: string
  environment: {
    appVersion: string
    userAgent: string
    hardwareConcurrency: number
  }
  snapshot: ExperimentSnapshot
  result: AnalysisResult
  lineage?: CandidateLineage
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]])
    )
  })
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export function validateRunRecord(input: unknown): RunRecord {
  const hasLineage =
    !!input && typeof input === 'object' && Object.hasOwn(input, 'lineage')
  if (
    !hasExactOwnKeys(input, [
      'version',
      'name',
      'retainedAt',
      'environment',
      'snapshot',
      'result',
      ...(hasLineage ? ['lineage'] : [])
    ]) ||
    input.version !== 1 ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 200 ||
    typeof input.retainedAt !== 'string' ||
    input.retainedAt.length > 40 ||
    !Number.isFinite(Date.parse(input.retainedAt)) ||
    !hasExactOwnKeys(input.environment, [
      'appVersion',
      'userAgent',
      'hardwareConcurrency'
    ]) ||
    typeof input.environment.appVersion !== 'string' ||
    input.environment.appVersion.length > 100 ||
    typeof input.environment.userAgent !== 'string' ||
    input.environment.userAgent.length > 1000 ||
    typeof input.environment.hardwareConcurrency !== 'number' ||
    !Number.isInteger(input.environment.hardwareConcurrency) ||
    input.environment.hardwareConcurrency < 1 ||
    input.environment.hardwareConcurrency > 1024
  )
    throw new Error('Invalid retained run metadata')
  const snapshot = validateHistoricalSnapshot(input.snapshot)
  const result = validateHistoricalResult(snapshot, input.result)
  if (
    hasLineage &&
    (!validCandidateLineage(input.lineage) ||
      !hasExactOwnKeys(
        input.lineage.bodyOrigins,
        snapshot.workcell.bodies.map((body) => body.id)
      ))
  )
    throw new Error('Invalid or incomplete retained candidate lineage')
  return freeze({
    version: 1,
    name: input.name,
    retainedAt: input.retainedAt,
    environment: { ...input.environment } as RunRecord['environment'],
    snapshot,
    result,
    ...(hasLineage
      ? { lineage: structuredClone(input.lineage) as CandidateLineage }
      : {})
  })
}

export function validateRunRecords(input: unknown): readonly RunRecord[] {
  if (!Array.isArray(input) || input.length > 1000)
    throw new Error('Invalid retained run collection (maximum 1000)')
  const records = input.map(validateRunRecord)
  if (new Set(records.map((run) => run.result.runId)).size !== records.length)
    throw new Error('Duplicate retained run identity')
  return Object.freeze(records)
}

/** Immutable blob ownership; canonical references and durable saving are separate. */
export class RunArchive {
  private readonly records = new Map<string, RunRecord>()
  constructor(
    input: readonly RunRecord[] = [],
    private readonly validateSources: (record: RunRecord) => void = () =>
      undefined
  ) {
    for (const record of validateRunRecords(input)) {
      validateSources(record)
      this.records.set(record.result.runId, record)
    }
  }
  add(input: unknown): RunRecord {
    const run = validateRunRecord(input),
      previous = this.records.get(run.result.runId)
    if (previous) {
      if (stableJson(previous) !== stableJson(run))
        throw new Error('Run identity already has different immutable content')
      return previous
    }
    if (this.records.size >= 1000) throw new Error('Retained run limit reached')
    this.validateSources(run)
    this.records.set(run.result.runId, run)
    return run
  }
  get(runId: string): RunRecord | undefined {
    return this.records.get(runId)
  }
  list(): readonly RunRecord[] {
    return Object.freeze([...this.records.values()])
  }
}
