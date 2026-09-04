import { validIdentifier } from '../domain/workcell'
import { hasExactOwnKeys } from '../domain/records'
import type { ExperimentSnapshot } from './contracts'
import type {
  OfficialMethodEvidence,
  OfficialPairEvidence
} from './methods/official-method'

export type AnalysisExecution =
  'completed' | 'cancelled' | 'timed-out' | 'failed'
export type AnalysisCoverage = 'complete' | 'partial'
export type AnalysisVerdict = 'meets' | 'does-not-meet' | 'cannot-determine'
export type AnalysisSummary =
  'issue-found' | 'no-issue-within-scope' | 'cannot-determine'

export interface AnalysisResult {
  version: 1
  runId: string
  snapshotId: string
  source: ExperimentSnapshot['source']
  method: ExperimentSnapshot['method']
  rule: ExperimentSnapshot['rule']
  startedAt: number
  endedAt: number
  execution: AnalysisExecution
  coverage: AnalysisCoverage
  verdict: AnalysisVerdict
  summary: AnalysisSummary
  pairEvidence: readonly OfficialPairEvidence[]
  totalPairCount: number
  coveredPairCount: number
  findingPairCount: number
  unresolvedPairCount: number
  errors: readonly string[]
}

export interface RunTiming {
  runId: string
  startedAt: number
  endedAt: number
}

export interface TerminalRun extends RunTiming {
  execution: Exclude<AnalysisExecution, 'completed'>
  error: string
}

const finiteNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function validateTiming(timing: RunTiming): void {
  if (
    !validIdentifier(timing.runId) ||
    !finiteNonnegative(timing.startedAt) ||
    !finiteNonnegative(timing.endedAt) ||
    timing.endedAt < timing.startedAt
  )
    throw new Error('Invalid analysis timing or run identity')
}

function deepFreeze<T>(input: T, seen = new WeakSet<object>()): T {
  if (!input || typeof input !== 'object' || seen.has(input)) return input
  seen.add(input)
  for (const value of Object.values(input)) deepFreeze(value, seen)
  return Object.freeze(input)
}

export function validatePairProgress(
  snapshot: ExperimentSnapshot,
  pair: OfficialPairEvidence
): OfficialPairEvidence {
  const expected = snapshot.pairs.find((item) => item.id === pair?.pairId),
    evidence = pair?.evidence
  if (
    !expected ||
    !hasExactOwnKeys(pair, ['pairId', 'evidence']) ||
    !hasExactOwnKeys(evidence, [
      'leaves',
      'lower',
      'upper',
      'coverage',
      'evaluations'
    ]) ||
    !Array.isArray(evidence.leaves)
  )
    throw new Error('Invalid analysis pair identity')
  if (
    !Number.isInteger(evidence.evaluations) ||
    evidence.evaluations < 0 ||
    evidence.evaluations > snapshot.budget.maxIntervals ||
    !finiteNonnegative(evidence.lower) ||
    !['complete', 'partial'].includes(evidence.coverage) ||
    evidence.leaves.length < 1 ||
    evidence.leaves.length > 200000
  )
    throw new Error('Invalid analysis pair evidence')
  let cursor = snapshot.interval[0],
    unresolved = false
  for (const leaf of evidence.leaves) {
    if (
      !hasExactOwnKeys(leaf, [
        'start',
        'end',
        'lower',
        'upper',
        'witnessTime',
        'penetration',
        'state',
        'reason'
      ]) ||
      !finiteNonnegative(leaf.start) ||
      !finiteNonnegative(leaf.end) ||
      leaf.start !== cursor ||
      leaf.end < leaf.start ||
      leaf.end > snapshot.interval[1] ||
      !finiteNonnegative(leaf.lower) ||
      (leaf.upper !== null && !finiteNonnegative(leaf.upper)) ||
      (leaf.upper !== null && leaf.lower > leaf.upper) ||
      (leaf.witnessTime !== null &&
        (!finiteNonnegative(leaf.witnessTime) ||
          leaf.witnessTime < leaf.start ||
          leaf.witnessTime > leaf.end)) ||
      typeof leaf.penetration !== 'boolean' ||
      typeof leaf.state !== 'string' ||
      !['clear', 'finding', 'unresolved'].includes(leaf.state) ||
      typeof leaf.reason !== 'string' ||
      !leaf.reason ||
      leaf.reason.length > 4000
    )
      throw new Error('Invalid analysis interval bound or coverage')
    if (
      leaf.state === 'finding' &&
      !leaf.penetration &&
      !(leaf.upper !== null && leaf.upper < snapshot.rule.minimumClearance)
    )
      throw new Error('Finding is not supported by method evidence')
    if (
      leaf.penetration &&
      (leaf.state !== 'finding' || leaf.lower !== 0 || leaf.upper !== 0)
    )
      throw new Error('Penetration is not supported by consistent zero bounds')
    if (
      leaf.state === 'clear' &&
      !(leaf.lower > snapshot.rule.minimumClearance)
    )
      throw new Error('Clear state is not supported by method bounds')
    if (leaf.state === 'unresolved') unresolved = true
    cursor = leaf.end
  }
  if (cursor !== snapshot.interval[1])
    throw new Error('Incomplete analysis interval coverage')
  const expectedCoverage = unresolved ? 'partial' : 'complete',
    expectedLower = evidence.leaves.reduce(
      (minimum, leaf) => Math.min(minimum, leaf.lower),
      Infinity
    ),
    finiteUppers = evidence.leaves
      .map((leaf) => leaf.upper)
      .filter((value): value is number => value !== null),
    expectedUpper = finiteUppers.length
      ? finiteUppers.reduce(
          (minimum, value) => Math.min(minimum, value),
          Infinity
        )
      : null
  if (
    evidence.coverage !== expectedCoverage ||
    evidence.lower !== expectedLower ||
    evidence.upper !== expectedUpper
  )
    throw new Error('Invalid aggregate analysis bounds or coverage')
  return deepFreeze(structuredClone(pair))
}

