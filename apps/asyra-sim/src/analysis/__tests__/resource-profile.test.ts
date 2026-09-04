import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../domain/math'
import type { Workcell } from '../../domain/workcell'
import type { ExperimentDefinition, MethodDescriptor } from '../contracts'
import { preflightExperiment } from '../preflight'
import { createExperimentSnapshot } from '../snapshot'

const method: MethodDescriptor = {
  id: 'resource-test',
  version: '1.0.0',
  geometryKinds: ['sphere'],
  supportsStatic: true,
  supportsMotion: true,
  maxPairs: 1000000
}
function setup(bodyCount: number, frameCount = 1, colliders = 1) {
  const workcell: Workcell = {
    version: 1,
    robotRootId: null,
    bodies: Array.from({ length: bodyCount }, (_, index) => ({
      id: `body-${index}`,
      name: `Body ${index}`,
      parentId: null,
      role: 'fixture',
      visible: true,
      color: 0,
      pose: IDENTITY_POSE,
      joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
      colliders: Array.from({ length: colliders }, (_, shape) => ({
        id: `shape-${shape}`,
        pose: IDENTITY_POSE,
        geometry: { kind: 'sphere', radius: 0.1 }
      }))
    }))
  }
  const definition: ExperimentDefinition = {
    version: 1,
    revision: 1,
    trajectory: {
      version: 1,
      keyframes: Array.from({ length: frameCount }, (_, time) => ({
        time,
        joints: {}
      }))
    },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, frameCount - 1],
    scope: {
      primaryBodyIds: workcell.bodies.map((body) => body.id),
      influencingBodyIds: [],
      selfCollision: true,
      externalCollision: false,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'All modeled bodies.'
    },
    method: {
      id: method.id,
      version: method.version,
      settings: {
        distanceTolerance: 1e-6,
        timeTolerance: 1e-4,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.02 },
    budget: { maxIntervals: 2000, maxDurationMs: 15000 }
  }
  return { workcell, definition }
}
const inspect = (input: ReturnType<typeof setup>) =>
  preflightExperiment(input.workcell, input.definition, [method])

describe('published local experiment resource profile', () => {
  it('counts only trajectory segments that overlap the requested analysis interval', () => {
    const input = setup(32, 1010)
    for (const [interval, segmentCount] of [
      [[100, 100], 1],
      [[100, 101], 1],
      [[100.5, 101.5], 2]
    ] as const) {
      input.definition.interval = interval
      const report = inspect(input)
      expect(report.blockers).toEqual([])
      expect(report.estimate.segmentCount).toBe(segmentCount)
      expect(report.estimate.workUnits).toBe(496 * segmentCount)
    }
  })
  it('admits the one-million-node and 120-second boundaries but not larger budgets', () => {
    const input = setup(2)
    input.definition.budget = { maxIntervals: 1000000, maxDurationMs: 120000 }
    expect(inspect(input).blockers).toEqual([])
    for (const budget of [
      { maxIntervals: 1000001, maxDurationMs: 120000 },
      { maxIntervals: 2000, maxDurationMs: 120001 },
      { maxIntervals: 2000, maxDurationMs: 99 }
    ]) {
      input.definition.budget = budget
      expect(inspect(input).blockers).toEqual([
        expect.objectContaining({ code: 'invalid-definition' })
      ])
    }
  })

  it('does not allow a method descriptor to bypass the global pair limit', () => {
    const input = setup(32, 1, 8),
      report = inspect(input)
    expect(report.estimate.pairCount).toBe(31744)
    expect(report.blockers.map((issue) => issue.code)).toContain('pair-limit')
    expect(report.pairs).toEqual([])
  })

  it('rejects more than 500000 pair/segment combinations despite acknowledgement', () => {
    const admitted = inspect(setup(32, 1009))
    expect(admitted.estimate.workUnits).toBe(499968)
    expect(admitted.blockers).toEqual([])
    const input = setup(32, 1010),
      report = inspect(input)
    expect(report.estimate.workUnits).toBe(500464)
    expect(report.blockers.map((issue) => issue.code)).toContain(
      'workload-limit'
    )
    expect(() =>
      createExperimentSnapshot({
        ...input,
        snapshotId: 'snapshot',
        candidateId: 'candidate',
        experimentId: 'experiment',
        methods: [method],
        acknowledgedWarningCodes: report.resourceWarnings.map(
          (issue) => issue.code
        )
      })
    ).toThrow('preflight blocked')
  })

  it('warns above 256 pairs or 10000 combinations without inventing a time estimate', () => {
    expect(inspect(setup(23)).resourceWarnings).toEqual([])
    expect(
      inspect(setup(24)).resourceWarnings.map((issue) => issue.code)
    ).toContain('large-pair-count')
    expect(inspect(setup(6, 667)).resourceWarnings).toEqual([])
    const input = setup(6, 668),
      report = inspect(input)
    expect(report.estimate.workUnits).toBe(10005)
    expect(report.estimate.reliableTimeEstimate).toBe(false)
    expect(report.resourceWarnings.map((issue) => issue.code)).toContain(
      'large-workload'
    )
    expect(() =>
      createExperimentSnapshot({
        ...input,
        snapshotId: 'snapshot',
        candidateId: 'candidate',
        experimentId: 'experiment',
        methods: [method],
        acknowledgedWarningCodes: []
      })
    ).toThrow('acknowledgement')
  })
})
