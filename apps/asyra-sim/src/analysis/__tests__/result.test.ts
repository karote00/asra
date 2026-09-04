import { describe, expect, it } from 'vitest'
import { MethodIds, MethodVersions } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import type { ExperimentSnapshot } from '../contracts'
import { runOfficialClearanceMethod } from '../methods/official-method'
import {
  completeAnalysisResult,
  terminalAnalysisResult,
  validateHistoricalResult,
  validatePairProgress
} from '../result'

const body = (id: string, x: number): Body => ({
  id,
  parentId: null,
  name: id,
  role: id === 'primary' ? 'tool' : 'fixture',
  pose: { ...IDENTITY_POSE, position: [x, 0, 0] },
  joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
  colliders: [
    {
      id: 'shape',
      pose: IDENTITY_POSE,
      geometry: { kind: 'sphere', radius: 0.1 }
    }
  ],
  visible: true,
  color: 0
})

function snapshot(distance: number): ExperimentSnapshot {
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: [body('primary', 0), body('obstacle', distance)]
  }
  return {
    version: 1,
    snapshotId: 'snapshot-1',
    source: {
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      experimentRevision: 2
    },
    workcell,
    trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 0],
    scope: {
      primaryBodyIds: ['primary'],
      influencingBodyIds: ['obstacle'],
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Complete modeled scope.'
    },
    pairs: [
      {
        id: 'primary/shape::obstacle/shape',
        a: { bodyId: 'primary', colliderId: 'shape' },
        b: { bodyId: 'obstacle', colliderId: 'shape' }
      }
    ],
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 2, minimumClearance: 0.1 },
    budget: { maxIntervals: 64, maxDurationMs: 1000 },
    acknowledgedWarnings: []
  }
}

const timing = { runId: 'run-1', startedAt: 100, endedAt: 120 }

describe('M3 result validation and rule evaluation', () => {
  it('rejects a forged historical verdict, source identity, or extra fields', () => {
    const input = snapshot(1)
    const valid = terminalAnalysisResult(input, [], {
      ...timing,
      execution: 'cancelled',
      error: 'Cancelled'
    })
    expect(validateHistoricalResult(input, valid)).toEqual(valid)
    for (const patch of [
      { verdict: 'meets' },
      { coverage: 'complete' },
      { summary: 'no-issue-within-scope' },
      { snapshotId: 'other' },
      { source: { ...valid.source, experimentRevision: 99 } },
      { privateExtra: true }
    ])
      expect(() =>
        validateHistoricalResult(input, { ...valid, ...patch })
      ).toThrow()
  })

  it('rejects a run whose individually valid pairs exceed the global evaluation budget', () => {
    const input = snapshot(1)
    const evidence = runOfficialClearanceMethod(input)
    const first = evidence.pairs[0]
    input.budget.maxIntervals = 1
    input.pairs = [...input.pairs, { ...input.pairs[0], id: 'second-pair' }]
    const pairs = [first, { ...first, pairId: 'second-pair' }]
    expect(() =>
      completeAnalysisResult(
        input,
        { ...evidence, pairs, evaluations: 2 },
        timing
      )
    ).toThrow('budget')
    expect(() =>
      terminalAnalysisResult(input, pairs, {
        ...timing,
        execution: 'cancelled',
        error: 'Cancelled'
      })
    ).toThrow('budget')
  })
  it('reports no issue only when completed evidence covers every pair', () => {
    const input = snapshot(1)
    const result = completeAnalysisResult(
      input,
      runOfficialClearanceMethod(input),
      timing
    )
    expect(result).toMatchObject({
      execution: 'completed',
      coverage: 'complete',
      verdict: 'meets',
      summary: 'no-issue-within-scope',
      findingPairCount: 0,
      unresolvedPairCount: 0
    })
    expect(result.source).toEqual(input.source)
    expect(Object.isFrozen(result.pairEvidence)).toBe(true)
  })

  it('preserves an established issue even when execution later cancels', () => {
    const input = snapshot(0)
    const pair = runOfficialClearanceMethod(input).pairs[0]
    if (!pair) throw new Error('Expected pair evidence')
    const result = terminalAnalysisResult(input, [pair], {
      ...timing,
      execution: 'cancelled',
      error: 'Cancelled by user'
    })
    expect(result).toMatchObject({
      execution: 'cancelled',
      coverage: 'partial',
      verdict: 'does-not-meet',
      summary: 'issue-found',
      findingPairCount: 1
    })
  })

  it('never turns timeout, failure, or partial clear evidence into success', () => {
    const input = snapshot(1)
    const pair = runOfficialClearanceMethod(input).pairs[0]
    if (!pair) throw new Error('Expected pair evidence')
    for (const execution of ['cancelled', 'timed-out', 'failed'] as const) {
      const result = terminalAnalysisResult(input, [pair], {
        ...timing,
        execution,
        error: execution
      })
      expect(result.verdict).toBe('cannot-determine')
      expect(result.summary).toBe('cannot-determine')
      expect(result.coverage).toBe('partial')
    }
  })

  it('rejects wrong identities, invalid bounds, and incomplete completed output', () => {
    const input = snapshot(1),
      valid = runOfficialClearanceMethod(input)
    const wrong = structuredClone(valid)
    wrong.snapshotId = 'other-snapshot'
    expect(() => completeAnalysisResult(input, wrong, timing)).toThrow(
      'identity'
    )

    const pair = structuredClone(valid.pairs[0])
    if (!pair) throw new Error('Expected pair evidence')
    const leaf = pair.evidence.leaves[0]
    if (!leaf) throw new Error('Expected interval evidence')
    leaf.lower = 5
    expect(() => validatePairProgress(input, pair)).toThrow('bound')

    expect(() =>
      completeAnalysisResult(input, { ...valid, pairs: [] }, timing)
    ).toThrow('pair coverage')
  })
})
