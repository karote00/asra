import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitDiagnosticCounter,
  subscribeToDiagnosticCounters,
  type DiagnosticCounterSink
} from '../diagnostic-counter'

const disposers: (() => void)[] = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
})

describe('emitDiagnosticCounter', () => {
  it('forwards explicit and default counter increments', () => {
    const sink = vi.fn<DiagnosticCounterSink>()
    disposers.push(subscribeToDiagnosticCounters(sink))

    emitDiagnosticCounter('default')
    emitDiagnosticCounter('explicit', 3)

    expect(sink).toHaveBeenNthCalledWith(1, 'default', 1)
    expect(sink).toHaveBeenNthCalledWith(2, 'explicit', 3)
  })

  it('isolates diagnostic sink failures from product behavior', () => {
    disposers.push(
      subscribeToDiagnosticCounters(() => {
        throw new Error('diagnostic sink failed')
      })
    )

    expect(() => emitDiagnosticCounter('isolated')).not.toThrow()
  })
})
