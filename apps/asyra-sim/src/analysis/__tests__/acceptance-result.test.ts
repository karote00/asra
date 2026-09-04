import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../methods/official-method'
import {
  completeAnalysisResult,
  terminalAnalysisResult,
  validateHistoricalResult
} from '../result'
import type { AcceptanceExpression } from '../contracts-rules'
import type {
  MethodEvidence,
  MethodPairEvidence
} from '../../extensions/contracts'

const example = createSyntheticExample(),
  draft = createSyntheticExperimentDraft(example)
const base = createExperimentSnapshot({
  snapshotId: 'rules',
  candidateId: 'candidate',
  experimentId: 'study',
  workcell: example.workcell,
  definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
  methods: [OFFICIAL_CLEARANCE_METHOD],
  acknowledgedWarningCodes: []
})
const timing = { runId: 'rules-run', startedAt: 0, endedAt: 1 }
const above = (value: number): AcceptanceExpression => ({
  kind: 'clearance',
  operator: 'above',
  value
})
const below = (value: number): AcceptanceExpression => ({
  kind: 'clearance',
  operator: 'below',
  value
})
function scenario(
  expression?: AcceptanceExpression,
  lower = 0.4,
  upper: number | null = 0.8,
  penetration = false
) {
  const snapshot = structuredClone(base)
  if (expression) snapshot.rule.acceptance = expression
  let state: 'finding' | 'clear' | 'unresolved' = 'unresolved'
  if (penetration || (upper !== null && upper < snapshot.rule.minimumClearance))
    state = 'finding'
  else if (lower > snapshot.rule.minimumClearance) state = 'clear'
  const coverage = state === 'unresolved' ? 'partial' : 'complete'
  const pairs: MethodPairEvidence[] = snapshot.pairs.map((pair) => ({
    pairId: pair.id,
    evidence: {
      lower,
      upper,
      coverage,
      evaluations: 1,
      leaves: [
        {
          start: snapshot.interval[0],
          end: snapshot.interval[1],
          lower,
          upper,
          witnessTime: upper === null ? null : snapshot.interval[0],
          penetration,
          state,
          reason: 'Independent protocol fixture'
        }
      ]
    }
  }))
  const evidence: MethodEvidence = {
    version: 1,
    snapshotId: snapshot.snapshotId,
    method: { id: snapshot.method.id, version: snapshot.method.version },
    coverage,
    evaluations: pairs.length,
    pairs
  }
  return {
    snapshot,
    evidence,
    result: () => completeAnalysisResult(snapshot, evidence, timing)
  }
}

it('uses interval bounds and strict equality without changing baseline evidence or legacy results', () => {
  const legacy = scenario().result()
  expect(legacy).not.toHaveProperty('decision')
  for (const [expression, value, verdict] of [
    [above(0.1), 'true', 'meets'],
    [above(0.8), 'false', 'does-not-meet'],
    [above(0.6), 'unknown', 'cannot-determine'],
    [below(0.9), 'true', 'meets'],
    [below(0.4), 'false', 'does-not-meet'],
    [below(0.6), 'unknown', 'cannot-determine']
  ] as const) {
    const result = scenario(expression).result()
    expect(result.verdict).toBe(verdict)
    expect(result.decision?.value).toBe(value)
    expect(result.pairEvidence).toEqual(legacy.pairEvidence)
    expect(result.summary).toBe('no-issue-within-scope')
  }
})

it('evaluates all nine AND and OR truth combinations, including nested unknown branches', () => {
  const nodes = [above(0.1), below(0.1), above(0.6)]
  const all = [
    ['true', 'false', 'unknown'],
    ['false', 'false', 'false'],
    ['unknown', 'false', 'unknown']
  ]
  const any = [
    ['true', 'true', 'true'],
    ['true', 'false', 'unknown'],
    ['true', 'unknown', 'unknown']
  ]
  for (const kind of ['all', 'any'] as const)
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const result = scenario({
          kind,
          conditions: [nodes[a], nodes[b]]
        }).result()
        expect(result.decision?.value).toBe((kind === 'all' ? all : any)[a][b])
        expect(result.decision?.children).toHaveLength(2)
      }
  expect(
    scenario({
      kind: 'all',
      conditions: [nodes[0], { kind: 'any', conditions: [nodes[1], nodes[2]] }]
    }).result().decision?.value
  ).toBe('unknown')
})

it('requires established separation or penetration, not merely an unreported collision', () => {
  const absent: AcceptanceExpression = {
    kind: 'penetration',
    expected: 'absent'
  }
  const present: AcceptanceExpression = {
    kind: 'penetration',
    expected: 'present'
  }
  expect(scenario(absent).result().decision?.value).toBe('true')
  expect(scenario(present).result().decision?.value).toBe('false')
  for (const expression of [absent, present]) {
    expect(scenario(expression, 0, 0).result().decision?.value).toBe('unknown')
    expect(scenario(expression, 0, null).result().decision?.value).toBe(
      'unknown'
    )
  }
  const found = scenario(present, 0, 0, true).result()
  expect(found).toMatchObject({
    verdict: 'meets',
    summary: 'issue-found',
    findingPairCount: base.pairs.length
  })
  expect(scenario(absent, 0, 0, true).result().verdict).toBe('does-not-meet')
})

it('cannot turn missing pairs, partial coverage, cancelled, timed-out or failed execution into acceptance', () => {
  const { snapshot, evidence } = scenario({
    kind: 'any',
    conditions: [above(0.1), above(0.6)]
  })
  for (const execution of ['cancelled', 'timed-out', 'failed'] as const) {
    const result = terminalAnalysisResult(snapshot, evidence.pairs, {
      ...timing,
      execution,
      error: execution
    })
    expect(result.decision?.value).toBe('true')
    expect(result.verdict).toBe('cannot-determine')
    const empty = terminalAnalysisResult(snapshot, [], {
      ...timing,
      execution,
      error: execution
    })
    expect(empty.decision?.value).toBe('unknown')
    expect(empty.verdict).toBe('cannot-determine')
  }
  const partial = scenario(
    { kind: 'any', conditions: [below(1), above(0.1)] },
    0,
    0.8
  ).result()
  expect(partial.decision?.value).toBe('true')
  expect(partial.coverage).toBe('partial')
  expect(partial.verdict).toBe('cannot-determine')
  const knownFalse = scenario(above(1))
  expect(
    terminalAnalysisResult(
      knownFalse.snapshot,
      [knownFalse.evidence.pairs[0]],
      {
        ...timing,
        execution: 'cancelled',
        error: 'cancelled'
      }
    ).verdict
  ).toBe('does-not-meet')
})

it('freezes rule evaluation and rejects forged, omitted or extra historical conclusions', () => {
  const { snapshot, result } = scenario({
    kind: 'all',
    conditions: [above(0.1), below(0.1)]
  })
  const retained = result()
  expect(Object.isFrozen(retained.decision)).toBe(true)
  expect(validateHistoricalResult(snapshot, retained)).toEqual(retained)
  for (const patch of [
    { verdict: 'meets' },
    { decision: undefined },
    { decision: { ...retained.decision, value: 'true' } },
    { decision: { ...retained.decision, reason: 'Forged reason' } },
    { decision: { ...retained.decision, children: [] } },
    { decision: { ...retained.decision, executable: 'true' } }
  ])
    expect(() =>
      validateHistoricalResult(snapshot, { ...retained, ...patch })
    ).toThrow()
})
