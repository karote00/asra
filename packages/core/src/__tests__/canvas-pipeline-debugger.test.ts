import { describe, expect, it, vi } from 'vitest'
import { PropsManager } from '@asyra/props-manager'
import { Render, RenderContainer, RenderGraphics } from '@asyra/render'
import { Core } from '../core'
import { createCanvasPipelineDebugger } from '../canvas-pipeline-debugger'

const createCoreWithRender = (_name: string) => {
  const render = new Render()
  const registerLayer = vi.fn(render.registerLayer.bind(render))
  const unregisterLayer = vi.fn(render.unregisterLayer.bind(render))
  render.registerLayer = registerLayer
  render.unregisterLayer = unregisterLayer
  const core = new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToCommitCapture: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined)
    } as never,
    props: new PropsManager(),
    render,
    sceneTree: {} as never,
    selection: {} as never,
    systemContext: {} as never
  })
  return { core, render, registerLayer, unregisterLayer }
}

describe('Core Canvas Pipeline Debugger facade', () => {
  it('is disabled by default and preserves reads across disable', () => {
    const { core, render, registerLayer, unregisterLayer } =
      createCoreWithRender('core-debugger')
    const pipelineDebugger = createCanvasPipelineDebugger(core)

    expect(pipelineDebugger.isEnabled()).toBe(false)
    expect(registerLayer).not.toHaveBeenCalled()

    pipelineDebugger.enable()
    render.panTo(3, 4)
    pipelineDebugger.disable()

    expect(registerLayer).toHaveBeenCalledTimes(1)
    expect(unregisterLayer).toHaveBeenCalledTimes(1)
    expect(pipelineDebugger.isEnabled()).toBe(false)
    expect(pipelineDebugger.getTrace()).toHaveLength(1)
    expect(pipelineDebugger.getSnapshot().viewport).toMatchObject({
      operation: 'pan'
    })
  })

  it('keeps a hidden overlay unregistered while observation remains active', () => {
    const { core, render, registerLayer, unregisterLayer } =
      createCoreWithRender('hidden-debugger')
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      overlay: { visible: false }
    })

    pipelineDebugger.enable()
    render.zoomTo(2)

    expect(registerLayer).not.toHaveBeenCalled()
    expect(pipelineDebugger.getTrace()).toHaveLength(1)

    pipelineDebugger.setOverlayVisible(true)
    expect(registerLayer).toHaveBeenCalledTimes(1)

    pipelineDebugger.setOverlayVisible(false)
    expect(unregisterLayer).toHaveBeenCalledTimes(1)
    expect(pipelineDebugger.isEnabled()).toBe(true)
  })

  it('retries showing the overlay after a transient registration failure', () => {
    const { core, registerLayer } = createCoreWithRender(
      'overlay-registration-retry'
    )
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true,
      overlay: { visible: false }
    })
    registerLayer.mockImplementationOnce(() => {
      throw new Error('overlay registration failed')
    })

    expect(() => pipelineDebugger.setOverlayVisible(true)).toThrow(
      'overlay registration failed'
    )
    expect(registerLayer).toHaveBeenCalledOnce()

    expect(() => pipelineDebugger.setOverlayVisible(true)).not.toThrow()
    expect(registerLayer).toHaveBeenCalledTimes(2)
    pipelineDebugger.dispose()
  })

  it('requests an overlay frame when focused element ids change', () => {
    const { core, render } = createCoreWithRender('focused-debugger')
    const requestRender = vi.spyOn(render, 'requestRender')
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true
    })
    requestRender.mockClear()

    pipelineDebugger.setFocusedElementIds(['element-a', 'element-a'])

    expect(requestRender).toHaveBeenCalledOnce()
  })

  it('rejects duplicate sessions and permits recreation after disposal', () => {
    const { core } = createCoreWithRender('duplicate-debugger')
    const first = createCanvasPipelineDebugger(core)

    expect(() => createCanvasPipelineDebugger(core)).toThrow(
      expect.objectContaining({
        code: 'CANVAS_PIPELINE_DEBUGGER_ALREADY_ACTIVE'
      })
    )

    first.dispose()

    const recreated = createCanvasPipelineDebugger(core)
    expect(recreated.isEnabled()).toBe(false)
    recreated.dispose()
  })

  it('cleans an enabled session and rejects non-dispose calls afterward', () => {
    const { core, unregisterLayer } = createCoreWithRender('dispose-debugger')
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true,
      traceCapacity: 4,
      overlay: { focusedElementIds: ['element-a'] }
    })

    pipelineDebugger.dispose()
    pipelineDebugger.dispose()

    expect(unregisterLayer).toHaveBeenCalledTimes(1)
    expect(() => pipelineDebugger.isEnabled()).toThrow(
      expect.objectContaining({ code: 'CANVAS_PIPELINE_DEBUGGER_DISPOSED' })
    )
    expect(() => pipelineDebugger.getTrace()).toThrow(
      expect.objectContaining({ code: 'CANVAS_PIPELINE_DEBUGGER_DISPOSED' })
    )
  })

  it('keeps an immediate re-enable active after fault cleanup runs', async () => {
    const { core, render } = createCoreWithRender('fault-re-enable')
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true
    })

    render.addContainer({
      label: 'faulting-container',
      get diagnosticOnly() {
        throw new Error('diagnostic normalization failed')
      }
    } as never)
    expect(pipelineDebugger.isEnabled()).toBe(false)

    pipelineDebugger.enable()
    await Promise.resolve()
    const traceCount = pipelineDebugger.getTrace().length
    render.panTo(7, 8)

    expect(pipelineDebugger.isEnabled()).toBe(true)
    expect(pipelineDebugger.getTrace()).toHaveLength(traceCount + 1)
  })

  it('records an overlay fault before disabling and cleaning the session', async () => {
    const { core, registerLayer, unregisterLayer } = createCoreWithRender(
      'overlay-fault-read-model'
    )
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true
    })
    const registration = registerLayer.mock.calls[0]?.[0]
    const root = registration?.layer as RenderContainer
    const graphics = root.children[0] as RenderGraphics
    graphics.clear = vi.fn(() => {
      throw new Error('overlay graphics update failed')
    })

    expect(registration?.update?.()).toBe(false)
    expect(pipelineDebugger.isEnabled()).toBe(false)
    expect(pipelineDebugger.getSnapshot().fault).toEqual({
      message: 'overlay graphics update failed'
    })

    await Promise.resolve()

    expect(unregisterLayer).toHaveBeenCalledOnce()
    expect(pipelineDebugger.getSnapshot().fault).toEqual({
      message: 'overlay graphics update failed'
    })
    pipelineDebugger.dispose()
  })

  it('releases the session even when overlay unregistration throws', () => {
    const { core, unregisterLayer } = createCoreWithRender(
      'cleanup-failure-debugger'
    )
    const pipelineDebugger = createCanvasPipelineDebugger(core, {
      enabled: true
    })
    unregisterLayer.mockImplementationOnce(() => {
      throw new Error('overlay unregistration failed')
    })

    expect(() => pipelineDebugger.dispose()).toThrow(
      'overlay unregistration failed'
    )
    expect(() => pipelineDebugger.isEnabled()).toThrow(
      expect.objectContaining({ code: 'CANVAS_PIPELINE_DEBUGGER_DISPOSED' })
    )

    const recreated = createCanvasPipelineDebugger(core)
    expect(recreated.isEnabled()).toBe(false)
    recreated.dispose()
  })
})
