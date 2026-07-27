import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanonicalElementBatchResult } from '@asyra/core'
import type { FactoryMutationBatchDeliveryHandle } from '@asyra/factory'

const mocks = vi.hoisted(() => ({
  createElement: vi.fn(),
  createElementInParent: vi.fn(),
  createElementsInParentBatch: vi.fn(),
  createVectorElement: vi.fn(),
  createVectorElementsInParent: vi.fn(),
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
    createElementsInParentBatch: mocks.createElementsInParentBatch,
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

vi.mock('../vector-apis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../vector-apis')>()
  return {
    ...actual,
    vectorApis: {
      ...actual.vectorApis,
      createVectorElement: mocks.createVectorElement,
      createVectorElementsInParent: mocks.createVectorElementsInParent
    }
  }
})

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

  it('creates directly in a known Group origin without a post-hoc move', () => {
    expect(
      elementApis.createElement(
        {
          type: 'oval',
          workspacePosition: { x: 300, y: 240 },
          parentId: 'group-2',
          parentWorkspaceOrigin: { x: 250, y: 200 },
          width: 80,
          height: 60
        },
        {
          sharedDelivery: 'transaction-end',
          undoable: true
        }
      )
    ).toBe('new-element')

    expect(mocks.createElementInParent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oval',
        x: 50,
        y: 40,
        width: 80,
        height: 60
      }),
      'group-2',
      undefined,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(mocks.moveElementsWithGroupGeometry).not.toHaveBeenCalled()
  })

  it('routes an ordered Vector batch through one explicit parent operation', () => {
    const elements = [
      { type: 'vector', parentId: 'workspace' },
      { type: 'vector', parentId: 'workspace' }
    ] as const
    mocks.createVectorElementsInParent.mockReturnValue(['vector-1', 'vector-2'])

    expect(
      elementApis.createElements(elements, {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toEqual(['vector-1', 'vector-2'])
    expect(mocks.createVectorElementsInParent).toHaveBeenCalledOnce()
    expect(mocks.createVectorElementsInParent).toHaveBeenCalledWith(
      elements,
      'workspace',
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(mocks.createVectorElement).not.toHaveBeenCalled()
  })

  it('returns one canonical result for a mixed direct-parent batch', () => {
    const options = {
      sharedDelivery: 'transaction-end',
      undoable: true
    } as const
    const deliveryHandle: FactoryMutationBatchDeliveryHandle = {
      artifactId: 'delivery-1',
      transactionId: 1,
      artifact: null,
      setDeliveryPlan: vi.fn(),
      deliverSlice: vi.fn()
    }
    const canonicalResult: CanonicalElementBatchResult = {
      orderedElementIds: Object.freeze(['oval-1', 'vector-1']),
      deliveryHandle,
      timing: {
        owner: '@asyra/core',
        clock: 'monotonic',
        startedAtMs: 10,
        completedAtMs: 12,
        durationMs: 2
      }
    }
    mocks.createElementsInParentBatch.mockReturnValue(canonicalResult)

    const points = {
      pointA: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointA',
        kind: 'anchor' as const,
        x: 280,
        y: 220
      },
      pointB: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointB',
        kind: 'anchor' as const,
        x: 310,
        y: 260
      }
    }
    const segments = {
      segmentA: {
        endId: 'pointB',
        id: 'segmentA',
        inControlId: null,
        outControlId: null,
        startId: 'pointA'
      }
    }
    const networks = {
      networkA: {
        closed: false,
        id: 'networkA',
        pointIds: ['pointA', 'pointB'],
        segmentIds: ['segmentA']
      }
    }

    const result = elementApis.createElementsInParentBatch(
      [
        {
          type: 'oval',
          workspacePosition: { x: 300, y: 240 },
          parentId: 'group-2',
          parentWorkspaceOrigin: { x: 250, y: 200 },
          width: 80,
          height: 60
        },
        {
          type: 'vector',
          parentId: 'group-2',
          parentWorkspaceOrigin: { x: 250, y: 200 },
          points,
          segments,
          networks
        }
      ],
      'group-2',
      options
    )

    expect(result).toBe(canonicalResult)
    expect(result?.deliveryHandle).toBe(deliveryHandle)
    expect(mocks.createElementsInParentBatch).toHaveBeenCalledOnce()
    expect(mocks.createElementsInParentBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'oval',
          x: 50,
          y: 40,
          width: 80,
          height: 60
        }),
        expect.objectContaining({
          type: 'vector',
          x: 30,
          y: 20,
          width: 30,
          height: 40,
          points
        })
      ],
      'group-2',
      undefined,
      options
    )
    expect(mocks.createElementInParent).not.toHaveBeenCalled()
    expect(mocks.createVectorElementsInParent).not.toHaveBeenCalled()
  })

  it('does not call Core when a later direct-parent item fails preflight', () => {
    expect(
      elementApis.createElementsInParentBatch(
        [
          {
            type: 'oval',
            workspacePosition: { x: 300, y: 240 },
            parentId: 'group-2',
            parentWorkspaceOrigin: { x: 250, y: 200 }
          },
          {
            type: 'rect',
            workspacePosition: { x: Number.NaN, y: 260 },
            parentId: 'group-2',
            parentWorkspaceOrigin: { x: 250, y: 200 }
          }
        ],
        'group-2',
        {
          sharedDelivery: 'transaction-end',
          undoable: true
        }
      )
    ).toBeNull()
    expect(mocks.createElementsInParentBatch).not.toHaveBeenCalled()
    expect(mocks.createElementInParent).not.toHaveBeenCalled()
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
