import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UIContext } from '../ui-context.js'
import { propertyRegistry } from '../property-registry.js'
import { BehaviorSubject } from 'rxjs'
import { ComputedAttrs, MIXED_STRING } from '@asyra/utils'

describe('UIContext', () => {
  let uiContext: UIContext

  beforeEach(() => {
    vi.clearAllMocks()
    propertyRegistry.clear()

    uiContext = new UIContext()
  })

  it('should register properties and expose their subjects', () => {
    uiContext.registerProperty<number>('zoom', { defaultValue: 1 })

    const subject = uiContext.getSubject<number>('zoom')
    expect(subject).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.get<number>('zoom')).toBe(1)
  })

  it('should sync values from a source observable', () => {
    const source$ = new BehaviorSubject<number>(1)
    uiContext.registerProperty<number>('zoom', {
      defaultValue: 1,
      source$: source$
    })

    source$.next(2)
    expect(uiContext.get<number>('zoom')).toBe(2)
  })

  it('should recompute aggregate properties with consistent values', () => {
    uiContext.registerProperty<number | string>('x', {
      defaultValue: 0,
      aggregate: true
    })

    const context = {
      selectedIds: new Set(['1', '2']),
      elements: [
        {
          id: '1',
          type: 'rect',
          name: 'rect 1',
          x: 10
        } as ComputedAttrs,
        {
          id: '2',
          type: 'rect',
          name: 'rect 2',
          x: 10
        } as ComputedAttrs
      ]
    }

    uiContext.recomputeProperties(['x'], context)
    expect(uiContext.get('x')).toBe(10)
  })

  it('should recompute aggregate properties with MIXED_STRING for mixed values', () => {
    uiContext.registerProperty<number | string>('x', {
      defaultValue: 0,
      aggregate: true
    })

    const context = {
      selectedIds: new Set(['1', '2']),
      elements: [
        {
          id: '1',
          type: 'rect',
          name: 'rect 1',
          x: 10
        } as ComputedAttrs,
        {
          id: '2',
          type: 'rect',
          name: 'rect 2',
          x: 15
        } as ComputedAttrs
      ]
    }

    uiContext.recomputeProperties(['x'], context)
    expect(uiContext.get('x')).toBe(MIXED_STRING)
  })

  it('should apply empty values when selection is empty', () => {
    uiContext.registerProperty<number | string>('x', {
      defaultValue: 0,
      aggregate: true,
      emptyValue: 123
    })

    uiContext.recomputeProperties(['x'], {
      selectedIds: new Set(),
      elements: []
    })

    expect(uiContext.get('x')).toBe(123)
  })
})
