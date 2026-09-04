// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../analysis/snapshot'
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import { terminalAnalysisResult } from '../../analysis/result'
import {
  AnalysisResultView,
  isPresentedRunStale
} from '../analysis-result-view'

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
    expect(host.textContent).toContain('Condition 1.1 · unknown')
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
    ).toContain(`${a?.name} / ${b?.name}`)
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
