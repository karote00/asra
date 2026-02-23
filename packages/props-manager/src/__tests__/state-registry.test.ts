import { describe, it, expect, beforeEach } from 'vitest'
import { stateRegistry } from '../registries/state'
import { BehaviorSubject, Observable } from 'rxjs'

describe('StateRegistry', () => {
  beforeEach(() => {
    stateRegistry.clear()
  })

  it('should register a new state', () => {
    stateRegistry.register('testState', 'initialValue')

    expect(stateRegistry.has('testState')).toBe(true)
    expect(stateRegistry.getValue('testState')).toBe('initialValue')
  })

  it('should register with custom observable', () => {
    const customObservable = new BehaviorSubject('customInitial')

    stateRegistry.register('customState', 'fallback', customObservable)

    const observable = stateRegistry.getObservable('customState')
    expect(observable).toBe(customObservable)
    expect(stateRegistry.getValue('customState')).toBe('customInitial')
  })

  it('should unregister a state', () => {
    stateRegistry.register('tempState', 'value')
    expect(stateRegistry.has('tempState')).toBe(true)

    const result = stateRegistry.unregister('tempState')

    expect(result).toBe(true)
    expect(stateRegistry.has('tempState')).toBe(false)
  })

  it('should return false when unregistering non-existent state', () => {
    const result = stateRegistry.unregister('nonExistent')
    expect(result).toBe(false)
  })

  it('should get observable for state', () => {
    stateRegistry.register('observableState', 'value')

    const observable = stateRegistry.getObservable('observableState')

    expect(observable).toBeDefined()
    expect(observable instanceof BehaviorSubject).toBe(true)
  })

  it('should set value for BehaviorSubject', () => {
    stateRegistry.register('settableState', 'initial')

    stateRegistry.setValue('settableState', 'updated')

    expect(stateRegistry.getValue('settableState')).toBe('updated')
  })

  it('should handle warning when setting value without BehaviorSubject', () => {
    const plainObservable = new Observable<string>((subscriber) => {
      subscriber.next('value')
    })

    stateRegistry.register('readableState', 'initial', plainObservable)

    stateRegistry.setValue('readableState', 'new value' as string)

    expect(stateRegistry.getValue('readableState')).toBe('initial')
  })

  it('should handle undefined observable by creating BehaviorSubject', () => {
    stateRegistry.register('autoSubjectState', 'initial', undefined)

    const observable = stateRegistry.getObservable('autoSubjectState')

    expect(observable).toBeDefined()
    expect(observable instanceof BehaviorSubject).toBe(true)
    if (observable instanceof BehaviorSubject) {
      expect(observable.value).toBe('initial')
    }
  })
})
