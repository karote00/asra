import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitDiagnosticCounter,
  type DiagnosticCounterSink
} from '../diagnostic-counter'

const runtimeGlobal = globalThis as typeof globalThis & {
  __asyraDiagnosticCounterSink?: DiagnosticCounterSink
}

const previousSink = runtimeGlobal.__asyraDiagnosticCounterSink

afterEach(() => {
  runtimeGlobal.__asyraDiagnosticCounterSink = previousSink
})

describe('emitDiagnosticCounter', () => {
  it('forwards explicit and default counter increments', () => {
    const sink = vi.fn<DiagnosticCounterSink>()
    runtimeGlobal.__asyraDiagnosticCounterSink = sink

    emitDiagnosticCounter('default')
    emitDiagnosticCounter('explicit', 3)

    expect(sink).toHaveBeenNthCalledWith(1, 'default', 1)
    expect(sink).toHaveBeenNthCalledWith(2, 'explicit', 3)
  })
})
