import { describe, expect, it } from 'vitest'
import { MethodIds, MethodVersions } from '../../../constants'
import { IDENTITY_POSE } from '../../../domain/math'
import type { Body, Workcell } from '../../../domain/workcell'
import type { ExperimentSnapshot } from '../../contracts'
import {
  OFFICIAL_CLEARANCE_METHOD,
  runOfficialClearanceMethod
} from '../official-method'

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

function snapshot(
  obstacles: readonly number[],
  budget = 64
): ExperimentSnapshot {
  const bodies = [
    body('primary', 0),
    ...obstacles.map((x, i) => body(`o${i}`, x))
  ]
  const workcell: Workcell = { version: 1, robotRootId: null, bodies }
  return {
    version: 1,
    snapshotId: 'snapshot-1',
    source: {
      candidateId: 'candidate-1',
      experimentId: 'experiment-1',
      experimentRevision: 1
    },
    workcell,
    trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 0],
    scope: {
      primaryBodyIds: ['primary'],
      influencingBodyIds: obstacles.map((_, i) => `o${i}`),
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'All modeled bodies are in scope.'
    },
    pairs: obstacles.map((_, i) => ({
      id: `primary/shape::o${i}/shape`,
      a: { bodyId: 'primary', colliderId: 'shape' },
      b: { bodyId: `o${i}`, colliderId: 'shape' }
    })),
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.1 },
    budget: { maxIntervals: budget, maxDurationMs: 15000 },
    acknowledgedWarnings: []
  }
}

describe('M3 official clearance method aggregation', () => {
  it('publishes one stable capability descriptor', () => {
    expect(OFFICIAL_CLEARANCE_METHOD).toMatchObject({
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      supportsStatic: true,
      supportsMotion: true
    })
    expect(Object.isFrozen(OFFICIAL_CLEARANCE_METHOD)).toBe(true)
  })

  it('preserves established contact separately from complete scope coverage', () => {
    const evidence = runOfficialClearanceMethod(snapshot([0]))
    expect(evidence.snapshotId).toBe('snapshot-1')
    expect(evidence.pairs).toHaveLength(1)
    expect(
      evidence.pairs[0]?.evidence.leaves.some((leaf) => leaf.penetration)
    ).toBe(true)
    expect(evidence.coverage).toBe('complete')
  })

  it('proves static clearance when bounds support the selected threshold', () => {
    const evidence = runOfficialClearanceMethod(snapshot([1]))
    expect(evidence.coverage).toBe('complete')
    expect(
      evidence.pairs[0]?.evidence.leaves.every((leaf) => leaf.state === 'clear')
    ).toBe(true)
    expect(evidence.pairs[0]?.evidence.lower).toBeGreaterThan(0.1)
  })

  it('marks every unprocessed pair unresolved after the shared budget is exhausted', () => {
    const evidence = runOfficialClearanceMethod(snapshot([1, 2], 1))
    expect(evidence.pairs).toHaveLength(2)
    expect(evidence.pairs[1]?.evidence).toMatchObject({
      coverage: 'partial',
      evaluations: 0,
      upper: null
    })
    expect(evidence.pairs[1]?.evidence.leaves[0]?.reason).toContain(
      'global interval budget'
    )
    expect(evidence.coverage).toBe('partial')
  })

  it('checks cancellation between pair and interval work', () => {
    let checks = 0
    expect(() =>
      runOfficialClearanceMethod(snapshot([1]), () => {
        checks++
        if (checks > 1) throw new Error('cancelled')
      })
    ).toThrow('cancelled')
  })
})
