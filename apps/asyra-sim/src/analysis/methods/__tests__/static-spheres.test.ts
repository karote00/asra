import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../../domain/math'
import type { Body, Workcell } from '../../../domain/workcell'
import type { ExperimentDefinition } from '../../contracts'
import { createExperimentSnapshot } from '../../snapshot'
import { preflightExperiment } from '../../preflight'
import { completeAnalysisResult } from '../../result'
import { runStaticSphereMethod, STATIC_SPHERE_METHOD } from '../static-spheres'

const sphere = (id: string, x: number, y = 0, radius = 0.125): Body => ({
  id,
  parentId: null,
  name: id,
  role: 'fixture',
  pose: { ...IDENTITY_POSE, position: [x, y, 0] },
  joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
  colliders: [
    { id: 'shape', pose: IDENTITY_POSE, geometry: { kind: 'sphere', radius } }
  ],
  visible: true,
  color: 0
})

function input(x = 1, y = 0, threshold = 0.1, error = 0) {
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: [sphere('a', 0), sphere('b', x, y)]
  }
  const definition: ExperimentDefinition = {
    version: 1,
    revision: 1,
    trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 0],
    scope: {
      primaryBodyIds: ['a'],
      influencingBodyIds: ['b'],
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Both modeled spheres are in scope.'
    },
    method: {
      id: STATIC_SPHERE_METHOD.id,
      version: STATIC_SPHERE_METHOD.version,
      settings: {
        distanceTolerance: 1e-6,
        timeTolerance: 1e-4,
        maxIterations: 64,
        parameters: { additionalError: error }
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: threshold },
    budget: { maxIntervals: 20, maxDurationMs: 1000 }
  }
  return { workcell, definition }
}

function snapshot(source = input()) {
  return createExperimentSnapshot({
    ...source,
    methods: [STATIC_SPHERE_METHOD],
    snapshotId: 'static-spheres',
    candidateId: 'candidate',
    experimentId: 'study',
    acknowledgedWarningCodes: []
  })
}

describe('independent static sphere method', () => {
  it('encloses exact axis and Pythagorean distances through the ordinary result path', () => {
    for (const [x, y, exact] of [
      [1, 0, 0.75],
      [3, 4, 4.75],
      [0, 0, 0]
    ]) {
      const frozen = snapshot(input(x, y)),
        evidence = runStaticSphereMethod(frozen)
      const pair = evidence.pairs[0].evidence
      expect(pair.lower).toBeLessThanOrEqual(exact)
      expect(pair.upper).toBeGreaterThanOrEqual(exact)
      expect((pair.upper ?? Infinity) - pair.lower).toBeLessThan(1e-10)
      const result = completeAnalysisResult(frozen, evidence, {
        runId: 'run',
        startedAt: 1,
        endedAt: 2
      })
      expect(result.coverage).toBe('complete')
      expect(result.verdict).toBe(exact === 0 ? 'does-not-meet' : 'meets')
      expect(result.method.id).toBe(STATIC_SPHERE_METHOD.id)
    }
  })

  it('does not turn touching, threshold equality or added uncertainty into success', () => {
    for (const source of [
      input(0.25, 0, 0),
      input(1, 0, 0.75),
      input(1, 0, 0.7495, 0.001)
    ]) {
      const frozen = snapshot(source),
        evidence = runStaticSphereMethod(frozen)
      expect(evidence.coverage).toBe('partial')
      expect(evidence.pairs[0].evidence.leaves[0].penetration).toBe(false)
      expect(
        completeAnalysisResult(frozen, evidence, {
          runId: 'run',
          startedAt: 1,
          endedAt: 2
        }).verdict
      ).toBe('cannot-determine')
    }
  })

  it('uses shared joint and body-local collider poses, not only body origins', () => {
    const source = input(1)
    source.workcell.robotRootId = 'root'
    source.workcell.bodies[0].role = 'link'
    source.workcell.bodies[0].parentId = 'root'
    source.workcell.bodies[0].joint = {
      kind: 'revolute',
      axis: [0, 0, 1],
      value: 0,
      min: -4,
      max: 4
    }
    source.workcell.bodies[0].colliders[0].pose = {
      ...IDENTITY_POSE,
      position: [0.5, 0, 0]
    }
    source.definition.trajectory.keyframes[0].joints = { a: Math.PI / 2 }
    source.definition.sourceUnits.joints = { a: 'rad' }
    source.workcell.bodies = [
      ...source.workcell.bodies,
      {
        ...sphere('root', 0),
        role: 'robot',
        colliders: [],
        visible: false
      }
    ]
    const evidence = runStaticSphereMethod(snapshot(source)),
      exact = Math.sqrt(1.25) - 0.25
    expect(evidence.pairs[0].evidence.lower).toBeLessThanOrEqual(exact)
    expect(evidence.pairs[0].evidence.upper).toBeGreaterThanOrEqual(exact)
  })

  it('rejects motion and unsupported shapes in preflight', () => {
    const motion = input()
    motion.definition.trajectory.keyframes = [
      { time: 0, joints: {} },
      { time: 1, joints: {} }
    ]
    motion.definition.interval = [0, 1]
    const box = input()
    box.workcell.bodies[1].colliders[0].geometry = {
      kind: 'box',
      size: [1, 1, 1]
    }
    expect(
      preflightExperiment(motion.workcell, motion.definition, [
        STATIC_SPHERE_METHOD
      ]).blockers
    ).toContainEqual(expect.objectContaining({ code: 'method-capability' }))
    expect(
      preflightExperiment(box.workcell, box.definition, [STATIC_SPHERE_METHOD])
        .blockers
    ).toContainEqual(expect.objectContaining({ code: 'unsupported-geometry' }))
  })

  it('retains analytical bounds near the supported radius and offset limits', () => {
    for (const [radius, offset] of [
      [0.0001, 0.001],
      [20, 1000]
    ]) {
      const source = input(offset, 0, 0)
      source.workcell.bodies = [
        sphere('a', 0, 0, radius),
        sphere('b', offset, 0, radius)
      ]
      const pair = runStaticSphereMethod(snapshot(source)).pairs[0].evidence
      const expected = offset - 2 * radius
      expect(pair.lower).toBeLessThanOrEqual(expected)
      expect(pair.upper).toBeGreaterThanOrEqual(expected)
      expect(pair.coverage).toBe('complete')
    }
  })

  it('retains unevaluated pairs and propagates cooperative cancellation', () => {
    const source = input()
    source.workcell.bodies = [...source.workcell.bodies, sphere('c', 2)]
    source.definition.scope.influencingBodyIds = ['b', 'c']
    source.definition.budget.maxIntervals = 1
    const frozen = snapshot(source),
      received: string[] = []
    const evidence = runStaticSphereMethod(
      frozen,
      () => undefined,
      (pair) => received.push(pair.pairId)
    )
    expect(evidence.evaluations).toBe(1)
    expect(evidence.coverage).toBe('partial')
    expect(evidence.pairs[1].evidence).toMatchObject({
      upper: null,
      evaluations: 0,
      coverage: 'partial'
    })
    expect(received).toEqual(frozen.pairs.map((pair) => pair.id))
    expect(() =>
      runStaticSphereMethod(frozen, () => {
        throw new Error('cancelled')
      })
    ).toThrow('cancelled')
    expect(frozen.workcell.bodies).toEqual(source.workcell.bodies)
  })
})
