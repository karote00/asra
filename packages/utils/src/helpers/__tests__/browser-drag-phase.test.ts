import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase,
  type BrowserDragPhaseSink
} from '../browser-drag-phase'

const browserDragPhaseGlobal = globalThis as typeof globalThis & {
  __asyraBrowserDragPhaseSink?: BrowserDragPhaseSink
}

afterEach(() => {
  delete browserDragPhaseGlobal.__asyraBrowserDragPhaseSink
  vi.restoreAllMocks()
})

describe('browser drag phase measurement', () => {
  it('runs synchronously without measuring when no sink is installed', () => {
    expect(measureBrowserDragPhase('phase', () => 'result')).toBe('result')
  })

  it('reports the synchronous phase duration even when the action throws', () => {
    const sink = vi.fn<BrowserDragPhaseSink>()
    browserDragPhaseGlobal.__asyraBrowserDragPhaseSink = sink
    vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(16)

    expect(() =>
      measureBrowserDragPhase('sync-phase', () => {
        throw new Error('failure')
      })
    ).toThrow('failure')
    expect(sink).toHaveBeenCalledWith('sync-phase', 6)
  })

  it('reports the asynchronous phase duration after the action settles', async () => {
    const sink = vi.fn<BrowserDragPhaseSink>()
    browserDragPhaseGlobal.__asyraBrowserDragPhaseSink = sink
    vi.spyOn(performance, 'now').mockReturnValueOnce(20).mockReturnValueOnce(29)

    await expect(
      measureBrowserDragAsyncPhase('async-phase', async () => 'result')
    ).resolves.toBe('result')
    expect(sink).toHaveBeenCalledWith('async-phase', 9)
  })

  it('reports the asynchronous phase duration when the action rejects', async () => {
    const sink = vi.fn<BrowserDragPhaseSink>()
    browserDragPhaseGlobal.__asyraBrowserDragPhaseSink = sink
    vi.spyOn(performance, 'now').mockReturnValueOnce(30).mockReturnValueOnce(42)

    await expect(
      measureBrowserDragAsyncPhase('rejected-phase', async () => {
        throw new Error('failure')
      })
    ).rejects.toThrow('failure')
    expect(sink).toHaveBeenCalledWith('rejected-phase', 12)
  })
})
