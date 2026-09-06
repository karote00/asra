import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { OFFICIAL_CLEARANCE_METHOD } from '../../../analysis/methods/official-method'
import { terminalAnalysisResult } from '../../../analysis/result'
import { createExperimentSnapshot } from '../../../analysis/snapshot'
import { AnalysisResultView } from '../analysis-result-view'

it('renders supported large historical evidence without argument overflow or eagerly mounting every interval', () => {
  const example = createSyntheticExample()

  const draft = createSyntheticExperimentDraft(example)

  const snapshot = createExperimentSnapshot({
    snapshotId: 'large',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })

  const count = 150000

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
          leaves: Array.from({ length: count }, (_, index) => ({
            start: (8 * index) / count,
            end: (8 * (index + 1)) / count,
            lower: 1,
            upper: 1,
            witnessTime: (8 * index) / count,
            penetration: false,
            state: 'clear',
            reason: 'Analytical partition evidence'
          }))
        }
      }
    ],
    {
      runId: 'large-run',
      startedAt: 0,
      endedAt: 1,
      execution: 'cancelled',
      error: 'Other pairs were cancelled'
    }
  )

  const text = renderToStaticMarkup(
    createElement(AnalysisResultView, {
      run: { snapshot, result },
      stale: false,
      onReplay: () => undefined
    })
  )

  expect(text).toContain('150000 intervals')

  expect(text.length).toBeLessThan(20000)

  expect(text).toContain('1000.000 mm')

  expect(text).toContain(
    `${snapshot.pairs.length - 1} pairs have no retained evidence`
  )
})
