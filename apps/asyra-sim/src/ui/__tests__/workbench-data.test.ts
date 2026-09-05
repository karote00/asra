// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import type { SimRuntime } from '../../init/bootstrap'
import { useWorkbenchData } from '../workbench-data'

it('invalidates retained UI data on candidate, revision and runtime identity without hiding owner errors', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'),
    root = createRoot(host)
  const model = createSyntheticExample().workcell
  const first = {
    getCandidates: () => [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ],
    getLoadIssues: () => [],
    getHistoryDepth: () => 1,
    getRuns: vi.fn(() => []),
    getWorkcell: vi.fn(() => structuredClone(model))
  }
  let snapshot: ReturnType<typeof useWorkbenchData> | undefined
  function View({
    runtime,
    candidateId,
    revision
  }: {
    runtime: SimRuntime | null
    candidateId: string
    revision: number
  }) {
    snapshot = useWorkbenchData(runtime, candidateId, revision)
    return null
  }
  const render = (runtime: unknown, candidateId = 'a', revision = 1) =>
    act(() =>
      root.render(
        createElement(View, {
          runtime: runtime as SimRuntime | null,
          candidateId,
          revision
        })
      )
    )
  try {
    await render(first)
    const original = snapshot
    await render(first)
    expect(snapshot).toBe(original)
    expect(first.getWorkcell).toHaveBeenCalledTimes(1)
    await render(first, 'b')
    expect(first.getWorkcell).toHaveBeenLastCalledWith('b')
    first.getRuns.mockImplementation(() => {
      throw new Error('Run archive unavailable')
    })
    await render(first, 'b', 2)
    expect(snapshot?.runError).toContain('Run archive unavailable')
    await render(first, 'b', 2)
    expect(first.getRuns).toHaveBeenCalledTimes(3)
    const successor = {
      ...first,
      getRuns: () => [],
      getWorkcell: vi.fn(() => ({ ...model, bodies: [] }))
    }
    await render(successor, 'b', 2)
    expect(snapshot?.workcell?.bodies).toHaveLength(0)
    expect(snapshot?.runError).toBe('')
    await render(null)
    expect(snapshot?.workcell).toBeNull()
    expect(snapshot?.retainedRuns).toHaveLength(0)
    expect(snapshot?.historyDepth).toBe(0)
  } finally {
    await act(() => root.unmount())
    vi.unstubAllGlobals()
  }
})
