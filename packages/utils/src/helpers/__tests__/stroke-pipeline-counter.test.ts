import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitStrokePipelineCounter,
  type StrokePipelineCounterSink
} from '../stroke-pipeline-counter'

const runtimeGlobal = globalThis as typeof globalThis & {
  __asyraStrokePipelineCounterSink?: StrokePipelineCounterSink
}

const previousSink = runtimeGlobal.__asyraStrokePipelineCounterSink

afterEach(() => {
  runtimeGlobal.__asyraStrokePipelineCounterSink = previousSink
})

describe('emitStrokePipelineCounter', () => {
  it('forwards explicit and default counter increments', () => {
    const sink = vi.fn<StrokePipelineCounterSink>()
    runtimeGlobal.__asyraStrokePipelineCounterSink = sink

    emitStrokePipelineCounter('default')
    emitStrokePipelineCounter('explicit', 3)

    expect(sink).toHaveBeenNthCalledWith(1, 'default', 1)
    expect(sink).toHaveBeenNthCalledWith(2, 'explicit', 3)
  })
})
