import { describe, it, expect, vi } from 'vitest'
import { Setter } from '../setter.js'
import type { ComputedAttrs } from '../sceneTree/instanceTypes.js'
import { EntityTypes } from '../sceneTree/index.js'

// Mock data structure representing an element with required ComputedAttrs
interface MockElementData extends ComputedAttrs {
  children: string[]
  metadata: { name: string; visible: boolean }
}

describe('Setter - Change Tracking System', () => {
  describe('get/set operations', () => {
    it('should demonstrate how element properties are accessed safely', () => {
      // Demonstrates: Safe property access with validation
      const changeCallback = vi.fn()
      const setter = new Setter<MockElementData>(changeCallback)

      setter.data = {
        id: 'rect-1',
        type: 'rect',
        name: 'Rectangle',
        x: 100,
        y: 200,
        width: 50,
        height: 30,
        rotation: 0,
        fills: [],
        strokes: [],
        children: [],
        metadata: { name: 'Rectangle', visible: true }
      }

      // Shows how properties are safely accessed
      expect(setter.get('x')).toBe(100)
      expect(setter.get('metadata')).toEqual({
        name: 'Rectangle',
        visible: true
      })
    })

    it('should prevent access to non-existent properties', () => {
      // Demonstrates: Type safety and error handling
      const changeCallback = vi.fn()
      const setter = new Setter<MockElementData>(changeCallback)
      setter.data = {
        id: 'test',
        type: 'rect',
        name: 'Test',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        fills: [],
        strokes: [],
        children: [],
        metadata: { name: 'Test', visible: true }
      } as MockElementData

      expect(() => setter.get('nonExistent' as keyof MockElementData)).toThrow(
        'Not allow to get value which is not in entity data.'
      )
    })
  })

  describe('change tracking', () => {
    it('signals a semantic write before change callbacks and listeners', () => {
      const order: string[] = []
      const changeCallback = vi.fn(() => order.push('change'))
      const onCanonicalWrite = vi.fn(() => order.push('canonical'))
      const setter = new Setter<MockElementData>(
        changeCallback,
        onCanonicalWrite
      )
      setter.data = {
        id: 'rect-1',
        type: 'rect',
        name: 'Rectangle',
        x: 100,
        y: 200,
        width: 50,
        height: 30,
        rotation: 0,
        fills: [],
        strokes: [],
        children: [],
        metadata: { name: 'Rectangle', visible: true }
      }
      setter.on(() => order.push('listener'))

      setter.set('x', 150)
      setter.set('x', 150)

      expect(order).toEqual(['canonical', 'change', 'listener'])
      expect(onCanonicalWrite).toHaveBeenCalledTimes(1)
    })

    it('should demonstrate how element modifications are tracked for undo/redo', () => {
      // Demonstrates: Critical change tracking for transaction system
      const changeCallback = vi.fn()
      const setter = new Setter<MockElementData>(changeCallback)

      setter.data = {
        id: 'rect-1',
        type: 'rect',
        name: 'Rectangle',
        x: 100,
        y: 200,
        width: 50,
        height: 30,
        rotation: 0,
        fills: [],
        strokes: [],
        children: [],
        metadata: { name: 'Rectangle', visible: true }
      }

      // Modify position - this should be tracked for undo/redo
      setter.set('x', 150)

      expect(changeCallback).toHaveBeenCalledWith({
        id: 'rect-1',
        key: 'x',
        before: 100,
        after: 150
      })
    })

    it('should handle complex object changes with deep cloning', () => {
      // Demonstrates: How nested object changes are properly tracked
      const changeCallback = vi.fn()
      const setter = new Setter<MockElementData>(changeCallback)

      setter.data = {
        id: 'rect-1',
        type: 'rect',
        name: 'Rectangle',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        fills: [],
        strokes: [],
        children: ['child-1', 'child-2'],
        metadata: { name: 'Rectangle', visible: true }
      }

      const newMetadata = { name: 'Updated Rectangle', visible: false }
      setter.set('metadata', newMetadata)

      expect(changeCallback).toHaveBeenCalledWith({
        id: 'rect-1',
        key: 'metadata',
        before: { name: 'Rectangle', visible: true },
        after: { name: 'Updated Rectangle', visible: false }
      })
    })

    it('should handle array modifications correctly', () => {
      // Demonstrates: How array changes (like children) are tracked
      const changeCallback = vi.fn()
      const setter = new Setter<MockElementData>(changeCallback)

      setter.data = {
        id: 'group-1',
        type: EntityTypes.GROUP,
        name: 'Group',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        fills: [],
        strokes: [],
        children: ['child-1'],
        metadata: { name: 'Group', visible: true }
      }

      setter.set('children', ['child-1', 'child-2', 'child-3'])

      expect(changeCallback).toHaveBeenCalledWith({
        id: 'group-1',
        key: 'children',
        before: ['child-1'],
        after: ['child-1', 'child-2', 'child-3']
      })
    })
  })
})
