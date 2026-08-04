import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateElementProperties: vi.fn(),
  getRenderElementById: vi.fn(),
  moveElementsWithGroupGeometry: vi.fn(),
  normalizeGroupsForElements: vi.fn(),
  projectGroupGeometryPropertyUpdates: vi.fn(
    (
      _core: unknown,
      updates: readonly {
        elementId: string
        values: Readonly<Record<string, unknown>>
      }[]
    ) => updates
  ),
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
  normalizeGroupsForElements: mocks.normalizeGroupsForElements,
  projectGroupGeometryPropertyUpdates: mocks.projectGroupGeometryPropertyUpdates
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
  const group = {
    get: (key: string) => {
      if (key === 'type') {
        return 'group'
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
      updateElementProperties: mocks.updateElementProperties,
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
      getElementById: vi.fn((elementId: string) => {
        if (elementId === 'rect-1') {
          return element
        }
        if (elementId === 'group-1') {
          return group
        }
        return undefined
      }),
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
import { updateElementProperties } from '../update-element-properties'

describe('Group geometry mutation handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectGroupGeometryPropertyUpdates.mockImplementation(
      (_core, updates) => updates
    )
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

  it('keeps explicit hierarchy-operation Group normalization available', () => {
    const options = { sharedDelivery: 'immediate' } as const

    elementApis.normalizeGroupGeometryForElements(['rect-1'], options)

    expect(mocks.normalizeGroupsForElements).toHaveBeenCalledWith(
      expect.anything(),
      ['rect-1'],
      options
    )
  })

  it('submits child geometry directly without Group projection', () => {
    const options = { undoable: true } as const

    updateElementProperties(['rect-1'], { width: 45 }, options)

    expect(mocks.projectGroupGeometryPropertyUpdates).not.toHaveBeenCalled()
    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [{ elementId: 'rect-1', values: { width: 45 } }],
      options
    )
    expect(mocks.normalizeGroupsForElements).not.toHaveBeenCalled()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('projects geometry only when an explicit target is an official Group', () => {
    const options = { undoable: true } as const
    mocks.projectGroupGeometryPropertyUpdates.mockReturnValue([
      {
        elementId: 'group-1',
        values: { x: 10, y: 20, width: 45, height: 40 }
      }
    ])

    updateElementProperties(['group-1'], { width: 45 }, options)

    expect(mocks.projectGroupGeometryPropertyUpdates).toHaveBeenCalledWith(
      expect.anything(),
      [{ elementId: 'group-1', values: { width: 45 } }],
      ['group-1']
    )
    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'group-1',
          values: { x: 10, y: 20, width: 45, height: 40 }
        }
      ],
      options
    )
  })

  it('submits a non-geometry property request unchanged through one Core call', () => {
    updateElementProperties(['rect-1'], { rotation: 15 })

    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [{ elementId: 'rect-1', values: { rotation: 15 } }],
      undefined
    )
    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    expect(mocks.projectGroupGeometryPropertyUpdates).not.toHaveBeenCalled()
    expect(mocks.normalizeGroupsForElements).not.toHaveBeenCalled()
  })

  it('does not call Core when explicit Group projection rejects the request', () => {
    mocks.projectGroupGeometryPropertyUpdates.mockImplementationOnce(() => {
      throw new Error('invalid later geometry target')
    })

    expect(() =>
      updateElementProperties(['group-1'], { width: 45 }, { undoable: true })
    ).toThrow(/invalid later geometry target/i)
    expect(mocks.updateElementProperties).not.toHaveBeenCalled()
  })
})
