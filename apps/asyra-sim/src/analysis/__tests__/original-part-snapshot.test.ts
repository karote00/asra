import { describe, expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { IDENTITY_POSE } from '../../domain/math'
import { resolvePartWorkcell } from '../../domain/part-geometry'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../snapshot'
import { preflightExperiment } from '../preflight'
import type { MethodDescriptor } from '../contracts'

const assetId = 'a'.repeat(64)
const source = {
  source: { sha256: assetId },
  meshes: [
    {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
    }
  ]
}
const descriptor: MethodDescriptor = {
  id: 'full-part-test',
  version: '1.0.0',
  geometryKinds: ['mesh', 'box', 'sphere', 'capsule'],
  supportsStatic: true,
  supportsMotion: true,
  maxPairs: 4096
}
function input() {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  example.workcell.bodies[0].visuals = [
    {
      version: 1,
      id: 'base-part',
      assetId,
      scale: [1, 1, 1],
      pose: IDENTITY_POSE
    }
  ]
  return {
    snapshotId: 'mesh-study',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: resolvePartWorkcell(
      example.workcell,
      new Map([[assetId, source]])
    ),
    definition: {
      ...draft,
      revision: 1,
      method: {
        ...draft.method,
        id: descriptor.id,
        version: descriptor.version
      },
      rule: { ...draft.rule, revision: 1 }
    },
    methods: [descriptor],
    acknowledgedWarningCodes: []
  }
}
describe('original part snapshot admission', () => {
  it('freezes every original triangle in a new version and preserves immutable history', () => {
    const data = input(),
      snapshot = createExperimentSnapshot(data)
    expect(snapshot.version).toBe(2)
    expect(snapshot.workcell.bodies[0].colliders[0].geometry).toEqual(
      data.workcell.bodies[0].colliders[0].geometry
    )
    expect(
      Object.isFrozen(snapshot.workcell.bodies[0].colliders[0].geometry)
    ).toBe(true)
    expect(validateHistoricalSnapshot(snapshot)).toEqual(snapshot)
    expect(() =>
      validateHistoricalSnapshot({ ...snapshot, version: 1 })
    ).toThrow(/version|mesh/i)
  })
  it('rejects mismatched placement, omitted parts and open surfaces without waivers', () => {
    const data = input(),
      original = structuredClone(data.workcell)
    data.workcell.bodies[0].colliders[0].pose = {
      ...IDENTITY_POSE,
      position: [1, 0, 0]
    }
    expect(
      preflightExperiment(data.workcell, data.definition, data.methods).blockers
        .length
    ).toBeGreaterThan(0)
    data.workcell = original
    const geometry = data.workcell.bodies[0].colliders[0].geometry
    if (geometry.kind !== 'mesh') throw new Error('Missing test geometry')
    geometry.indices = geometry.indices.slice(3)
    expect(
      preflightExperiment(data.workcell, data.definition, data.methods).blockers
    ).toContainEqual(
      expect.objectContaining({ code: 'original-part-topology' })
    )
    expect(() => createExperimentSnapshot(data)).toThrow(/Open original/)
  })
})
