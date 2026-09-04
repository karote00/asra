import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { PropertyTypes } from '@asyra/utils'
import { subscribeToEvents } from '@asyra/reactive-events'
import { PropsManager } from '../manager/props-manager.js'
import {
  getPropertyComponent,
  registerPropertyComponent,
  unregisterPropertyComponent
} from '../registries/property-component.js'
import { PositionComponent } from './helpers/test-property-components.js'

class ResetProperty extends PositionComponent {
  dispose(): void {
    return
  }
}
const create = (manager: PropsManager, id: string) => {
  const component = manager.createProperty({
    type: PropertyTypes.POSITION,
    id,
    x: 0,
    y: 0
  }) as ResetProperty
  manager.addToMap(component)
  manager.cleanChanges()
  return component
}

describe('Props Manager full runtime reset', () => {
  beforeAll(() =>
    registerPropertyComponent(PropertyTypes.POSITION, ResetProperty)
  )
  afterAll(() => unregisterPropertyComponent(PropertyTypes.POSITION))
  beforeEach(() =>
    expect(PropsManager.prototype.resetRuntime).toBeTypeOf('function')
  )

  it('releases live/deleted components without emitting canonical changes', () => {
    const manager = new PropsManager(),
      live = create(manager, 'live'),
      deleted = create(manager, 'deleted')
    live.dispose = vi.fn()
    deleted.dispose = vi.fn()
    manager.removeFromMap('deleted')
    const observer = vi.fn(),
      subscription = subscribeToEvents(observer)
    observer.mockClear()
    manager.resetRuntime()
    expect(manager.getPropertyById('live')).toBeUndefined()
    expect(manager._deletedMap.size).toBe(0)
    expect(manager.changes).toEqual([])
    expect(live.dispose).toHaveBeenCalledOnce()
    expect(deleted.dispose).toHaveBeenCalledOnce()
    expect(observer).not.toHaveBeenCalled()
    manager.resetRuntime()
    expect(live.dispose).toHaveBeenCalledOnce()
    subscription.unsubscribe()
  })

  it('invalidates old validated loads while retaining type definitions', () => {
    const manager = new PropsManager()
    const old = manager.validateLoadData({})
    manager.resetRuntime()
    const next = create(manager, 'next')
    expect(() => manager.applyValidatedLoad(old)).toThrow(
      'owner-issued one-shot'
    )
    expect(manager.getPropertyById('next')).toBe(next)
    expect(getPropertyComponent(PropertyTypes.POSITION)).toBe(ResetProperty)
    manager.resetRuntime()
  })

  it('invalidates prepared canonical mutation even when the old IDs return', () => {
    const manager = new PropsManager()
    create(manager, 'shared-id')
    const old = manager.preparePropertyMutationBatch({
      operations: [
        { kind: 'values', propertyId: 'shared-id', values: { x: 5 } }
      ]
    })
    manager.resetRuntime()
    const next = create(manager, 'shared-id')
    expect(() => manager.applyPreparedPropertyMutationBatch(old)).toThrow(
      'owner-issued one-shot'
    )
    expect(next.get('x')).toBe(0)
    manager.resetRuntime()
  })

  it('attempts all cleanup hooks and clears state before reporting failure', () => {
    const manager = new PropsManager(),
      first = create(manager, 'first'),
      second = create(manager, 'second')
    first.dispose = () => {
      throw new Error('property cleanup failed')
    }
    second.dispose = vi.fn()
    expect(() => manager.resetRuntime()).toThrow('property cleanup failed')
    expect(second.dispose).toHaveBeenCalledOnce()
    expect(manager._components.size).toBe(0)
    expect(manager._deletedMap.size).toBe(0)
  })

  it('rejects reset during active canonical property apply without losing that operation', () => {
    const manager = new PropsManager(),
      component = create(manager, 'active')
    let rejection: unknown
    const load = component.load.bind(component)
    component.load = (data) => {
      try {
        manager.resetRuntime()
      } catch (error) {
        rejection = error
      }
      load(data)
    }
    const prepared = manager.preparePropertyMutationBatch({
      operations: [{ kind: 'values', propertyId: 'active', values: { x: 12 } }]
    })
    manager.applyPreparedPropertyMutationBatch(prepared)
    expect(rejection).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('idle canonical property batches')
      })
    )
    expect(component.get('x')).toBe(12)
    expect(manager.getPropertyById('active')).toBe(component)
    component.load = load
    manager.resetRuntime()
  })

  it('leaves another manager intact', () => {
    const manager = new PropsManager(),
      other = new PropsManager()
    create(manager, 'old')
    const retained = create(other, 'retained')
    manager.resetRuntime()
    expect(other.getPropertyById('retained')).toBe(retained)
    expect(create(manager, 'new').get('id')).toBe('new')
    manager.resetRuntime()
    other.resetRuntime()
  })
})