function summarize(
  snapshot: ExperimentSnapshot,
  evidence: readonly OfficialPairEvidence[],
  execution: AnalysisExecution,
  coverage: AnalysisCoverage,
  timing: RunTiming,
  errors: readonly string[]
): AnalysisResult {
  validateTiming(timing)
  const pairs = evidence.map((pair) => validatePairProgress(snapshot, pair)),
    findingPairCount = pairs.filter((pair) =>
      pair.evidence.leaves.some((leaf) => leaf.state === 'finding')
    ).length,
    unresolvedPairCount = pairs.filter(
      (pair) => pair.evidence.coverage === 'partial'
    ).length
  if (
    pairs.reduce((sum, pair) => sum + pair.evidence.evaluations, 0) >
      snapshot.budget.maxIntervals ||
    pairs.reduce((sum, pair) => sum + pair.evidence.leaves.length, 0) > 200000
  )
    throw new Error('Analysis evidence exceeds its global budget')
  let summary: AnalysisSummary = 'cannot-determine'
  if (findingPairCount) summary = 'issue-found'
  else if (execution === 'completed' && coverage === 'complete')
    summary = 'no-issue-within-scope'
  let verdict: AnalysisVerdict = 'cannot-determine'
  if (summary === 'issue-found') verdict = 'does-not-meet'
  else if (summary === 'no-issue-within-scope') verdict = 'meets'
  return deepFreeze({
    version: 1,
    runId: timing.runId,
    snapshotId: snapshot.snapshotId,
    source: structuredClone(snapshot.source),
    method: structuredClone(snapshot.method),
    rule: structuredClone(snapshot.rule),
    startedAt: timing.startedAt,
    endedAt: timing.endedAt,
    execution,
    coverage,
    verdict,
    summary,
    pairEvidence: pairs,
    totalPairCount: snapshot.pairs.length,
    coveredPairCount: pairs.length,
    findingPairCount,
    unresolvedPairCount,
    errors: [...errors]
  })
}

