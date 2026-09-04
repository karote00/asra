import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToEventBatches } from '@asyra/reactive-events'
import { SceneTree } from '../sceneTree.js'
import { createDynamicComponent } from '../create-dynamic-component.js'

const ResetElement = createDynamicComponent(
  'reset-element',
  'reset-element',
  'Reset Element',
  [],
  {}
)
const element = (id: string) => new ResetElement({ id })

describe('Scene Tree full runtime reset', () => {
  beforeEach(() =>
    expect(SceneTree.prototype.resetRuntime).toBeTypeOf('function')
  )

  it('releases live and replay-retained computed hooks and clears all scene state', () => {
    const scene = new SceneTree(),
      live = element('live'),
      deleted = element('deleted')
    const liveCleanup = vi.fn(),
      deletedCleanup = vi.fn()
    live.computed.dispose = liveCleanup
    deleted.computed.dispose = deletedCleanup
    scene.addToMap(live)
    scene.addToMap(deleted)
    scene.removeFromMap(deleted)
    scene.workspace = 'previous'
    scene.workspaceList = ['previous']
    const observer = vi.fn()
    const subscription = subscribeToEventBatches(observer)
    observer.mockClear()
    scene.resetRuntime()
    expect(scene.getAllElements().size).toBe(0)
    expect(scene._deletedMap.size).toBe(0)
    expect(scene.workspace).toBe('')
    expect(scene.workspaceList).toEqual([])
    expect(scene.changes).toEqual([])
    expect(liveCleanup).toHaveBeenCalledOnce()
    expect(deletedCleanup).toHaveBeenCalledOnce()
    expect(observer).not.toHaveBeenCalled()
    scene.resetRuntime()
    expect(liveCleanup).toHaveBeenCalledOnce()
    subscription.unsubscribe()
  })

  it('invalidates old owner-issued load artifacts before a successor can accept them', () => {
    const scene = new SceneTree()
    const previous = scene.validateLoadData({
      workspace: '',
      workspaceList: [],
      elements: {}
    })
    scene.resetRuntime()
    const current = element('current')
    scene.addToMap(current)
    expect(() => scene.applyValidatedLoad(previous)).toThrow(
      'owner-issued one-shot'
    )
    expect(scene.getElementById('current')).toBe(current)
    scene.resetRuntime()
  })

  it('attempts every computed cleanup and retires state even when a hook fails', () => {
    const scene = new SceneTree(),
      first = element('first'),
      second = element('second')
    const secondCleanup = vi.fn()
    first.computed.dispose = () => {
      throw new Error('computed cleanup failed')
    }
    second.computed.dispose = secondCleanup
    scene.addToMap(first)
    scene.addToMap(second)
    expect(() => scene.resetRuntime()).toThrow('computed cleanup failed')
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(scene.getAllElements().size).toBe(0)
  })

  it('isolates another Scene Tree and accepts fresh elements after successful reset', () => {
    const scene = new SceneTree(),
      other = new SceneTree(),
      retained = element('retained')
    other.addToMap(retained)
    scene.addToMap(element('same-id'))
    scene.resetRuntime()
    const next = element('same-id')
    scene.addToMap(next)
    expect(scene.getElementById('same-id')).toBe(next)
    expect(other.getElementById('retained')).toBe(retained)
    scene.resetRuntime()
    other.resetRuntime()
  })
})
