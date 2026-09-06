import { afterEach, describe, expect, it, vi } from 'vitest'
import * as runtime from '../index.js'
import render from '../render.js'
import { RenderGraphics } from '../types/render-object.js'
import type { RenderElementData } from '../types.js'
import sceneTree from '@asyra/scene-tree'

describe('Shared Render runtime lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    render.resetRuntime()
    runtime.resetSharedRenderRuntime?.()
    runtime.beginSharedRenderRuntime?.()
  })

  it('retires shared selections and interactions without removing strategy definitions', () => {
    runtime.renderSelectionStore.elementSelection.add('old')
    runtime.renderSelectionStore.vectorPointSelection.add('old-point')
    runtime.renderSelectionStore.vectorSegmentSelection.add('old-segment')
    runtime.interactionTargetRegistry.register(
      runtime.createRenderInteractionPointTarget({
        id: 'old-target',
        type: 'test',
        center: { x: 0, y: 0 },
        radius: 1
      })
    )
    runtime.renderInteractionHandlerRegistry.register('old-target', {
      eventType: 'pointerdown',
      handler: vi.fn()
    })
    const strategy = vi.fn()
    runtime.renderStrategyRegistry.register('retained-strategy', strategy)
    try {
      render.resetRuntime()
      runtime.resetSharedRenderRuntime()
      expect(runtime.renderSelectionStore.elementSelection.size).toBe(0)
      expect(runtime.renderSelectionStore.vectorPointSelection.size).toBe(0)
      expect(runtime.renderSelectionStore.vectorSegmentSelection.size).toBe(0)
      expect(
        runtime.interactionTargetRegistry.get('old-target')
      ).toBeUndefined()
      expect(runtime.renderInteractionHandlerRegistry.has('old-target')).toBe(
        false
      )
      expect(runtime.renderSceneTreeStore.getProjectionSnapshotCount()).toBe(0)
      expect(runtime.renderSceneTreeStore.hasPendingChanges()).toBe(false)
      expect(runtime.renderStrategyRegistry.get('retained-strategy')).toBe(
        strategy
      )
    } finally {
      runtime.renderStrategyRegistry.unregister('retained-strategy')
    }
  })

  it('reinstalls pending projection wiring and fences retained old layer callbacks', () => {
    render.resetRuntime()
    runtime.resetSharedRenderRuntime()
    const register = vi.spyOn(render, 'registerLayer')
    runtime.beginSharedRenderRuntime()
    const old = register.mock.calls[0]?.[0]
    if (!old) throw new Error('Missing pending projection layer')
    render.resetRuntime()
    runtime.resetSharedRenderRuntime()
    runtime.beginSharedRenderRuntime()
    expect(register).toHaveBeenCalledTimes(2)
    const current = register.mock.calls[1]?.[0]
    if (!current) throw new Error('Missing successor projection layer')
    const flush = vi
      .spyOn(runtime.renderSceneTreeStore, 'flushPendingChangesForFrame')
      .mockReturnValue(true)
    old.update?.()
    expect(flush).not.toHaveBeenCalled()
    current.update?.()
    expect(flush).toHaveBeenCalledOnce()
    runtime.beginSharedRenderRuntime()
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('rejects shared reset while visual ownership remains without clearing other shared state', () => {
    vi.spyOn(render, 'addElement').mockReturnValue(new RenderGraphics())
    runtime.renderSceneTreeStore.addElement({
      id: 'retained-visual',
      type: 'test'
    } as RenderElementData)
    runtime.renderSelectionStore.elementSelection.add('retained-visual')
    expect(() => runtime.resetSharedRenderRuntime()).toThrow(
      'released projection ownership'
    )
    expect(
      runtime.renderSelectionStore.elementSelection.has('retained-visual')
    ).toBe(true)
  })

  it('old queued projection microtasks cannot flush new runtime work', () => {
    render.resetRuntime()
    runtime.resetSharedRenderRuntime()
    const registerLayer = render.registerLayer
    const queue: (() => void)[] = []
    vi.stubGlobal('queueMicrotask', (callback: () => void) =>
      queue.push(callback)
    )
    const data = { id: 'entry', type: 'test', color: 'old' }
    vi.spyOn(sceneTree, 'getElementById').mockReturnValue({
      get: (key: keyof typeof data) => data[key],
      save: () => ({ ...data }),
      getAllComputedData: () => ({})
    } as never)
    vi.spyOn(render, 'addElement').mockReturnValue(new RenderGraphics())
    vi.spyOn(render, 'removeElement').mockReturnValue(true)
    const update = vi
      .spyOn(render, 'updateElement')
      .mockImplementation(() => undefined)
    const store = runtime.renderSceneTreeStore
    // Exercise the supported microtask path without an installed frame layer.
    ;(render as Partial<typeof render>).registerLayer = undefined
    try {
      runtime.beginSharedRenderRuntime()
      store.addElementById('entry')
      store.updateElement('entry', 'raw', 'color', 'old', 'first')
      expect(queue).toHaveLength(1)
      store.clearProjection()
      runtime.resetSharedRenderRuntime()
      runtime.beginSharedRenderRuntime()
      store.addElementById('entry')
      store.updateElement('entry', 'raw', 'color', 'old', 'second')
      expect(queue).toHaveLength(2)
      queue[0]()
      expect(update).not.toHaveBeenCalled()
      expect(store.hasPendingChanges()).toBe(true)
      queue[1]()
      expect(update).toHaveBeenCalledOnce()
      expect(store.hasPendingChanges()).toBe(false)
    } finally {
      store.clearProjection()
      render.registerLayer = registerLayer
    }
  })
})
