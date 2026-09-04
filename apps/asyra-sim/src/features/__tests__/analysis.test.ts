import { expect, it, vi } from 'vitest'
import core from '@asyra/core'
import type { ExperimentSnapshot } from '../../analysis/contracts'
import type { AnalysisResult } from '../../analysis/result'
import { installAnalysisFeature } from '../analysis'

it('runs one detached experiment with a Feature-owned signal and supports cancellation', async () => {
  let captured:
    { snapshot: ExperimentSnapshot; signal: AbortSignal } | undefined
  const service = {
    isRunning: vi.fn(() => false),
    run: vi.fn(
      async (snapshot: ExperimentSnapshot, signal: AbortSignal) =>
        new Promise<AnalysisResult>((resolve) => {
          captured = { snapshot, signal }
          signal.addEventListener(
            'abort',
            () => resolve({ execution: 'cancelled' } as AnalysisResult),
            { once: true }
          )
        })
    ),
    dispose: vi.fn(async () => undefined)
  }
  const api = installAnalysisFeature(core, service)
  const external = new AbortController()
  const snapshot = {
    snapshotId: 'original-snapshot'
  } as ExperimentSnapshot
  const pending = api.run(snapshot, { signal: external.signal })
  snapshot.snapshotId = 'mutated-after-call'
  await vi.waitFor(() => expect(captured).toBeDefined())
  expect(captured?.snapshot.snapshotId).toBe('original-snapshot')
  expect(captured?.signal).not.toBe(external.signal)
  expect(api.cancel()).toBe(true)
  await expect(pending).resolves.toMatchObject({ execution: 'cancelled' })
})
