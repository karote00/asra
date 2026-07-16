import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordingRenderEngine } from '@asyra/render-engine/testing'
import type { RenderEngineInteractionEvent } from '@asyra/render-engine'
import { Render } from '../render'
import type { RenderElementData } from '../types'

const reactiveEvents = vi.hoisted(() => ({
  renderPointerHover: vi.fn(),
  renderPointerLeave: vi.fn()
}))

vi.mock('@asyra/reactive-events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/reactive-events')>()),
  ...reactiveEvents
}))

const createInteraction = (
  type: RenderEngineInteractionEvent['type'],
  target: RenderEngineInteractionEvent['target']
): RenderEngineInteractionEvent => ({
  type,
  target,
  pointerId: 1,
  button: 0,
  buttons: 0,
  position: { x: 12, y: 24 },
  modifiers: {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  },
  timestamp: 100
})

describe('engine interaction bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps normalized engine hover events through the opaque target handle', async () => {
    const engine = new RecordingRenderEngine({ name: 'interaction-engine' })
    const render = new Render({ engine })
    await render.init(100, 100, 0, {})
    const element = render.addElement({
      id: 'element-1',
      type: 'rectangle',
      name: 'Element 1',
      visible: true,
      lock: false,
      width: 10,
      height: 10
    } as unknown as RenderElementData)
    const target = element?.getEngineHandle() ?? null

    engine.emitInteraction(createInteraction('pointerover', target))
    engine.emitInteraction(createInteraction('pointerout', target))

    expect(reactiveEvents.renderPointerHover).toHaveBeenCalledWith('element-1')
    expect(reactiveEvents.renderPointerLeave).toHaveBeenCalledWith('element-1')
  })

  it('bypasses normalized events without a mapped target', async () => {
    const engine = new RecordingRenderEngine({ name: 'unmapped-interaction' })
    const render = new Render({ engine })
    await render.init(100, 100, 0, {})

    engine.emitInteraction(createInteraction('pointerover', null))
    engine.emitInteraction(createInteraction('pointerout', null))

    expect(reactiveEvents.renderPointerHover).not.toHaveBeenCalled()
    expect(reactiveEvents.renderPointerLeave).not.toHaveBeenCalled()
  })

  it('unsubscribes from normalized engine interactions during dispose', async () => {
    const engine = new RecordingRenderEngine({ name: 'interaction-cleanup' })
    const unsubscribe = vi.fn()
    const subscribe = engine.subscribeToInteraction.bind(engine)
    engine.subscribeToInteraction = vi.fn((listener) => {
      const unsubscribeEngine = subscribe(listener)
      return () => {
        unsubscribeEngine()
        unsubscribe()
      }
    })
    const render = new Render({ engine })
    await render.init(100, 100, 0, {})

    render.dispose()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
