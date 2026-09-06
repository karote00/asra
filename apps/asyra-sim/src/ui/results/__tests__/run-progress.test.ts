// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { AnalysisProgress } from '../../../analysis/runner'
import { RunProgress } from '../run-progress'

afterEach(() => {
  vi.useRealTimers()

  vi.unstubAllGlobals()
})

it('shows validated received counts without presenting them as coverage or a time estimate and releases polling', async () => {
  vi.useFakeTimers()

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const host = document.createElement('div')

  const root = createRoot(host)

  const progress: AnalysisProgress = {
    runId: 'run',
    snapshotId: 'snapshot',
    startedAt: 0,
    state: 'running',
    totalPairCount: 10,
    receivedPairCount: 2,
    evaluations: 150,
    evidenceLeafCount: 75
  }

  const analysis = { getProgress: vi.fn(() => progress) }

  const onCancel = vi.fn()

  try {
    await act(() =>
      root.render(
        createElement(RunProgress, {
          analysis,
          onCancel,
          snapshotId: 'snapshot',
          budget: { maxIntervals: 100000, maxDurationMs: 30000 }
        })
      )
    )

    expect(host.textContent).toContain('2 of 10 pair records')

    expect(host.textContent).toContain('150 / 100000')

    expect(host.textContent).toContain('30 s')

    expect(host.textContent).toContain('not a clearance conclusion')

    expect(host.textContent).toContain('No reliable time estimate')

    const cancel = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Cancel analysis'
    )

    await act(() => cancel?.click())

    expect(onCancel).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTime(99))

    expect(analysis.getProgress).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTime(1))

    expect(analysis.getProgress).toHaveBeenCalledTimes(2)
  } finally {
    await act(() => root.unmount())
  }

  expect(vi.getTimerCount()).toBe(0)
})

it('does not display an old snapshot as progress for a new run', async () => {
  vi.useFakeTimers()

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  const host = document.createElement('div')

  const root = createRoot(host)

  const analysis = {
    getProgress: () => ({ snapshotId: 'old' }) as AnalysisProgress
  }

  try {
    await act(() =>
      root.render(
        createElement(RunProgress, {
          analysis,
          onCancel: vi.fn(),
          snapshotId: 'new',
          budget: { maxIntervals: 100000, maxDurationMs: 30000 }
        })
      )
    )

    expect(host.textContent).toContain('Waiting for the analysis worker')

    expect(host.querySelector('progress')).toBeNull()
  } finally {
    await act(() => root.unmount())
  }
})
