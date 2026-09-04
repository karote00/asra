import { describe, expect, it, vi } from 'vitest'
import SelectionManager from '../selection-manager.js'
import BaseSelection from '../selections/base-selection.js'

const channel = () =>
  new BaseSelection({
    selectionType: 'custom',
    selectAction: 'select-custom',
    eventName: 'selection-changed'
  })

describe('Selection runtime reset', () => {
  it('retires channels and state without producing selection changes', () => {
    const manager = new SelectionManager(),
      selection = channel()
    manager.register('custom', selection)
    selection.select(['old'])
    manager.resetRuntime()
    expect(manager.get('custom')).toBeUndefined()
    expect([...selection.getSelectedIds()]).toEqual([])
    expect([...selection.getPrevSelectedIds()]).toEqual([])
    expect(selection.changes).toEqual([])
    manager.resetRuntime()
    const next = channel()
    manager.register('custom', next)
    selection.select(['late-old'])
    expect([...next.getSelectedIds()]).toEqual([])
    manager.resetRuntime()
  })

  it('removes all registrations and attempts all cleanup even on failure', () => {
    const manager = new SelectionManager(),
      first = channel(),
      second = channel()
    manager.register('first', first)
    manager.register('second', second)
    first.dispose = () => {
      throw new Error('selection cleanup failed')
    }
    second.dispose = vi.fn()
    expect(() => manager.resetRuntime()).toThrow('selection cleanup failed')
    expect(second.dispose).toHaveBeenCalledOnce()
    expect(manager.get('first')).toBeUndefined()
    expect(manager.get('second')).toBeUndefined()
  })

  it('leaves other manager instances untouched', () => {
    const manager = new SelectionManager(),
      other = new SelectionManager(),
      retained = channel()
    other.register('custom', retained)
    retained.select(['retained'])
    manager.resetRuntime()
    expect(other.get('custom')).toBe(retained)
    expect([...retained.getSelectedIds()]).toEqual(['retained'])
    other.resetRuntime()
  })
})
