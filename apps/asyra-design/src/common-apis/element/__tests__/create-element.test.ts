import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createElement: vi.fn(),
  createElementInParent: vi.fn(),
  createElementsInParent: vi.fn(),
  createVectorElement: vi.fn(),
  createVectorElementsInParent: vi.fn(),
  updateElementProperties: vi.fn(),
  getElementById: vi.fn(),
  getSystemProperty: vi.fn(),
  getMousePosInWorkspace: vi.fn(),
  getRenderElementById: vi.fn(),
  getCanvasPositionFromWorkspace: vi.fn(),
  moveElementsWithGroupGeometry: vi.fn(),
  normalizeGroupsForElements: vi.fn(),
  patchElementProperties: vi.fn(),
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
    createElementsInParent: mocks.createElementsInParent,
    getSystemProperty: mocks.getSystemProperty,
    patchElementProperties: mocks.patchElementProperties,
    updateElementProperties: mocks.updateElementProperties,
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

vi.mock('../update-element-properties', () => ({
  updateElementProperties: vi.fn()
}))

vi.mock('@asyra/preset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/preset')>()),
  moveElementsWithGroupGeometry: mocks.moveElementsWithGroupGeometry,
  normalizeGroupsForElements: mocks.normalizeGroupsForElements,
  projectGroupGeometryPropertyUpdates: mocks.projectGroupGeometryPropertyUpdates
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
    mocks.projectGroupGeometryPropertyUpdates.mockImplementation(
      (_core, updates) => updates
    )
    mocks.createElement.mockReturnValue('legacy-created')
    mocks.createElementInParent.mockReturnValue('new-element')
    mocks.getSystemProperty.mockReturnValue(false)
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

  it('forwards one prepared descriptor batch by identity and returns frozen ordered ids', () => {
    const options = {
      sharedDelivery: 'transaction-end',
      undoable: true
    } as const
    const coreResult = ['oval-1', 'vector-1']
    mocks.createElementsInParent.mockReturnValue(coreResult)

    const descriptors = Object.freeze([
      Object.freeze({
        fills: [],
        height: 60,
        id: 'oval-1',
        lock: false,
        name: 'Oval 1',
        props: Object.freeze({
          dimension: 'oval-1-dimension',
          position: 'oval-1-position'
        }),
        strokes: [],
        type: 'oval' as const,
        visible: true,
        width: 80,
        x: 50,
        y: 40
      }),
      Object.freeze({
        closed: false,
        fills: [],
        height: 40,
        id: 'vector-1',
        lock: false,
        name: 'Vector 1',
        networks: {},
        points: {},
        props: Object.freeze({
          dimension: 'vector-1-dimension',
          position: 'vector-1-position'
        }),
        segments: {},
        strokes: [],
        type: 'vector' as const,
        visible: true,
        width: 30,
        x: 30,
        y: 20
      })
    ])

    const result = elementApis.createElementsInParent(
      descriptors,
      'group-2',
      options
    )

    expect(result).toEqual(coreResult)
    expect(result).not.toBe(coreResult)
    expect(Object.isFrozen(result)).toBe(true)
    expect(mocks.createElementsInParent).toHaveBeenCalledOnce()
    expect(mocks.createElementsInParent).toHaveBeenCalledWith(
      descriptors,
      'group-2',
      undefined,
      options
    )
    expect(mocks.createElementInParent).not.toHaveBeenCalled()
    expect(mocks.createVectorElementsInParent).not.toHaveBeenCalled()
  })

  it('leaves descriptor preflight to the canonical Core owner', () => {
    const descriptors = Object.freeze([
      Object.freeze({
        fills: [],
        height: 20,
        id: 'oval-1',
        lock: false,
        name: 'Oval 1',
        props: Object.freeze({
          dimension: 'oval-1-dimension',
          position: 'oval-1-position'
        }),
        strokes: [],
        type: 'oval' as const,
        visible: true,
        width: 20,
        x: 0,
        y: 0
      }),
      Object.freeze({
        fills: [],
        height: 20,
        id: 'rect-1',
        lock: false,
        name: 'Rect 1',
        props: Object.freeze({
          dimension: 'rect-1-dimension',
          position: 'rect-1-position'
        }),
        strokes: [],
        type: 'rect' as const,
        visible: true,
        width: 20,
        x: Number.NaN,
        y: 0
      })
    ])
    mocks.createElementsInParent.mockReturnValue(['oval-1', 'rect-1'])

    expect(
      elementApis.createElementsInParent(descriptors, 'group-2', {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toEqual(['oval-1', 'rect-1'])
    expect(mocks.createElementsInParent).toHaveBeenCalledWith(
      descriptors,
      'group-2',
      undefined,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
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

  it('submits changed geometry and affected Group bounds through one property request', () => {
    mocks.projectGroupGeometryPropertyUpdates.mockReturnValue([
      {
        elementId: 'new-element',
        values: { x: 0, y: 0, width: 30, height: 40 }
      },
      {
        elementId: 'group-2',
        values: { x: 10, y: 20, width: 30, height: 40 }
      }
    ])

    elementApis.changeElementGeometry(
      'new-element',
      { x: 10, y: 20, width: 30, height: 40 },
      { sharedDelivery: 'immediate' }
    )

    expect(mocks.projectGroupGeometryPropertyUpdates).toHaveBeenCalledWith(
      expect.anything(),
      [
        {
          elementId: 'new-element',
          values: { x: 10, y: 20, width: 30, height: 40 }
        }
      ]
    )
    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'new-element',
          values: { x: 0, y: 0, width: 30, height: 40 }
        },
        {
          elementId: 'group-2',
          values: { x: 10, y: 20, width: 30, height: 40 }
        }
      ],
      { sharedDelivery: 'immediate' }
    )
    expect(mocks.normalizeGroupsForElements).not.toHaveBeenCalled()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('submits one typed plural property patch through one transaction', () => {
    const patches = [
      {
        elementId: 'vector-1',
        records: [
          {
            key: 'points',
            set: {
              A: { kind: 'anchor', x: 10, y: 20 }
            }
          }
        ]
      }
    ] as const
    const options = { undoable: true } as const

    elementApis.patchElementProperties(patches, options)

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(patches, options)
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('defers Group normalization while applying one non-vector gesture sample', () => {
    mocks.getElementById.mockImplementation((elementId: string) => {
      const positions: Record<string, { x: number; y: number }> = {
        'rect-1': { x: 0, y: 0 },
        'rect-2': { x: 10, y: 20 }
      }
      const position = positions[elementId]
      if (!position) {
        return undefined
      }
      return {
        get: (key: string) => (key === 'type' ? 'rect' : undefined),
        getAllComputedData: () => ({
          ...position,
          width: 100,
          height: 100
        })
      }
    })
    elementApis.setElementPositions(
      {
        'rect-1': { x: 30, y: 40 },
        'rect-2': { x: 50, y: 60 }
      },
      { sharedDelivery: 'immediate' }
    )

    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    expect(mocks.projectGroupGeometryPropertyUpdates).not.toHaveBeenCalled()
    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'rect-1',
          values: { x: 30, y: 40 }
        },
        {
          elementId: 'rect-2',
          values: { x: 50, y: 60 }
        }
      ],
      { sharedDelivery: 'immediate' }
    )
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('coordinates mixed Vector and ordinary positions through one transform owner batch', () => {
    mocks.getElementById.mockImplementation((elementId: string) => {
      const fixtures: Record<
        string,
        {
          type: 'rect' | 'vector'
          computed: Record<string, unknown>
        }
      > = {
        'vector-1': {
          type: 'vector',
          computed: {
            x: 0,
            y: 0,
            width: 0.1,
            height: 0.1,
            closed: false,
            pointCoordinateSpace: 'local',
            points: {
              pointA: {
                anchorType: 'sharp',
                handleMode: 'none',
                id: 'pointA',
                kind: 'anchor',
                x: 0,
                y: 0
              }
            },
            segments: {},
            networks: {
              networkA: {
                closed: false,
                id: 'networkA',
                pointIds: ['pointA'],
                segmentIds: []
              }
            }
          }
        },
        'rect-1': {
          type: 'rect',
          computed: { x: 5, y: 6, width: 10, height: 10 }
        },
        'vector-2': {
          type: 'vector',
          computed: {
            x: 100,
            y: 200,
            width: 0.1,
            height: 0.1,
            closed: false,
            pointCoordinateSpace: 'workspace',
            points: {
              pointB: {
                anchorType: 'sharp',
                handleMode: 'none',
                id: 'pointB',
                kind: 'anchor',
                x: 0,
                y: 0
              }
            },
            segments: {},
            networks: {
              networkB: {
                closed: false,
                id: 'networkB',
                pointIds: ['pointB'],
                segmentIds: []
              }
            }
          }
        },
        'vector-no-op': {
          type: 'vector',
          computed: {
            x: 9,
            y: 11,
            width: 0.1,
            height: 0.1,
            closed: false,
            pointCoordinateSpace: 'local',
            points: {
              pointC: {
                anchorType: 'sharp',
                handleMode: 'none',
                id: 'pointC',
                kind: 'anchor',
                x: 0,
                y: 0
              }
            },
            segments: {},
            networks: {}
          }
        },
        'rect-no-op': {
          type: 'rect',
          computed: { x: 15, y: 16, width: 10, height: 10 }
        }
      }
      const fixture = fixtures[elementId]
      if (!fixture) {
        return undefined
      }
      return {
        get: (key: string) => (key === 'type' ? fixture.type : undefined),
        getAllComputedData: () => fixture.computed
      }
    })

    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const

    elementApis.setElementPositions(
      {
        'vector-1': { x: 10, y: 20 },
        'rect-1': { x: 7, y: 8 },
        'vector-2': { x: 120, y: 230 },
        'vector-no-op': { x: 9, y: 11 },
        'rect-no-op': { x: 15, y: 16 }
      },
      options
    )

    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.updateElementProperties).toHaveBeenCalledOnce()
    expect(mocks.projectGroupGeometryPropertyUpdates).not.toHaveBeenCalled()
    expect(mocks.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: { x: 10, y: 20 }
        },
        {
          elementId: 'rect-1',
          values: { x: 7, y: 8 }
        },
        {
          elementId: 'vector-2',
          values: { x: 120, y: 230 }
        }
      ],
      options
    )
  })
})
