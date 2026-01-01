import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SELECTION_TYPES } from '@asra/utils'
import SelectionManager from '../selection-manager'
import BaseSelection from '../selections/base-selection'

// Mock BaseSelection
const mockBaseSelection = {
  clear: vi.fn(),
  select: vi.fn(),
  deselect: vi.fn(),
  getSelectedIds: vi.fn(() => new Set()),
  getPrevSelectedIds: vi.fn(() => new Set()),
  addChange: vi.fn(),
  cleanChanges: vi.fn()
}

describe('SelectionManager', () => {
  let manager: SelectionManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    manager = new SelectionManager()
  })

  it('should register and retrieve selections correctly', () => {
    manager.register(
      SELECTION_TYPES.ELEMENT,
      mockBaseSelection as unknown as BaseSelection
    )
    const selection = manager.get(SELECTION_TYPES.ELEMENT)
    expect(selection).toBe(mockBaseSelection)
  })

  it('should return undefined for an unregistered selection type', () => {
    const selection = manager.get(SELECTION_TYPES.VERTEX)
    expect(selection).toBeUndefined()
  })

  it('should call clear() on all registered selections when clearAllSelections is called', () => {
    const mockSelection1 = { ...mockBaseSelection, clear: vi.fn() }
    const mockSelection2 = { ...mockBaseSelection, clear: vi.fn() }

    manager.register(
      SELECTION_TYPES.ELEMENT,
      mockSelection1 as unknown as BaseSelection
    )
    manager.register(
      SELECTION_TYPES.VERTEX,
      mockSelection2 as unknown as BaseSelection
    )

    manager.clearAllSelections()

    expect(mockSelection1.clear).toHaveBeenCalledTimes(1)
    expect(mockSelection2.clear).toHaveBeenCalledTimes(1)
  })
})
