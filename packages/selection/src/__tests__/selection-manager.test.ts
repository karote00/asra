import { describe, it, expect } from 'vitest'
import SelectionManager from '../selection-manager'
import ElementSelection from '../element-selection'

describe('SelectionManager', () => {
  it('SelectionManager should manage selections correctly', () => {
    const manager = new SelectionManager()
    const elementSelection = new ElementSelection()

    manager.register('element', elementSelection)

    const selection = manager.get('element')
    expect(selection).toBeDefined()

    selection?.select(['element1'])
    expect(selection?.getSelectedIds().has('element1')).toBe(true)
  })
})
