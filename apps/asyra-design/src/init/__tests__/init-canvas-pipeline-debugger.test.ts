import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as canvasPipelineDebugger from '@asyra/core/canvas-pipeline-debugger'
import core from '../../contexts'
import {
  destroyCanvasPipelineDebugger,
  getActiveCanvasPipelineDebugger,
  initCanvasPipelineDebugger
} from '../diagnostics/init-canvas-pipeline-debugger'

describe('initCanvasPipelineDebugger', () => {
  beforeEach(() => {
    destroyCanvasPipelineDebugger()
    vi.restoreAllMocks()
  })

  it('creates a disabled DEV runtime handle independently from E2E helpers', async () => {
    const create = vi.spyOn(
      canvasPipelineDebugger,
      'createCanvasPipelineDebugger'
    )
    const handle = await initCanvasPipelineDebugger()

    expect(create).toHaveBeenCalledWith(core, { enabled: false })
    expect(handle?.isEnabled()).toBe(false)
    expect(getActiveCanvasPipelineDebugger()).toBe(handle)
  })

  it('disposes the previous handle on reinitialization and explicit cleanup', async () => {
    const first = await initCanvasPipelineDebugger()
    if (!first) throw new Error('expected first debugger handle')
    const disposeFirst = vi.spyOn(first, 'dispose')

    const second = await initCanvasPipelineDebugger()

    expect(disposeFirst).toHaveBeenCalledOnce()
    expect(getActiveCanvasPipelineDebugger()).toBe(second)
    if (!second) throw new Error('expected second debugger handle')
    const disposeSecond = vi.spyOn(second, 'dispose')

    destroyCanvasPipelineDebugger()

    expect(disposeSecond).toHaveBeenCalledOnce()
    expect(getActiveCanvasPipelineDebugger()).toBeUndefined()
  })
})
