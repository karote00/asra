import { expect, it } from 'vitest'
import { createMechanicalVisuals } from '../../../../samples/mechanical-visuals'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import {
  decodeRestrictedGlb,
  type VisualAsset
} from '../../../engine/glb/decode'
import { IDENTITY_POSE } from '../../../domain/math'
import { resolvePartWorkcell } from '../../../domain/part-geometry'
import { createExperimentSnapshot } from '../../snapshot'
import {
  ORIGINAL_PART_METHOD,
  runOriginalPartMethod
} from '../original-part-method'

it('runs the complete ordinary six-axis original-part study without exhausting triangle work', async () => {
  const example = createSyntheticExample(),
    sources = new Map<string, VisualAsset>()
  for (const part of createMechanicalVisuals()) {
    const asset = await decodeRestrictedGlb(part.bytes)
    sources.set(asset.source.sha256, asset)
    const body = example.workcell.bodies.find(
      (body) => body.id === `example:${part.body}`
    )
    if (!body) throw new Error('Missing mechanical body')
    body.visuals = [
      {
        version: 1,
        id: 'main-body',
        assetId: asset.source.sha256,
        pose: IDENTITY_POSE,
        scale: [1, 1, 1]
      }
    ]
    body.colliders = []
  }
  const draft = createSyntheticExperimentDraft(example)
  const snapshot = createExperimentSnapshot({
    snapshotId: 'full-original-study',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: resolvePartWorkcell(example.workcell, sources),
    definition: {
      ...draft,
      revision: 1,
      rule: { ...draft.rule, revision: 1 },
      method: {
        ...draft.method,
        id: ORIGINAL_PART_METHOD.id,
        version: ORIGINAL_PART_METHOD.version
      }
    },
    methods: [ORIGINAL_PART_METHOD],
    acknowledgedWarningCodes: []
  })
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