export function completeAnalysisResult(
  snapshot: ExperimentSnapshot,
  evidence: OfficialMethodEvidence,
  timing: RunTiming
): AnalysisResult {
  if (
    evidence.version !== 1 ||
    evidence.snapshotId !== snapshot.snapshotId ||
    evidence.method.id !== snapshot.method.id ||
    evidence.method.version !== snapshot.method.version
  )
    throw new Error(
      'Method evidence source identity does not match the snapshot'
    )
  if (
    evidence.pairs.length !== snapshot.pairs.length ||
    new Set(evidence.pairs.map((pair) => pair.pairId)).size !==
      snapshot.pairs.length ||
    snapshot.pairs.some(
      (expected) => !evidence.pairs.some((pair) => pair.pairId === expected.id)
    )
  )
    throw new Error('Method evidence does not provide complete pair coverage')
  const pairs = evidence.pairs.map((pair) =>
      validatePairProgress(snapshot, pair)
    ),
    evaluations = pairs.reduce(
      (sum, pair) => sum + pair.evidence.evaluations,
      0
    ),
    coverage = pairs.some((pair) => pair.evidence.coverage === 'partial')
      ? 'partial'
      : 'complete'
  if (evidence.evaluations !== evaluations || evidence.coverage !== coverage)
    throw new Error('Invalid aggregate method evidence')
  return summarize(snapshot, pairs, 'completed', coverage, timing, [])
}

export function terminalAnalysisResult(
  snapshot: ExperimentSnapshot,
  evidence: readonly OfficialPairEvidence[],
  terminal: TerminalRun
): AnalysisResult {
  if (!terminal.error || terminal.error.length > 2000)
    throw new Error('Terminal analysis requires a bounded error description')
  const ids = evidence.map((pair) => pair.pairId)
  if (new Set(ids).size !== ids.length)
    throw new Error('Duplicate retained pair evidence')
  return summarize(
    snapshot,
    evidence,
    terminal.execution,
    'partial',
    terminal,
    [terminal.error]
  )
}

/** Revalidates saved evidence; never trusts serialized summaries or verdicts. */
export function validateHistoricalResult(
  snapshot: ExperimentSnapshot,
  input: unknown
): AnalysisResult {
  if (
    !hasExactOwnKeys(input, [
      'version',
      'runId',
      'snapshotId',
      'source',
      'method',
      'rule',
      'startedAt',
      'endedAt',
      'execution',
      'coverage',
      'verdict',
      'summary',
      'pairEvidence',
      'totalPairCount',
      'coveredPairCount',
      'findingPairCount',
      'unresolvedPairCount',
      'errors'
    ]) ||
    input.version !== 1 ||
    !Array.isArray(input.pairEvidence) ||
    input.pairEvidence.length > snapshot.pairs.length ||
    !Array.isArray(input.errors) ||
    input.errors.length > 1 ||
    !input.errors.every(
      (error) =>
        typeof error === 'string' && error.length > 0 && error.length <= 2000
    )
  )
    throw new Error('Invalid historical result envelope')
  const result = input as unknown as AnalysisResult
  const timing = {
    runId: result.runId,
    startedAt: result.startedAt,
    endedAt: result.endedAt
  }
  let validated: AnalysisResult
  if (result.execution === 'completed') {
    validated = completeAnalysisResult(
      snapshot,
      {
        version: 1,
        snapshotId: result.snapshotId,
        method: result.method,
        coverage: result.coverage,
        pairs: result.pairEvidence,
        evaluations: result.pairEvidence.reduce(
          (sum, pair) => sum + pair.evidence.evaluations,
          0
        )
      },
      timing
    )
  } else if (['failed', 'cancelled', 'timed-out'].includes(result.execution)) {
    validated = terminalAnalysisResult(snapshot, result.pairEvidence, {
      ...timing,
      execution: result.execution,
      error: result.errors[0]
    })
  } else throw new Error('Invalid historical execution state')
  const stable = (value: unknown) =>
    JSON.stringify(value, (_key, item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, item[key]])
      )
    })
  if (stable(validated) !== stable(result))
    throw new Error('Historical result disagrees with its source or evidence')
  return validated
}
