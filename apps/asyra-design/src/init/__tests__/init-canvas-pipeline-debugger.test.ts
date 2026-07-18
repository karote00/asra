import { beforeEach, describe, expect, it, vi } from 'vitest'

const { core, createCanvasPipelineDebugger, handles } = vi.hoisted(() => {
  const handles: { dispose: ReturnType<typeof vi.fn> }[] = []
  return {
    core: { name: 'app-core' },
    handles,
    createCanvasPipelineDebugger: vi.fn(() => {
      const handle = { dispose: vi.fn() }
      handles.push(handle)
      return handle
    })
  }
})

vi.mock('../../contexts', () => ({ default: core }))
vi.mock('@asyra/core/canvas-pipeline-debugger', () => ({
  createCanvasPipelineDebugger
}))

import {
  destroyCanvasPipelineDebugger,
  initCanvasPipelineDebugger
} from '../diagnostics/init-canvas-pipeline-debugger'

describe('initCanvasPipelineDebugger', () => {
  beforeEach(() => {
    destroyCanvasPipelineDebugger()
    createCanvasPipelineDebugger.mockClear()
    handles.length = 0
    delete window.__AsyraCanvasPipelineDebugger__
  })

  it('creates a disabled DEV runtime handle independently from E2E helpers', async () => {
    window.__AsyraE2E__ = {
      elementApis: {} as never,
      strokeApis: {} as never
    }

    const handle = await initCanvasPipelineDebugger()

    expect(createCanvasPipelineDebugger).toHaveBeenCalledWith(core, {
      enabled: false
    })
    expect(handle).toBe(handles[0])
    expect(window.__AsyraCanvasPipelineDebugger__).toBe(handles[0])
    expect(window.__AsyraE2E__).toBeDefined()
  })

  it('disposes the previous handle on reinitialization and explicit cleanup', async () => {
    await initCanvasPipelineDebugger()
    const first = handles[0]

    const reinitialization = initCanvasPipelineDebugger()

    expect(first.dispose).toHaveBeenCalledOnce()
    expect(window.__AsyraCanvasPipelineDebugger__).toBeUndefined()

    await reinitialization

    expect(window.__AsyraCanvasPipelineDebugger__).toBe(handles[1])

    destroyCanvasPipelineDebugger()

    expect(handles[1].dispose).toHaveBeenCalledOnce()
    expect(window.__AsyraCanvasPipelineDebugger__).toBeUndefined()
  })
})
