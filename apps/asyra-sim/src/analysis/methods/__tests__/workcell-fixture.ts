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
import { ORIGINAL_PART_METHOD } from '../original-part-method'

export async function originalWorkcellSnapshot() {
  const example = createSyntheticExample()
  const sources = new Map<string, VisualAsset>()

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

  return createExperimentSnapshot({
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
}
