import { describe, it, expect, beforeEach, vi } from 'vitest'
import { interactionHandlerRegistry } from '@asyra/render'

describe('InteractionHandlerRegistry', () => {
  beforeEach(() => {
    interactionHandlerRegistry.clear()
  })

  it('should register an interaction handler for specific element ID', () => {
    const handler = vi.fn()

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler,
      priority: 10
    })

    const handlers = interactionHandlerRegistry.get('element-1', 'pointerdown')

    expect(handlers).toHaveLength(1)
    expect(handlers[0].handler).toBe(handler)
    expect(handlers[0].eventType).toBe('pointerdown')
  })

  it('should register handlers with different event types', () => {
    const downHandler = vi.fn()
    const upHandler = vi.fn()

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: downHandler,
      priority: 10
    })

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerup',
      handler: upHandler,
      priority: 20
    })

    const downHandlers = interactionHandlerRegistry.get(
      'element-1',
      'pointerdown'
    )
    const upHandlers = interactionHandlerRegistry.get('element-1', 'pointerup')

    expect(downHandlers).toHaveLength(1)
    expect(upHandlers).toHaveLength(1)
    expect(downHandlers[0].handler).toBe(downHandler)
    expect(upHandlers[0].handler).toBe(upHandler)
  })

  it('should register handler for pattern matching', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    interactionHandlerRegistry.register(/anchor-.*/, {
      eventType: 'pointerdown',
      handler: handler1,
      priority: 10
    })

    interactionHandlerRegistry.register(/handle-.*/, {
      eventType: 'pointerdown',
      handler: handler2,
      priority: 20
    })

    const anchorHandlers = interactionHandlerRegistry.get(
      'anchor-123',
      'pointerdown'
    )
    const handleHandlers = interactionHandlerRegistry.get(
      'handle-in-456',
      'pointerdown'
    )

    expect(anchorHandlers).toHaveLength(1)
    expect(handleHandlers).toHaveLength(1)
    expect(anchorHandlers[0].handler).toBe(handler1)
    expect(handleHandlers[0].handler).toBe(handler2)
  })

  it('should return handlers sorted by priority', () => {
    const lowPriorityHandler = vi.fn()
    const highPriorityHandler = vi.fn()
    const mediumPriorityHandler = vi.fn()

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: lowPriorityHandler,
      priority: 10
    })

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: highPriorityHandler,
      priority: 100
    })

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: mediumPriorityHandler,
      priority: 50
    })

    const handlers = interactionHandlerRegistry.get('element-1', 'pointerdown')

    expect(handlers).toHaveLength(3)
    expect(handlers[0].handler).toBe(highPriorityHandler)
    expect(handlers[1].handler).toBe(mediumPriorityHandler)
    expect(handlers[2].handler).toBe(lowPriorityHandler)
  })

  it('should unregister all handlers for element', () => {
    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: vi.fn()
    })

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerup',
      handler: vi.fn()
    })

    expect(interactionHandlerRegistry.has('element-1')).toBe(true)

    interactionHandlerRegistry.unregister('element-1')

    expect(interactionHandlerRegistry.has('element-1')).toBe(false)
    const downHandlers = interactionHandlerRegistry.get(
      'element-1',
      'pointerdown'
    )
    expect(downHandlers).toHaveLength(0)
  })

  it('should unregister specific event type only', () => {
    const downHandler = vi.fn()
    const upHandler = vi.fn()

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: downHandler
    })

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerup',
      handler: upHandler
    })

    interactionHandlerRegistry.unregister('element-1', 'pointerdown')

    const downHandlers = interactionHandlerRegistry.get(
      'element-1',
      'pointerdown'
    )
    const upHandlers = interactionHandlerRegistry.get('element-1', 'pointerup')

    expect(downHandlers).toHaveLength(0)
    expect(upHandlers).toHaveLength(1)
    expect(upHandlers[0].handler).toBe(upHandler)
  })

  it('should check if element has handlers', () => {
    expect(interactionHandlerRegistry.has('element-1')).toBe(false)

    interactionHandlerRegistry.register('element-1', {
      eventType: 'pointerdown',
      handler: vi.fn()
    })

    expect(interactionHandlerRegistry.has('element-1')).toBe(true)
  })

  it('should check if element has pattern matched handlers', () => {
    interactionHandlerRegistry.register(/anchor-.*/, {
      eventType: 'pointerdown',
      handler: vi.fn()
    })

    expect(interactionHandlerRegistry.has('anchor-123')).toBe(true)
    expect(interactionHandlerRegistry.has('other-element')).toBe(false)
  })

  it('should clear all handlers', () => {
    interactionHandlerRegistry.register(/anchor-.*/, {
      eventType: 'pointerdown',
      handler: vi.fn()
    })

    interactionHandlerRegistry.register(/handle-in-.*/, {
      eventType: 'pointerdown',
      handler: vi.fn()
    })

    interactionHandlerRegistry.clear()

    expect(
      interactionHandlerRegistry.get('anchor-1', 'pointerdown')
    ).toHaveLength(0)
    expect(
      interactionHandlerRegistry.get('handle-in-1', 'pointerdown')
    ).toHaveLength(0)
  })
})
