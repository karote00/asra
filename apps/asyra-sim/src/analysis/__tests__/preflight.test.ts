import { describe, expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { MethodIds, MethodVersions } from '../../constants'
import type { ExperimentDefinition, MethodDescriptor } from '../contracts'
import { preflightExperiment } from '../preflight'
import { createExperimentSnapshot } from '../snapshot'

const method: MethodDescriptor = {
  id: MethodIds.CONTINUOUS_CLEARANCE,
  version: MethodVersions.CONTINUOUS_CLEARANCE,
  geometryKinds: ['box', 'sphere', 'capsule'],
  supportsStatic: true,
  supportsMotion: true,
  maxPairs: 4096
}

function definition(): ExperimentDefinition {
  const example = createSyntheticExample()
  const primaryBodyIds = example.workcell.bodies
    .filter((body) => body.role !== 'fixture')
    .map((body) => body.id)
  const influencingBodyIds = example.workcell.bodies
    .filter((body) => body.role === 'fixture')
    .map((body) => body.id)
  return {
    version: 1,
    revision: 1,
    trajectory: example.trajectory,
    sourceUnits: {
      time: 's',
      joints: Object.fromEntries(
        example.workcell.bodies
          .filter((body) => body.joint.kind !== 'fixed')
          .map((body) => [body.id, 'rad' as const])
      )
    },
    scope: {
      primaryBodyIds,
      influencingBodyIds,
      selfCollision: true,
      externalCollision: true,
      excludedPairs: example.excludedPairs.map((pair) => ({
        version: 1 as const,
        ...pair
      })),
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Only the modeled cell envelope is in scope.'
    },
    interval: [0, 8],
    method: {
      id: method.id,
      version: method.version,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.02 },
    budget: { maxIntervals: 2000, maxDurationMs: 15000 }
  }
}

describe('M2 experiment preflight and snapshot', () => {
  it('resolves an explicit supported scope into checkable collider pairs', () => {
    const example = createSyntheticExample()
    const report = preflightExperiment(example.workcell, definition(), [method])

    expect(report.blockers).toEqual([])
    expect(report.pairs.length).toBeGreaterThan(0)
    expect(report.pairs.every((pair) => pair.a.bodyId !== pair.b.bodyId)).toBe(
      true
    )
    expect(
      report.pairs.some(
        (pair) =>
          pair.a.bodyId.includes('joint-1') && pair.b.bodyId.includes('joint-2')
      )
    ).toBe(false)
    expect(report.estimate.reliableTimeEstimate).toBe(false)
  })

  it('blocks empty pair policies, unavailable methods, and uncovered intervals', () => {
    const example = createSyntheticExample()
    const base = definition()
    const cases: ExperimentDefinition[] = [
      {
        ...base,
        scope: {
          ...base.scope,
          selfCollision: false,
          externalCollision: false
        }
      },
      { ...base, method: { ...base.method, id: 'missing-method' } },
      { ...base, interval: [0, 9] }
    ]

    const reports = cases.map((item) =>
      preflightExperiment(example.workcell, item, [method])
    )
    expect(
      reports[0]?.blockers.some((issue) => issue.code === 'no-pairs')
    ).toBe(true)
    expect(
      reports[1]?.blockers.some((issue) => issue.code === 'method-unavailable')
    ).toBe(true)
    expect(
      reports[2]?.blockers.some((issue) => issue.code === 'interval-uncovered')
    ).toBe(true)
  })

  it('blocks selected bodies without analysis geometry', () => {
    const example = createSyntheticExample()
    const emptyBody = example.workcell.bodies.find(
      (body) => body.role === 'fixture'
    )
    if (!emptyBody) throw new Error('Expected fixture')
    const workcell = {
      ...example.workcell,
      bodies: example.workcell.bodies.map((body) =>
        body.id === emptyBody.id ? { ...body, colliders: [] } : body
      )
    }

    const report = preflightExperiment(workcell, definition(), [method])
    expect(
      report.blockers.some((issue) => issue.code === 'missing-collider')
    ).toBe(true)
  })

  it('requires visible excluded background to be explicitly acknowledged', () => {
    const example = createSyntheticExample()
    const base = definition()
    const excluded = base.scope.influencingBodyIds[0]
    if (!excluded) throw new Error('Expected influencing fixture')
    const unacknowledged: ExperimentDefinition = {
      ...base,
      scope: {
        ...base.scope,
        influencingBodyIds: base.scope.influencingBodyIds.filter(
          (id) => id !== excluded
        )
      }
    }
    const warning = preflightExperiment(example.workcell, unacknowledged, [
      method
    ])
    expect(
      warning.assumptions.some(
        (issue) => issue.code === 'visible-background-unacknowledged'
      )
    ).toBe(true)
    expect(() =>
      createExperimentSnapshot({
        snapshotId: 'snapshot-1',
        candidateId: 'candidate-1',
        experimentId: 'experiment-1',
        workcell: example.workcell,
        definition: unacknowledged,
        methods: [method],
        acknowledgedWarningCodes: []
      })
    ).toThrow('acknowledgement')

    const acknowledged = {
      ...unacknowledged,
      scope: {
        ...unacknowledged.scope,
        acknowledgedExcludedVisibleBodyIds: [excluded]
      }
    }
    expect(
      preflightExperiment(example.workcell, acknowledged, [method]).assumptions
    ).toEqual([])
  })

  it('separates resource risk from model validity and records acknowledgement', () => {
    const example = createSyntheticExample()
    const smallMethod = { ...method, warningWorkUnits: 1 }
    const report = preflightExperiment(example.workcell, definition(), [
      smallMethod
    ])
    expect(report.blockers).toEqual([])
    expect(report.resourceWarnings.map((issue) => issue.code)).toContain(
      'large-workload'
    )

    const snapshot = createExperimentSnapshot({
      snapshotId: 'snapshot-1',
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      workcell: example.workcell,
      definition: definition(),
      methods: [smallMethod],
      acknowledgedWarningCodes: ['large-workload']
    })
    expect(snapshot.acknowledgedWarnings).toEqual(['large-workload'])
  })

  it('freezes detached complete inputs and preserves source identities', () => {
    const example = createSyntheticExample()
    const input = definition()
    const snapshot = createExperimentSnapshot({
      snapshotId: 'snapshot-1',
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      workcell: example.workcell,
      definition: input,
      methods: [method],
      acknowledgedWarningCodes: []
    })

    expect(snapshot.source).toEqual({
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      experimentRevision: 1
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.workcell.bodies)).toBe(true)
    expect(Object.isFrozen(snapshot.pairs)).toBe(true)
    ;(input.trajectory.keyframes[0]?.joints as Record<string, number>)[
      'example:joint-1'
    ] = 9
    expect(
      snapshot.trajectory.keyframes[0]?.joints['example:joint-1']
    ).not.toBe(9)
  })

  it('rejects unjustified, duplicate, or irrelevant exclusions', () => {
    const example = createSyntheticExample()
    const base = definition()
    const first = base.scope.excludedPairs[0]
    if (!first) throw new Error('Expected exclusion')
    for (const excludedPairs of [
      [{ ...first, reason: '' }],
      [first, { ...first }],
      [{ ...first, a: 'example:fixture-table', b: 'example:fixture-post' }]
    ]) {
      const report = preflightExperiment(
        example.workcell,
        { ...base, scope: { ...base.scope, excludedPairs } },
        [method]
      )
      expect(
        report.blockers.some((issue) => issue.code === 'invalid-exclusion')
      ).toBe(true)
    }
  })
})
