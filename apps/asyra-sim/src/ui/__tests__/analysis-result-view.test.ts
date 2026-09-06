// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import { terminalAnalysisResult } from '../../analysis/result'
import { IDENTITY_POSE } from '../../domain/math'
import { resolvePartWorkcell } from '../../domain/part-geometry'
import { ORIGINAL_PART_METHOD } from '../../analysis/methods/original-part-method'
import {
  AnalysisResultView,
  isPresentedRunStale
} from '../analysis-result-view'

it('compares v2 results using actual source identity and placement, not retired primitive geometry', () => {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example),
    assetId = 'a'.repeat(64)
  example.workcell.bodies[0].visuals = [
    { version: 1, id: 'part', assetId, pose: IDENTITY_POSE, scale: [1, 1, 1] }
  ]
  const source = {
    source: { sha256: assetId },
    meshes: [
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
        indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
      }
    ]
  }
  draft.method = {
    ...draft.method,
    id: ORIGINAL_PART_METHOD.id,
    version: ORIGINAL_PART_METHOD.version
  }
  const snapshot = createExperimentSnapshot({
    snapshotId: 'parts',
    candidateId: 'candidate',
    experimentId: 'experiment',
    workcell: resolvePartWorkcell(
      example.workcell,
      new Map([[assetId, source]])
    ),
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [ORIGINAL_PART_METHOD],
    acknowledgedWarningCodes: []
  })
  const run = {
    snapshot,
    result: terminalAnalysisResult(snapshot, [], {
      runId: 'parts-result',
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled'
    })
  }
  expect(isPresentedRunStale(run, example.workcell, draft)).toBe(false)
  const changed = structuredClone(example.workcell)
  const part = changed.bodies[0].visuals?.[0]
  if (!part) throw new Error('Missing original source binding')
  part.scale = [2, 1, 1]
  expect(isPresentedRunStale(run, changed, draft)).toBe(true)
  part.scale = [1, 1, 1]
  part.assetId = 'b'.repeat(64)
  expect(isPresentedRunStale(run, changed, draft)).toBe(true)
})

it('tracks geometric input changes while preserving frozen replay and partial lower bounds', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const descriptor = structuredClone(INSTALLED_METHOD_CATALOG.descriptors[0])
  draft.rule.acceptance = {
    kind: 'all',
    conditions: [
      { kind: 'clearance', operator: 'above', value: 0.02 },
      { kind: 'penetration', expected: 'absent' }
    ]
  }
  descriptor.manifest.validation.evidence = 'Retained local validation evidence'
  const snapshot = createExperimentSnapshot({
    snapshotId: 'snapshot',
    candidateId: 'candidate',
    experimentId: 'experiment',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [descriptor],
    acknowledgedWarningCodes: []
  })
  descriptor.manifest.validation.evidence = 'Changed after the run'
  const result = terminalAnalysisResult(
    snapshot,
    [
      {
        pairId: snapshot.pairs[0].id,
        evidence: {
          coverage: 'complete',
          lower: 1,
          upper: 1,
          evaluations: 1,
          leaves: [
            {
              start: 0,
              end: 8,
              lower: 1,
              upper: 1,
              witnessTime: 4,
              penetration: false,
              state: 'clear',
              reason: 'Independent test evidence'
            }
          ]
        }
      }
    ],
    {
      runId: 'run',
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Cancelled'
    }
  )
  const run = { snapshot, result }
  expect(isPresentedRunStale(run, example.workcell, draft)).toBe(false)
  const edited = structuredClone(example.workcell)
  edited.bodies[0].name = 'New display name'
  edited.bodies[0].color = 123
  expect(isPresentedRunStale(run, edited, draft)).toBe(false)
  edited.bodies[0].pose = { ...edited.bodies[0].pose, position: [1, 0, 0] }
  expect(isPresentedRunStale(run, edited, draft)).toBe(true)
  const host = document.createElement('div'),
    root = createRoot(host),
    replay = vi.fn()
  try {
    await act(() =>
      root.render(
        createElement(AnalysisResultView, {
          run,
          stale: true,
          onReplay: replay
        })
      )
    )
    expect(host.textContent).toContain('Historical inputs differ')
    expect(host.textContent).toContain('Retained method declaration')
    expect(host.textContent).toContain('Retained local validation evidence')
    expect(host.textContent).not.toContain('Changed after the run')
    expect(host.textContent).toContain('User acceptance evaluation')
    expect(host.textContent).toContain('Condition 1.1 - unknown')
    expect(host.textContent).toContain('not a safety approval')
    expect(host.querySelector('[aria-label="User verdict"]')?.textContent).toBe(
      'User: cannot determine'
    )
    expect(host.textContent).toContain('Minimum lower bound0.000 mm')
    const a = snapshot.workcell.bodies.find(
        (body) => body.id === snapshot.pairs[0].a.bodyId
      ),
      b = snapshot.workcell.bodies.find(
        (body) => body.id === snapshot.pairs[0].b.bodyId
      )
    expect(
      host.querySelector('.evidence-pair > summary')?.textContent
    ).toContain(`${a?.name} - ${b?.name}`)
    const button = [...host.querySelectorAll('button')].find(
      (item) => item.textContent === 'Replay pair'
    )
    if (!button) throw new Error('Missing replay action')
    await act(() => button.click())
    expect(replay).toHaveBeenCalledWith(snapshot, 4, [
      snapshot.pairs[0].a.bodyId,
      snapshot.pairs[0].b.bodyId
    ])
    expect(snapshot.workcell.bodies[0].pose.position).not.toEqual([1, 0, 0])
  } finally {
    await act(() => root.unmount())
    vi.unstubAllGlobals()
  }
})
