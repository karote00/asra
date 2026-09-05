import { expect, it, vi } from 'vitest'
import { ComponentTypes, PropertyFields, PropertyNames } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { historicalProxyFixture } from '../../analysis/__tests__/historical-proxy-fixture'
import { terminalAnalysisResult } from '../../analysis/result'
import { OFFICIAL_CLEARANCE_METHOD } from '../../analysis/methods/official-method'
import {
  decodeProject,
  encodeProject,
  projectVisualAssetIds
} from '../project-format'
import { VisualAssetArchive } from '../visual-archive'
import type { VisualSourceRecord } from '../visual-source'
import { prepareProjectVisuals } from '../project-visuals'
import { createMechanicalVisuals } from '../../../samples/mechanical-visuals'
import { resolvePartWorkcell } from '../../domain/part-geometry'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { ORIGINAL_PART_METHOD } from '../../analysis/methods/original-part-method'

it('rejects frozen triangles changed under an unchanged original source identity before project replacement', async () => {
  const archive = new VisualAssetArchive({
    decode: decodeRestrictedGlb,
    dispose: () => undefined
  })
  const table = createMechanicalVisuals().find(
    (part) => part.body === 'fixture-table'
  )
  if (!table) throw new Error('Missing sample table source')
  const prepared = await archive.prepare(table.bytes, 'table.glb')
  const source = archive.accept(prepared),
    example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  example.workcell.bodies[0].visuals = [binding(source.assetId)]
  const snapshot = createExperimentSnapshot({
    snapshotId: 'original-input',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: resolvePartWorkcell(
      example.workcell,
      archive.resolveWorkcell(example.workcell)
    ),
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
  const run = {
    version: 1 as const,
    name: 'Original source',
    retainedAt: '2026-09-05T00:00:00Z',
    environment: {
      appVersion: 'test',
      userAgent: 'unit',
      hardwareConcurrency: 1
    },
    snapshot,
    result: terminalAnalysisResult(snapshot, [], {
      runId: 'original-run',
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled'
    })
  }
  const input = { ...project(source), runs: [run] }
  const accepted = await prepareProjectVisuals(input, {
    decode: decodeRestrictedGlb,
    dispose: () => undefined
  })
  accepted.dispose()
  const changed = structuredClone(input),
    geometry = changed.runs[0].snapshot.workcell.bodies[0].colliders[0].geometry
  if (geometry.kind !== 'mesh') throw new Error('Missing original source')
  geometry.positions = geometry.positions.map((n) => n * 0.5)
  const decoder = { decode: decodeRestrictedGlb, dispose: vi.fn() }
  await expect(prepareProjectVisuals(changed, decoder)).rejects.toThrow(
    /original part source/i
  )
  expect(decoder.dispose).toHaveBeenCalledOnce()
  archive.dispose()
})

async function retainedSource(): Promise<VisualSourceRecord> {
  const archive = new VisualAssetArchive({
    decode: decodeRestrictedGlb,
    dispose: () => undefined
  })
  try {
    const { json, binary } = triangleFixture()
    return (await archive.prepare(encodeGlb(json, binary), 'reference.glb'))
      .source
  } finally {
    archive.dispose()
  }
}
const binding = (assetId: string) => ({
  version: 1 as const,
  id: 'reference',
  assetId,
  pose: IDENTITY_POSE,
  scale: [1, 1, 1] as const
})
function project(source: VisualSourceRecord) {
  return {
    document: {
      version: '1.0.0',
      sceneTree: {
        workspace: '',
        workspaceList: [],
        elements: {
          candidate: { id: 'candidate', type: ComponentTypes.CANDIDATE },
          body: {
            id: 'body',
            parentId: 'candidate',
            type: ComponentTypes.BODY,
            props: { [PropertyNames.BODY]: 'body-props' }
          }
        }
      },
      props: {
        'body-props': {
          [PropertyFields.BODY]: { visuals: [binding(source.assetId)] }
        }
      }
    },
    loadIssues: [],
    visualSources: [source]
  }
}

it('roundtrips original source records and deduplicates current reference identities', async () => {
  const source = await retainedSource(),
    input = project(source)
  expect(projectVisualAssetIds(input)).toEqual([source.assetId])
  const decoded = decodeProject(encodeProject(input))
  expect(decoded).toEqual(input)
  expect(decoded.visualSources).not.toBe(input.visualSources)
})

it('rejects missing or malformed visual sources at both native encode and decode boundaries', async () => {
  const input = project(await retainedSource())
  for (const invalid of [
    { ...input, visualSources: undefined },
    { ...input, visualSources: [] },
    {
      ...input,
      visualSources: [{ ...input.visualSources[0], base64: 'invalid' }]
    },
    {
      ...input,
      visualSources: [input.visualSources[0], input.visualSources[0]]
    }
  ]) {
    expect(() => encodeProject(invalid)).toThrow()
    expect(() =>
      decodeProject(
        JSON.stringify({ format: 'sim-project', version: 1, ...invalid })
      )
    ).toThrow()
  }
})

it('requires visual sources used only by immutable historical runs', async () => {
  const source = await retainedSource(),
    example = createSyntheticExample()
  example.workcell.bodies[0].visuals = [binding(source.assetId)]
  const draft = createSyntheticExperimentDraft(example)
  const snapshot = historicalProxyFixture({
    snapshotId: 'snapshot',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  const run = {
    version: 1 as const,
    name: 'Historical source',
    retainedAt: '2026-09-05T00:00:00Z',
    environment: {
      appVersion: 'test',
      userAgent: 'unit test',
      hardwareConcurrency: 1
    },
    snapshot,
    result: terminalAnalysisResult(snapshot, [], {
      runId: 'run',
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled'
    })
  }
  const input = {
    document: {
      version: '1.0.0',
      sceneTree: { workspace: '', workspaceList: [], elements: {} },
      props: {}
    },
    loadIssues: [],
    runs: [run],
    visualSources: [source]
  }
  expect(projectVisualAssetIds(input)).toEqual([source.assetId])
  expect(decodeProject(encodeProject(input)).visualSources).toEqual([source])
  expect(() => encodeProject({ ...input, visualSources: [] })).toThrow(
    'Missing visual source'
  )
  const prepared = await prepareProjectVisuals(input, {
    decode: decodeRestrictedGlb,
    dispose: () => undefined
  })
  expect(prepared.get(source.assetId)).toBeDefined()
  prepared.dispose()
  const rejected = { decode: decodeRestrictedGlb, dispose: vi.fn() }
  await expect(
    prepareProjectVisuals({ ...input, visualSources: [] }, rejected)
  ).rejects.toThrow('Missing visual source')
  expect(rejected.dispose).toHaveBeenCalledOnce()
})
