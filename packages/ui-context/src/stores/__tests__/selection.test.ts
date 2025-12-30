import { describe, it, expect, vi, beforeEach } from 'vitest'
import SelectionStore from '../selection'
import * as SelectionModule from '@asra/selection'
import * as SceneTreeModule from '@asra/scene-tree'
import * as UIContextModule from '../../ui-context'
import { SELECTION_TYPES, ComputedAttrs, EntityTypes } from '@asra/utils'

// Mock external dependencies
vi.mock('@asra/selection', () => ({
  default: {
    get: vi.fn()
  },
  SelectionManager: vi.fn()
}))

vi.mock('@asra/scene-tree', () => ({
  default: {
    getElementById: vi.fn()
  }
}))

vi.mock('../../ui-context', () => ({
  default: {
    updateElementSelection: vi.fn(),
    updateVertexSelection: vi.fn(),
    updateComputedProperties: vi.fn()
  }
}))

describe('SelectionStore', () => {
  let selectionStore: SelectionStore
  let mockSelectionManager: any
  let mockSelection: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    mockSelection = {
      getSelectedIds: vi.fn(() => new Set(['elem-1', 'elem-2']))
    }

    mockSelectionManager = {
      get: vi.fn(() => mockSelection)
    }

    vi.mocked(SelectionModule.default).get = mockSelectionManager.get
    vi.mocked(SelectionModule.default).constructor = vi.fn(
      () => mockSelectionManager
    ) as any

    selectionStore = new SelectionStore()
    selectionStore.selectionManager = mockSelectionManager as any
  })

  // Test updateSelection for ELEMENT type
  it('should update element selection and computed properties when elements are selected', () => {
    const mockElement1 = {
      getAllComputedData: vi.fn(() => ({
        id: 'elem-1',
        type: EntityTypes.RECTANGLE,
        name: 'Element 1',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      } as ComputedAttrs))
    }

    const mockElement2 = {
      getAllComputedData: vi.fn(() => ({
        id: 'elem-2',
        type: EntityTypes.RECTANGLE,
        name: 'Element 2',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      } as ComputedAttrs))
    }

    vi.mocked(SceneTreeModule.default.getElementById)
      .mockReturnValueOnce(mockElement1 as any)
      .mockReturnValueOnce(mockElement2 as any)

    selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)

    expect(mockSelectionManager.get).toHaveBeenCalledWith(SELECTION_TYPES.ELEMENT)
    expect(UIContextModule.default.updateElementSelection).toHaveBeenCalledWith(
      new Set(['elem-1', 'elem-2'])
    )
    expect(UIContextModule.default.updateComputedProperties).toHaveBeenCalledWith([
      {
        id: 'elem-1',
        type: EntityTypes.RECTANGLE,
        name: 'Element 1',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      },
      {
        id: 'elem-2',
        type: EntityTypes.RECTANGLE,
        name: 'Element 2',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      }
    ])
  })

  it('should not update computed properties when no elements are selected', () => {
    mockSelection.getSelectedIds = vi.fn(() => new Set())

    selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)

    expect(UIContextModule.default.updateElementSelection).toHaveBeenCalledWith(
      new Set()
    )
    expect(UIContextModule.default.updateComputedProperties).not.toHaveBeenCalled()
  })

  it('should handle missing elements gracefully', () => {
    vi.mocked(SceneTreeModule.default.getElementById)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)

    selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)

    expect(UIContextModule.default.updateElementSelection).toHaveBeenCalled()
    expect(UIContextModule.default.updateComputedProperties).toHaveBeenCalledWith([])
  })

  // Test updateSelection for VERTEX type
  it('should update vertex selection when vertices are selected', () => {
    mockSelection.getSelectedIds = vi.fn(() => new Set(['vertex-1', 'vertex-2']))

    selectionStore.updateSelection(SELECTION_TYPES.VERTEX)

    expect(mockSelectionManager.get).toHaveBeenCalledWith(SELECTION_TYPES.VERTEX)
    expect(UIContextModule.default.updateVertexSelection).toHaveBeenCalledWith(
      new Set(['vertex-1', 'vertex-2'])
    )
    expect(UIContextModule.default.updateComputedProperties).not.toHaveBeenCalled()
  })

  it('should return early when selection is null', () => {
    mockSelectionManager.get = vi.fn(() => null)

    selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)

    expect(UIContextModule.default.updateElementSelection).not.toHaveBeenCalled()
    expect(UIContextModule.default.updateComputedProperties).not.toHaveBeenCalled()
  })
})
