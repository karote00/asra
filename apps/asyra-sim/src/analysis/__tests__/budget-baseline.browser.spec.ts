import { expect, test } from '@playwright/test'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import {
  DEFAULT_EXPERIMENT_BUDGET,
  EXPERIMENT_RESOURCE_PROFILE
} from '../contracts'
import { createExperimentSnapshot } from '../snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../methods/official-method'
import type { AnalysisResult } from '../result'

for (const maxIntervals of [2000, DEFAULT_EXPERIMENT_BUDGET.maxIntervals]) {
  test(`the public six-axis workcell preserves bounded evidence at ${maxIntervals} intervals`, async ({
    page
  }, info) => {
    test.setTimeout(45000)
    const example = createSyntheticExample(),
      draft = createSyntheticExperimentDraft(example)
    const input = createExperimentSnapshot({
      snapshotId: 'budget-baseline',
      candidateId: 'candidate',
      experimentId: 'experiment',
      workcell: example.workcell,
      definition: {
        ...draft,
        revision: 1,
        rule: { ...draft.rule, revision: 1 },
        budget: { ...DEFAULT_EXPERIMENT_BUDGET, maxIntervals }
      },
      methods: [OFFICIAL_CLEARANCE_METHOD],
      acknowledgedWarningCodes: []
    })
    await page.goto('/')
    await expect(page.getByRole('status')).toHaveText('Local runtime ready')
    const measured = await page.evaluate(
      async ({ snapshot, moduleUrl }) => {
        const { AnalysisRunner } = await import(moduleUrl),
          runner = new AnalysisRunner()
        const started = performance.now()
        let ticks = 0,
          previous = started,
          maxTickDelayMs = 0
        const timer = setInterval(() => {
          const now = performance.now()
          maxTickDelayMs = Math.max(maxTickDelayMs, now - previous - 50)
          previous = now
          ticks++
        }, 50)
        try {
          const result: AnalysisResult = await runner.run(snapshot)
          return {
            elapsedMs: performance.now() - started,
            ticks,
            maxTickDelayMs,
            execution: result.execution,
            coverage: result.coverage,
            verdict: result.verdict,
            totalPairs: result.totalPairCount,
            receivedPairs: result.coveredPairCount,
            findingPairs: result.findingPairCount,
            unresolvedPairs: result.unresolvedPairCount,
            evaluations: result.pairEvidence.reduce(
              (total, pair) => total + pair.evidence.evaluations,
              0
            ),
            leaves: result.pairEvidence.reduce(
              (total, pair) => total + pair.evidence.leaves.length,
              0
            ),
            errors: result.errors
          }
        } finally {
          clearInterval(timer)
          await runner.dispose()
        }
      },
      { snapshot: input, moduleUrl: '/src/analysis/runner.ts' }
    )
    const evidence = {
      baseURL: info.project.use.baseURL,
      profile: 'public-six-axis-example',
      budget: input.budget,
      bodies: input.workcell.bodies.length,
      keyframes: input.trajectory.keyframes.length,
      ...measured
    }
    await info.attach('budget-baseline.json', {
      contentType: 'application/json',
      body: JSON.stringify(evidence)
    })
    expect(measured.execution).not.toBe('failed')
    expect(measured.elapsedMs).toBeLessThan(input.budget.maxDurationMs + 5000)
    expect(measured.totalPairs).toBe(input.pairs.length)
    expect(measured.receivedPairs).toBeLessThanOrEqual(input.pairs.length)
    expect(measured.evaluations).toBeLessThanOrEqual(maxIntervals)
    expect(measured.leaves).toBeLessThanOrEqual(
      EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves
    )
    if (maxIntervals === DEFAULT_EXPERIMENT_BUDGET.maxIntervals) {
      expect(measured.coverage).toBe('complete')
      expect(measured.receivedPairs).toBe(input.pairs.length)
      expect(measured.unresolvedPairs).toBe(0)
    }
    if (measured.coverage === 'partial')
      expect(measured.verdict).not.toBe('meets')
    if (measured.elapsedMs > 500) expect(measured.ticks).toBeGreaterThan(0)
  })
}
