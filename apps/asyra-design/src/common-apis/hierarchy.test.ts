import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const core = {
    removeSubtree: vi.fn()
  }

  return {
    core,
    groupElements: vi.fn(),
    moveElementsWithGroupGeometry: vi.fn(),
    runTransaction: vi.fn((operation: () => unknown) => operation()),
    ungroupElement: vi.fn()
  }
})

vi.mock('../contexts', () => ({
  default: mocks.core
}))

vi.mock('@asyra/core', () => ({
  runTransaction: mocks.runTransaction
}))

vi.mock('@asyra/preset', () => ({
  groupElements: mocks.groupElements,
  moveElementsWithGroupGeometry: mocks.moveElementsWithGroupGeometry,
  ungroupElement: mocks.ungroupElement
}))

import { hierarchyApis } from './hierarchy'

describe('app hierarchy common APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes grouping and ungrouping through the official Preset adapters', () => {
    const options = { undoable: true }
    const grouped = {
      groupId: 'group-1',
      elementIds: ['first', 'last'],
      bounds: { x: 10, y: 20, width: 90, height: 60 }
    }
    const ungrouped = {
      groupId: 'group-1',
      elementIds: ['first', 'last'],
      removed: true
    }
    mocks.groupElements.mockReturnValue(grouped)
    mocks.ungroupElement.mockReturnValue(ungrouped)

    expect(hierarchyApis.groupElements(['last', 'first'], options)).toBe(
      grouped
    )
    expect(hierarchyApis.ungroupElement('group-1', options)).toBe(ungrouped)
    expect(mocks.groupElements).toHaveBeenCalledWith(
      mocks.core,
      ['last', 'first'],
      options
    )
    expect(mocks.ungroupElement).toHaveBeenCalledWith(
      mocks.core,
      'group-1',
      options
    )
  })

  it('routes reorder and reparent through Preset Group geometry normalization', () => {
    const request = {
      elementIds: ['first'],
      targetParentId: 'group-2',
      targetIndex: 1
    }
    const result = {
      elementIds: ['first'],
      moves: [
        {
          elementId: 'first',
          before: { parentId: 'group-1', index: 0 },
          after: { parentId: 'group-2', index: 1 }
        }
      ]
    }
    const options = { undoable: true }
    mocks.moveElementsWithGroupGeometry.mockReturnValue(result)

    expect(hierarchyApis.moveElements(request, options)).toBe(result)
    expect(mocks.moveElementsWithGroupGeometry).toHaveBeenCalledWith(
      mocks.core,
      request,
      options
    )
  })

  it('settles subtree removal inside one app transaction', () => {
    const result = {
      rootId: 'group-1',
      parentId: 'workspace',
      index: 0,
      elements: {}
    }
    const options = { undoable: true }
    mocks.core.removeSubtree.mockReturnValue(result)

    expect(hierarchyApis.removeSubtree('group-1', options)).toBe(result)
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.core.removeSubtree).toHaveBeenCalledWith('group-1', options)
  })
})
