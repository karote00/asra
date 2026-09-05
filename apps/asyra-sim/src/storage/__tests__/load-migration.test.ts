import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { decodeProject, encodeProject } from '../project-format'
import { IndexedProjectRepository } from '../indexed-db'
import { ComponentTypes, PropertyTypes } from '../../constants'
import { observationProject } from './observation-fixture'
import { previewTrajectoryJson } from '../trajectory-import'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'

const legacyTypes = [
  [
    'asyra-sim-body',
    'sim-body',
    'asyra-sim-body-properties',
    'sim-body-properties'
  ],
  [
    'asyra-sim-candidate',
    'sim-candidate',
    'asyra-sim-candidate-properties',
    'sim-candidate-properties'
  ],
  [
    'asyra-sim-experiment',
    'sim-experiment',
    'asyra-sim-experiment-properties',
    'sim-experiment-properties'
  ],
  [
    'asyra-sim-run-reference',
    'sim-run-reference',
    'asyra-sim-run-reference-properties',
    'sim-run-reference-properties'
  ]
] as const

describe('project identity migration at the load boundary', () => {
  it('accepts the old trajectory envelope without guessing versions or changing joints', () => {
    const { workcell, trajectory } = createSyntheticExample()
    const source = {
      version: 1,
      timeUnit: 's',
      jointUnits: Object.fromEntries(
        workcell.bodies
          .filter((body) => body.joint.kind === 'revolute')
          .map((body) => [body.id, 'rad'])
      ),
      keyframes: trajectory.keyframes
    }
    const legacy = JSON.stringify({
      format: 'asyra-sim-trajectory',
      version: 1,
      source
    })
    const current = JSON.stringify({
      format: 'sim-trajectory',
      version: 1,
      source
    })
    const result = previewTrajectoryJson(legacy, workcell)
    expect(result.diagnostics).toEqual([])
    expect(result.value).toEqual(previewTrajectoryJson(current, workcell).value)
    expect(
      previewTrajectoryJson(
        legacy.replace('"version":1', '"version":2'),
        workcell
      ).value
    ).toBeNull()
  })

  it('does not skip invalid original source bindings on legacy body types', () => {
    const input = JSON.parse(JSON.stringify(observationProject([], [])))
    input.document.sceneTree.elements.body = {
      id: 'body',
      type: 'asyra-sim-body',
      parentId: 'candidate',
      props: { body: 'body-props' }
    }
    input.document.props['body-props'] = {
      bodyParameters: { visuals: 'invalid' }
    }
    expect(() =>
      decodeProject(
        JSON.stringify({ format: 'asyra-sim-project', version: 1, ...input })
      )
    ).toThrow('Invalid canonical visual bindings')
  })
  it('uses only neutral component and property types for new documents', () => {
    expect(Object.values(ComponentTypes)).toEqual(
      legacyTypes.map((entry) => entry[1])
    )
    expect(Object.values(PropertyTypes)).toEqual(
      legacyTypes.map((entry) => entry[3])
    )
  })

  it('normalizes known persisted types without rewriting user data or immutable evidence', () => {
    const original = observationProject([], [])
    const stored = JSON.parse(JSON.stringify(original))
    stored.document.sceneTree.elements.candidate.type = 'asyra-sim-candidate'
    stored.document.sceneTree.elements.retained.type = 'asyra-sim-run-reference'
    stored.document.props['retained-props'].type =
      'asyra-sim-run-reference-properties'
    stored.document.props.extra = {
      type: 'asyra-sim-body-properties',
      note: 'asyra-sim-body'
    }
    stored.document.sceneTree.elements.body = {
      type: 'asyra-sim-body',
      name: 'asyra-sim-body'
    }
    stored.document.sceneTree.elements.study = { type: 'asyra-sim-experiment' }
    stored.document.props.study = { type: 'asyra-sim-experiment-properties' }
    stored.document.props.candidate = { type: 'asyra-sim-candidate-properties' }
    const text = JSON.stringify({
      format: 'asyra-sim-project',
      version: 1,
      ...stored
    })
    const decoded = decodeProject(text)
    const document = decoded.document as typeof stored.document
    expect(document.sceneTree.elements.candidate.type).toBe('sim-candidate')
    expect(document.sceneTree.elements.retained.type).toBe('sim-run-reference')
    expect(document.sceneTree.elements.body).toEqual({
      type: 'sim-body',
      name: 'asyra-sim-body'
    })
    expect(document.sceneTree.elements.study.type).toBe('sim-experiment')
    expect(document.props.extra).toEqual({
      type: 'sim-body-properties',
      note: 'asyra-sim-body'
    })
    expect(document.props['retained-props'].type).toBe(
      'sim-run-reference-properties'
    )
    expect(document.props.study.type).toBe('sim-experiment-properties')
    expect(document.props.candidate.type).toBe('sim-candidate-properties')
    expect(decoded.runs).toEqual(stored.runs)
    expect(decoded.loadIssues).toEqual(stored.loadIssues)
    expect(decoded.observationSources).toEqual(stored.observationSources)
    expect(JSON.stringify(decoded.runs)).toBe(JSON.stringify(stored.runs))
    expect(JSON.parse(text).document.sceneTree.elements.body.type).toBe(
      'asyra-sim-body'
    )
    const saved = encodeProject(decoded)
    expect(JSON.parse(saved).format).toBe('sim-project')
    expect(decodeProject(saved)).toEqual(decoded)
  })

  it('validates retained legacy references instead of silently skipping them', () => {
    const stored = observationProject([], [])
    const text = JSON.stringify({
      format: 'asyra-sim-project',
      version: 1,
      ...stored,
      runs: []
    })
      .replaceAll(ComponentTypes.CANDIDATE, 'asyra-sim-candidate')
      .replaceAll(ComponentTypes.RUN_REFERENCE, 'asyra-sim-run-reference')
    expect(() => decodeProject(text)).toThrow('Missing or mismatched evidence')
    expect(() =>
      decodeProject(text.replace('"version":1', '"version":2'))
    ).toThrow('Unsupported')
  })

  it('keeps the explicitly selected existing database readable without moving or deleting its data', async () => {
    const factory = new IDBFactory()
    const first = new IndexedProjectRepository(factory, 'asyra-sim-local-v1')
    const input = {
      id: 'existing',
      name: 'Existing project',
      revision: 'one',
      savedAt: '2026-09-06T00:00:00.000Z',
      payload: JSON.stringify({
        format: 'asyra-sim-project',
        version: 1,
        ...observationProject([], [])
      })
    }
    await first.write(input, null)
    first.close()
    const second = new IndexedProjectRepository(factory, 'asyra-sim-local-v1')
    try {
      expect(await second.read(input.id)).toEqual(input)
      expect((await second.list()).projects[0].id).toBe(input.id)
      expect(decodeProject((await second.read(input.id)).payload).runs).toEqual(
        observationProject([], []).runs
      )
    } finally {
      second.close()
    }
  })
})
