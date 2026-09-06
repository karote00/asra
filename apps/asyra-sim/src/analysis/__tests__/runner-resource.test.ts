import { afterEach, expect, it, vi } from 'vitest'
import { MethodIds, MethodVersions } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { ExperimentSnapshot } from '../contracts'
import { runOfficialClearanceMethod } from '../methods/official-method'
import { AnalysisRunner } from '../runner'

vi.mock('../contracts', async (load) => {
  const actual = await load<typeof import('../contracts')>()
  return {
    ...actual,
    EXPERIMENT_RESOURCE_PROFILE: {
      ...actual.EXPERIMENT_RESOURCE_PROFILE,
      maxEvidenceLeaves: 3,
      maxEvidenceBytes: 4096
    }
  }
})
afterEach(() => vi.useRealTimers())

function setup() {
  const ids = ['primary', 'obstacle-a', 'obstacle-b']
  const snapshot: ExperimentSnapshot = {
    version: 1,
    snapshotId: 'bounded-run',
    source: {
      candidateId: 'candidate',
      experimentId: 'study',
      experimentRevision: 1
    },
    workcell: {
      version: 1,
      robotRootId: null,
      bodies: ids.map((id, index) => ({
        id,
        name: id,
        parentId: null,
        role: 'fixture',
        visible: true,
        color: 0,
        pose: { ...IDENTITY_POSE, position: [index, 0, 0] },
        joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
        colliders: [
          {
            id: 'shape',
            pose: IDENTITY_POSE,
            geometry: { kind: 'sphere', radius: 0.1 }
          }
        ]
      }))
    },
    trajectory: {
      version: 1,
      keyframes: [
        { time: 0, joints: {} },
        { time: 1, joints: {} }
      ]
    },
    sourceUnits: { time: 's', joints: {} },
    interval: [0, 1],
    scope: {
      primaryBodyIds: ['primary'],
      influencingBodyIds: ids.slice(1),
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote: 'Complete scope.'
    },
    pairs: ids.slice(1).map((id) => ({
      id: `primary/shape::${id}/shape`,
      a: { bodyId: 'primary', colliderId: 'shape' },
      b: { bodyId: id, colliderId: 'shape' }
    })),
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 1e-6,
        timeTolerance: 1e-4,
        maxIterations: 64
      }
    },
    rule: { version: 1, revision: 1, minimumClearance: 0.02 },
    budget: { maxIntervals: 100, maxDurationMs: 1000 },
    acknowledgedWarnings: []
  }
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn()
  }
  const runner = new AnalysisRunner(
    () => worker as unknown as Worker,
    Date.now,
    () => 'resource-run'
  )
  return {
    snapshot,
    worker,
    runner,
    emit: (data: object) =>
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { runId: 'resource-run', ...data }
        })
      )
  }
}

it('rejects cumulative progress over the global leaf capacity while retaining earlier valid evidence', async () => {
  vi.useFakeTimers()
  const { snapshot, worker, runner, emit } = setup(),
    pending = runner.run(snapshot),
    evidence = runOfficialClearanceMethod(snapshot)
  for (const original of evidence.pairs) {
    const leaf = original.evidence.leaves[0]
    const pair = {
      ...original,
      evidence: {
        ...original.evidence,
        leaves: [
          { ...leaf, start: 0, end: 0.5, witnessTime: 0 },
          { ...leaf, start: 0.5, end: 1, witnessTime: 1 }
        ]
      }
    }
    emit({ type: 'progress', pairs: [pair] })
  }
  expect(worker.terminate).toHaveBeenCalledOnce()
  await expect(pending).resolves.toMatchObject({
    execution: 'failed',
    coveredPairCount: 1,
    errors: [expect.stringContaining('global')]
  })
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects an oversized encoded response before treating it as completed evidence', async () => {
  vi.useFakeTimers()
  const { snapshot, worker, runner, emit } = setup(),
    pending = runner.run(snapshot),
    original = runOfficialClearanceMethod(snapshot)
  const evidence = {
    ...original,
    pairs: original.pairs.map((pair) => ({
      ...pair,
      evidence: {
        ...pair.evidence,
        leaves: pair.evidence.leaves.map((leaf) => ({
          ...leaf,
          reason: 'x'.repeat(3000)
        }))
      }
    }))
  }
  emit({ type: 'complete', evidence })
  await expect(pending).resolves.toMatchObject({
    execution: 'failed',
    errors: [expect.stringContaining('payload')]
  })
  expect(worker.terminate).toHaveBeenCalledOnce()
})
