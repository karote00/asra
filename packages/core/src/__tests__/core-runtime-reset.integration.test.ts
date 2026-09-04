import { afterEach, describe, expect, it, vi } from 'vitest'
import factory from '@asyra/factory'
import { interactionQueue } from '@asyra/feature-system'
import { runTransaction } from '@asyra/reactive-events'
import { componentRegistry } from '@asyra/scene-tree'
import core, { type Core } from '../index.js'

const type = 'runtime-handoff-element'
const compose = async (runtime: Core, host: HTMLElement, name: string) => {
  runtime.defineComponent({
    type,
    idPrefix: type,
    namePrefix: 'Element',
    properties: [],
    renderStrategy: () => null
  })
  runtime.defineSystemProperty('document-name', name, { runtime: false })
  runtime.load({
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  })
  runtime.setRenderer({
    name: 'lifecycle-test-surface',
    init: async () => ({
      canvas: document.createElement('canvas'),
      instance: null
    }),
    destroy: vi.fn(),
    getCanvas: () => null,
    getInstance: () => null,
    getViewportPosition: () => ({ x: 0, y: 0 }),
    getViewportScale: () => 1,
    setViewportPosition: vi.fn(),
    setViewportScale: vi.fn(),
    resize: vi.fn()
  })
  await runtime.start(host, { width: 100, height: 100 })
}

afterEach(async () => {
  if (core.getRuntimeState() === 'active') await core.resetRuntime()
})

describe('Core runtime handoff with real Framework owners', () => {
  it('reconstructs A/B/A with no old history, canonical state, canvas, or registrations', async () => {
    const host = document.createElement('div')
    const first = core
    await compose(first, host, 'A')
    const id = runTransaction(() =>
      first.createElement({ type, name: 'A element', x: 0, y: 0 })
    )
    expect(first.getUndoHistoryDepth()).toBe(1)
    const snapshot = await first.save()
    runTransaction(() => first.updateElementData(id, { name: 'A edited' }))
    first.load(snapshot)
    expect(first.getElementData(id)?.name).toBe('A element')
    expect(first.getUndoHistoryDepth()).toBe(2)
    expect(host.querySelectorAll('canvas')).toHaveLength(1)

    const second = await first.resetRuntime()
    expect(core).toBe(second)
    expect(componentRegistry.has(type)).toBe(false)
    expect(host.querySelectorAll('canvas')).toHaveLength(0)
    await compose(second, host, 'B')
    expect(second.getUndoHistoryDepth()).toBe(0)
    expect(second.getElementData(id)).toBeUndefined()
    expect(second.getSystemProperty('document-name')).toBe('B')
    expect(() => first.updateElementData(id, { name: 'late A' })).toThrow(
      'retired'
    )
    const secondId = runTransaction(() =>
      second.createElement({ type, name: 'B element', x: 0, y: 0 })
    )
    expect(second.getUndoHistoryDepth()).toBe(1)
    factory.undo()
    expect(second.getElementData(secondId)).toBeUndefined()
    factory.redo()
    expect(second.getElementData(secondId)?.name).toBe('B element')

    const third = await second.resetRuntime()
    await compose(third, host, 'A')
    third.load(snapshot)
    expect(third.getUndoHistoryDepth()).toBe(0)
    expect(third.getElementData(id)?.name).toBe('A element')
    expect(third.getSystemProperty('document-name')).toBe('A')
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    factory.undo()
    expect(third.getElementData(id)?.name).toBe('A element')
    await third.resetRuntime()
    expect(host.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('drains an actual running interaction and rejects queued old work before reconstruction', async () => {
    const previous = core
    const host = document.createElement('div')
    await compose(previous, host, 'A')
    let release: () => void = () => undefined
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    let started: () => void = () => undefined
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const running = interactionQueue.run(async () => {
      started()
      await waiting
      runTransaction(() =>
        previous.createElement({ type, name: 'last A write', x: 0, y: 0 })
      )
    })
    await ready
    const queuedBody = vi.fn()
    const queued = interactionQueue.run(queuedBody)
    const rejected = expect(queued).rejects.toThrow('closed')
    const resetting = previous.resetRuntime()
    expect(previous.getRuntimeState()).toBe('quiescing')
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    release()
    await running
    await rejected
    const next = await resetting
    expect(queuedBody).not.toHaveBeenCalled()
    expect(next.getCanonicalElementCount()).toBe(0)
    expect(next.getUndoHistoryDepth()).toBe(0)
    expect(host.querySelectorAll('canvas')).toHaveLength(0)
  })
})
