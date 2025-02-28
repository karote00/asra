import { describe, it, expect } from 'vitest'
import { SELECTION_TYPES } from '@asra/utils'
import SelectionManager from '../selection-manager'
import ElementSelection from '../selections/element-selection'

describe('SelectionManager', () => {
  it('SelectionManager should manage selections correctly', () => {
    const manager = new SelectionManager()
    const elementSelection = new ElementSelection()

    manager.register(SELECTION_TYPES.ELEMENT, elementSelection)

    const selection = manager.get(SELECTION_TYPES.ELEMENT)
    expect(selection).toBeDefined()

    selection?.select(['element1'])
    expect(selection?.getSelectedIds().has('element1')).toBe(true)
  })
})
