import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getElementById: vi.fn(),
  moveElementsWithGroupGeometry: vi.fn(),
  normalizeGroupsForElements: vi.fn(),
  removeElement: vi.fn(),
  removeSubtree: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation())
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  runTransaction: mocks.runTransaction
}))

vi.mock('@asyra/preset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/preset')>()),
  moveElementsWithGroupGeometry: mocks.moveElementsWithGroupGeometry,
  normalizeGroupsForElements: mocks.normalizeGroupsForElements
}))

vi.mock('../../../contexts', () => ({
  default: {
    getElementData: vi.fn((elementId: string) => {
      const element = mocks.getElementById(elementId)
      if (!element) {
        return undefined
      }
      return {
        parentId: element.get('parentId'),
        type: element.get('type')
      }
    }),
    isContainerType: vi.fn((type: string) => type === 'group'),
    removeSubtree: mocks.removeSubtree
  },
  render: null,
  sceneTree: {
    getElementById: mocks.getElementById,
    removeElement: mocks.removeElement,
    workspace: 'workspace'
  }
}))

vi.mock('../vector-apis', () => ({
  vectorApis: {}
}))

vi.mock('../change-computed-data', () => ({
  changeComputedData: vi.fn()
}))

vi.mock('../../viewport', () => ({
  viewportApis: {}
}))

import { elementApis } from '../apis'

describe('element subtree deletion handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getElementById.mockImplementation((elementId: string) => {
      if (elementId === 'group-1') {
        return {
          get: (key: string) => {
            if (key === 'type') {
              return 'group'
            }
            if (key === 'parentId') {
              return 'workspace'
            }
            return undefined
          }
        }
      }
      if (elementId === 'workspace') {
        return {
          get: (key: string) => {
            if (key === 'type') {
              return 'workspace'
            }
            return undefined
          }
        }
      }
      return undefined
    })
    mocks.removeElement.mockReturnValue(true)
    mocks.removeSubtree.mockReturnValue({
      elementId: 'group-1',
      removed: [
        {
          elementId: 'child-1',
          parentId: 'group-1',
          index: 0,
          data: {}
        },
        {
          elementId: 'group-1',
          parentId: 'workspace',
          index: 0,
          data: {}
        }
      ]
    })
  })

  it('routes Group deletion through canonical subtree removal', () => {
    const options = { undoable: true } as const

    expect(elementApis.deleteElement('group-1', options)).toBe(true)
    expect(mocks.removeSubtree).toHaveBeenCalledWith('group-1', options)
    expect(mocks.removeElement).not.toHaveBeenCalled()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })
})
