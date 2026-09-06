import { expect, it, vi } from 'vitest'
import * as meshIndex from '../mesh-index'
import {
  createOriginalPartExecutor,
  runOriginalPartMethod
} from '../original-part-method'
import { originalWorkcellSnapshot } from './workcell-fixture'

it('profiles repeated original-workcell poses with preparation separate from queries', async () => {
  const snapshot = await originalWorkcellSnapshot()
  const build = meshIndex.buildMeshIndex
  let preparationMs = 0
  const index = vi
    .spyOn(meshIndex, 'buildMeshIndex')
    .mockImplementation((...args) => {
      const start = performance.now()
      try {
        return build(...args)
      } finally {
        preparationMs += performance.now() - start
      }
    })
  const start = performance.now()
  try {
    const cold = []
    for (const time of [3.8, 3.9, 4, 4.1, 4.2]) {
      const evidence = runOriginalPartMethod({
        ...snapshot,
        interval: [time, time]
      })
      expect(evidence.pairs).toHaveLength(snapshot.pairs.length)
      cold.push(evidence)
    }
    // eslint-disable-next-line no-console -- permanent bounded performance profile
    console.info(
      JSON.stringify({
        profile: 'original-workcell-cold-poses',
        samples: 5,
        indexBuilds: index.mock.calls.length,
        preparationMs: Math.round(preparationMs),
        totalMs: Math.round(performance.now() - start)
      })
    )
    const coldBuilds = index.mock.calls.length
    index.mockClear()
    preparationMs = 0
    const execute = createOriginalPartExecutor()
    const durations: number[] = []
    const warm = [3.8, 3.9, 4, 4.1, 4.2].map((time) => {
      const poseStart = performance.now()
      const evidence = execute(
        { ...snapshot, interval: [time, time] },
        {
          signal: new AbortController().signal,
          checkpoint: () => undefined,
          emitPair: () => undefined
        }
      )
      durations.push(performance.now() - poseStart)
      return evidence
    })
    expect(warm).toEqual(cold)
    expect(index.mock.calls.length).toBe(coldBuilds / 5)
    // eslint-disable-next-line no-console -- permanent bounded performance profile
    console.info(
      JSON.stringify({
        profile: 'original-workcell-reused-poses',
        samples: 5,
        indexBuilds: index.mock.calls.length,
        preparationMs: Math.round(preparationMs),
        poseMs: durations.map(Math.round)
      })
    )
  } finally {
    index.mockRestore()
  }
}, 20000)

it('runs the complete ordinary six-axis original-part study without exhausting triangle work', async () => {
  const snapshot = await originalWorkcellSnapshot()
  const start = performance.now(),
    evidence = runOriginalPartMethod(snapshot)
  const exhausted = evidence.pairs.filter((pair) =>
    pair.evidence.leaves.some((leaf) => /work budget/.test(leaf.reason))
  )
  // eslint-disable-next-line no-console -- bounded permanent resource profile
  console.info(
    JSON.stringify({
      profile: 'complete-original-workcell',
      triangles: snapshot.workcell.bodies.reduce(
        (sum, body) =>
          sum +
          body.colliders.reduce(
            (n, part) =>
              n +
              (part.geometry.kind === 'mesh'
                ? part.geometry.indices.length / 3
                : 0),
            0
          ),
        0
      ),
      pairs: evidence.pairs.length,
      evaluations: evidence.evaluations,
      exhaustedPairs: exhausted.length,
      durationMs: Math.round(performance.now() - start)
    })
  )
  expect(evidence.pairs).toHaveLength(snapshot.pairs.length)
  expect(exhausted.map((pair) => pair.pairId)).toEqual([])
}, 20000)
