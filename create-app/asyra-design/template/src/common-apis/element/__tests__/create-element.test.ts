import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createElement: vi.fn(),
  createElementInParent: vi.fn(),
  changeComputedData: vi.fn(),
  getElementById: vi.fn(),
  getMousePosInWorkspace: vi.fn(),
  getRenderElementById: vi.fn(),
  getCanvasPositionFromWorkspace: vi.fn(),
  moveElementsWithGroupGeometry: vi.fn(),
  normalizeGroupsForElements: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  toLocal: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  runTransaction: mocks.runTransaction
}))

vi.mock('../../../contexts', () => ({
  default: {
    createElement: mocks.createElement,
    createElementInParent: mocks.createElementInParent,
    changeComputedData: mocks.changeComputedData,
    isContainerType: vi.fn((type: string) => type === 'group')
  },
  render: {
    getElementById: mocks.getRenderElementById,
    getMousePosInWorkspace: mocks.getMousePosInWorkspace
  },
  sceneTree: {
    getElementById: mocks.getElementById,
    workspace: 'workspace'
  }
}))

vi.mock('../vector-apis', () => ({
  vectorApis: {
    createVectorElement: vi.fn()
  }
}))

vi.mock('../change-computed-data', () => ({
  changeComputedData: vi.fn()
}))

vi.mock('@asyra/preset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/preset')>()),
  moveElementsWithGroupGeometry: mocks.moveElementsWithGroupGeometry,
  normalizeGroupsForElements: mocks.normalizeGroupsForElements
}))

vi.mock('../../viewport', () => ({
  viewportApis: {
    getCanvasPositionFromWorkspace: mocks.getCanvasPositionFromWorkspace
  }
}))

import { elementApis } from '../apis'

describe('create-element explicit parent and coordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createElement.mockReturnValue('legacy-created')
    mocks.createElementInParent.mockReturnValue('new-element')
    mocks.getMousePosInWorkspace.mockReturnValue({ x: 110, y: 220 })
    mocks.getElementById.mockImplementation((elementId: string) => {
      if (elementId !== 'group-2') {
        return undefined
      }
      return {
        get: (key: string) => {
          if (key === 'type') {
            return 'group'
          }
          if (key === 'children') {
            return ['existing-child']
          }
          return undefined
        }
      }
    })
    mocks.getCanvasPositionFromWorkspace.mockReturnValue({ x: 370, y: 480 })
    mocks.toLocal.mockReturnValue({ x: 10, y: 20 })
    mocks.getRenderElementById.mockReturnValue({
      toLocal: mocks.toLocal
    })
  })

  it('reparents an explicit Group create through the Preset geometry adapter', () => {
    expect(
      elementApis.createElement({
        type: 'rect',
        clientPosition: { x: 11, y: 22 },
        parentId: 'group-2'
      })
    ).toBe('new-element')

    expect(mocks.createElementInParent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rect',
        x: 110,
        y: 220
      }),
      'workspace',
      undefined,
      undefined
    )
    expect(mocks.moveElementsWithGroupGeometry).toHaveBeenCalledWith(
      expect.anything(),
      {
        elementIds: ['new-element'],
        targetParentId: 'group-2',
        targetIndex: 1
      },
      undefined
    )
    expect(mocks.createElement).not.toHaveBeenCalled()
  })

  it('turns an omitted parent into the explicit workspace root', () => {
    expect(
      elementApis.createElement({
        type: 'rect',
        clientPosition: { x: 11, y: 22 }
      })
    ).toBe('new-element')

    expect(mocks.getRenderElementById).not.toHaveBeenCalled()
    expect(mocks.moveElementsWithGroupGeometry).not.toHaveBeenCalled()
    expect(mocks.createElementInParent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rect',
        x: 110,
        y: 220
      }),
      'workspace',
      undefined,
      undefined
    )
    expect(mocks.createElement).not.toHaveBeenCalled()
  })

  it('creates from an explicit workspace position without a Render coordinate dependency', () => {
    const fills = [{ id: 'fill-1' }]
    const strokes = [{ id: 'stroke-1' }]

    expect(
      elementApis.createElement(
        {
          type: 'oval',
          workspacePosition: { x: 300, y: 240 },
          parentId: 'workspace',
          width: 80,
          height: 60,
          fills: fills as never,
          strokes: strokes as never
        },
        {
          sharedDelivery: 'transaction-end',
          undoable: true
        }
      )
    ).toBe('new-element')

    expect(mocks.getMousePosInWorkspace).not.toHaveBeenCalled()
    expect(mocks.createElementInParent).toHaveBeenCalledWith(
      {
        type: 'oval',
        x: 300,
        y: 240,
        fills,
        strokes,
        width: 80,
        height: 60
      },
      'workspace',
      undefined,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
  })

  it('converts workspace points through the current viewport and Group transform', () => {
    expect(
      elementApis.getPositionInParent('group-2', { x: 110, y: 220 })
    ).toEqual({ x: 10, y: 20 })

    expect(mocks.getCanvasPositionFromWorkspace).toHaveBeenCalledWith({
      x: 110,
      y: 220
    })
    expect(mocks.toLocal).toHaveBeenCalledWith({ x: 370, y: 480 })
  })

  it('normalizes affected Group bounds in the same geometry transaction', () => {
    elementApis.changeElementGeometry(
      'new-element',
      { x: 10, y: 20, width: 30, height: 40 },
      { sharedDelivery: 'immediate' }
    )

    expect(mocks.changeComputedData).toHaveBeenCalledWith(
      ['new-element'],
      { x: 10, y: 20, width: 30, height: 40 },
      { sharedDelivery: 'immediate' }
    )
    expect(mocks.normalizeGroupsForElements).toHaveBeenCalledWith(
      expect.anything(),
      ['new-element'],
      { sharedDelivery: 'immediate' }
    )
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })
})
