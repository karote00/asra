import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentPresets } from '../../../samples/synthetic-experiment'
import { createMechanicalVisuals } from '../../../samples/mechanical-visuals'
import { decodeRestrictedGlb, type VisualAsset } from '../../engine/glb/decode'
import { IDENTITY_POSE } from '../math'
import { resolvePartWorkcell } from '../part-geometry'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import {
  ORIGINAL_PART_METHOD,
  runOriginalPartMethod
} from '../../analysis/methods/original-part-method'
import { completeAnalysisResult } from '../../analysis/result'

it('the collision starter moves from clear endpoints into the actual table solid and reports a failed verdict', async () => {
  const example = createSyntheticExample()
  const preset = createSyntheticExperimentPresets(example).find(
    (item) => item.name === 'Tool and table collision'
  )
  if (!preset) throw new Error('Missing collision starter experiment')
  const sources = new Map<string, VisualAsset>()
  for (const part of createMechanicalVisuals()) {
    const asset = await decodeRestrictedGlb(part.bytes)
    sources.set(asset.source.sha256, asset)
    const body = example.workcell.bodies.find(
      (item) => item.id === `example:${part.body}`
    )
    if (!body) throw new Error('Missing original sample body')
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
  const draft = preset.draft
  const snapshot = createExperimentSnapshot({
    snapshotId: 'collision-starter',
    candidateId: 'candidate',
    experimentId: 'collision-study',
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
  expect(snapshot.pairs).toHaveLength(2)
  expect(
    snapshot.workcell.bodies.every((body) =>
      body.colliders.every((part) => part.geometry.kind === 'mesh')
    )
  ).toBe(true)
  for (const time of [0, 8]) {
    const endpoint = runOriginalPartMethod({
      ...snapshot,
      interval: [time, time]
    })
    expect(endpoint.coverage).toBe('complete')
    expect(
      endpoint.pairs.every((pair) =>
        pair.evidence.leaves.every((leaf) => leaf.state === 'clear')
      )
    ).toBe(true)
  }
  const evidence = runOriginalPartMethod(snapshot)
  expect(evidence.coverage).toBe('complete')
  for (const pair of evidence.pairs) {
    expect(
      pair.evidence.leaves.some(
        (leaf) =>
          leaf.state === 'finding' && leaf.penetration && leaf.witnessTime === 4
      )
    ).toBe(true)
  }
  const result = completeAnalysisResult(snapshot, evidence, {
    runId: 'collision-run',
    startedAt: 100,
    endedAt: 200
  })
  expect(result.execution).toBe('completed')
  expect(result.summary).toBe('issue-found')
  expect(result.verdict).toBe('does-not-meet')
  expect(result.findingPairCount).toBe(2)
  expect(result.unresolvedPairCount).toBe(0)
}, 20000)
