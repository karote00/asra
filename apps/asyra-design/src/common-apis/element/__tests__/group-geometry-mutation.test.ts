import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  changeComputedData: vi.fn(),
  getRenderElementById: vi.fn(),
  moveElementsWithGroupGeometry: vi.fn(),
  normalizeGroupsForElements: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  setVectorElementPosition: vi.fn(),
  toGlobal: vi.fn()
}))

vi.mock('@asyra/core', () => ({
  runTransaction: mocks.runTransaction
}))

vi.mock('@asyra/preset', () => ({
  InputSystemEvents: {},
  moveElementsWithGroupGeometry: mocks.moveElementsWithGroupGeometry,
  normalizeGroupsForElements: mocks.normalizeGroupsForElements
}))

vi.mock('../../../contexts', () => {
  const element = {
    get: (key: string) => {
      if (key === 'type') {
        return 'rect'
      }
      return undefined
    },
    getAllComputedData: () => ({
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })
  }

  return {
    default: {
      changeComputedData: mocks.changeComputedData,
      isContainerType: vi.fn(() => false)
    },
    render: {
      app: {
        canvas: {
          getBoundingClientRect: () => ({
            left: 8,
            top: 12
          })
        }
      },
      getElementById: mocks.getRenderElementById
    },
    sceneTree: {
      currentWorkspace: undefined,
      getElementById: vi.fn((elementId: string) =>
        elementId === 'rect-1' ? element : undefined
      ),
      workspace: 'workspace'
    }
  }
})

vi.mock('../vector-apis', () => ({
  vectorApis: {
    setVectorElementPosition: mocks.setVectorElementPosition
  }
}))

vi.mock('../../viewport', () => ({
  viewportApis: {}
}))

import { elementApis } from '../apis'
import { changeComputedData } from '../change-computed-data'

describe('Group geometry mutation handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.toGlobal.mockImplementation(({ x, y }: { x: number; y: number }) => ({
      x: 100 + x * 2,
      y: 200 + y * 2
    }))
    mocks.getRenderElementById.mockReturnValue({
      toGlobal: mocks.toGlobal
    })
  })

  it('projects identity-safe element bounds into client coordinates', () => {
    expect(elementApis.getElementClientBounds('rect-1')).toEqual({
      x: 108,
      y: 212,
      width: 60,
      height: 80
    })
    expect(mocks.getRenderElementById).toHaveBeenCalledWith('rect-1')
    expect(mocks.toGlobal).toHaveBeenCalledTimes(4)
  })

  it('normalizes affected ancestor Groups through explicit gesture finalization', () => {
    const options = { sharedDelivery: 'immediate' } as const

    elementApis.normalizeGroupGeometryForElements(['rect-1'], options)

    expect(mocks.normalizeGroupsForElements).toHaveBeenCalledWith(
      expect.anything(),
      ['rect-1'],
      options
    )
  })

  it('normalizes affected Groups after accepted dimension writes', () => {
    const options = { undoable: true } as const

    changeComputedData(['rect-1'], { width: 45 }, options)

    expect(mocks.changeComputedData).toHaveBeenCalledWith(
      ['rect-1'],
      { width: 45 },
      options
    )
    expect(mocks.normalizeGroupsForElements).toHaveBeenCalledWith(
      expect.anything(),
      ['rect-1'],
      options
    )
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('does not normalize Groups for non-geometry property writes', () => {
    changeComputedData(['rect-1'], { name: 'Updated' })

    expect(mocks.changeComputedData).toHaveBeenCalledWith(
      ['rect-1'],
      { name: 'Updated' },
      undefined
    )
    expect(mocks.normalizeGroupsForElements).not.toHaveBeenCalled()
  })
})
