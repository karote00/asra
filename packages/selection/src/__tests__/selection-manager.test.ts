import { describe, it, expect, vi, beforeEach } from 'vitest'
import SelectionManager from '../selection-manager'
import BaseSelection from '../selections/base-selection'

// Mock BaseSelection
const mockBaseSelection = {
  clear: vi.fn(),
  select: vi.fn(),
  deselect: vi.fn(),
  getSelectedIds: vi.fn(() => new Set()),
  getPrevSelectedIds: vi.fn(() => new Set()),
  getSelectAction: vi.fn(() => 'selectElements'),
  getEventName: vi.fn(() => 'selectElements'),
  addChange: vi.fn(),
  cleanChanges: vi.fn()
}

describe('SelectionManager', () => {
  let manager: SelectionManager

  beforeEach(() => {
    vi.clearAllMocks()

    manager = new SelectionManager()
  })

  it('should register and retrieve selections correctly', () => {
    manager.register('element', mockBaseSelection as unknown as BaseSelection)

    const selection = manager.get('element')

    expect(selection).toBe(mockBaseSelection)
  })

  it('should return undefined for an unregistered selection type', () => {
    const selection = manager.get('vectorPoint')

    expect(selection).toBeUndefined()
  })

  it('should call clear() on all registered selections when clearAllSelections is called', () => {
    const mockSelection1 = { ...mockBaseSelection, clear: vi.fn() }
    const mockSelection2 = { ...mockBaseSelection, clear: vi.fn() }
    manager.register('element', mockSelection1 as unknown as BaseSelection)
    manager.register('vectorPoint', mockSelection2 as unknown as BaseSelection)

    manager.clearAllSelections()

    expect(mockSelection1.clear).toHaveBeenCalledTimes(1)
    expect(mockSelection2.clear).toHaveBeenCalledTimes(1)
  })

  it('should resolve channel by action', () => {
    manager.register('element', mockBaseSelection as unknown as BaseSelection)

    expect(manager.getChannelByAction('selectElements')).toBe('element')
  })

  it('should throw when registering duplicate selection type', () => {
    manager.register('element', mockBaseSelection as unknown as BaseSelection)

    expect(() =>
      manager.register('element', mockBaseSelection as unknown as BaseSelection)
    ).toThrow('Selection "element" is already registered')
  })
})
