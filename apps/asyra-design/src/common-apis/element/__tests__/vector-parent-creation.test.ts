import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createElementsInParent: vi.fn(),
  getSystemProperty: vi.fn(),
  patchLocalComputedData: vi.fn(),
  patchElementProperties: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation())
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  runTransaction: mocks.runTransaction
}))

vi.mock('../../../contexts', () => ({
  default: {
    createElementsInParent: mocks.createElementsInParent,
    getSystemProperty: mocks.getSystemProperty,
    patchLocalComputedData: mocks.patchLocalComputedData,
    patchElementProperties: mocks.patchElementProperties
  },
  render: null,
  sceneTree: {
    getElementById: vi.fn(() => ({
      getAllComputedData: () => ({
        x: 0,
        y: 0,
        width: 20,
        height: 10,
        closed: false,
        pointCoordinateSpace: 'workspace',
        points: {
          pointA: {
            anchorType: 'sharp',
            handleMode: 'none',
            id: 'pointA',
            kind: 'anchor',
            x: 0,
            y: 0
          },
          pointB: {
            anchorType: 'sharp',
            handleMode: 'none',
            id: 'pointB',
            kind: 'anchor',
            x: 20,
            y: 10
          }
        },
        segments: {
          segmentA: {
            endId: 'pointB',
            id: 'segmentA',
            inControlId: null,
            outControlId: null,
            startId: 'pointA'
          }
        },
        networks: {
          networkA: {
            closed: false,
            id: 'networkA',
            pointIds: ['pointA', 'pointB'],
            segmentIds: ['segmentA']
          }
        }
      })
    }))
  }
}))

vi.mock('../../selection', () => ({
  selectionApis: {
    clearVectorPointSelection: vi.fn(),
    clearVectorSegmentSelection: vi.fn(),
    getSelectedVectorPoints: vi.fn(() => []),
    getSelectedVectorSegments: vi.fn(() => [])
  }
}))

vi.mock('../../system-context', () => ({
  systemContextApis: {
    getHoveredVectorPoint: vi.fn(() => null),
    getHoveredVectorSegment: vi.fn(() => null),
    getHoveredVectorSegmentInsertPoint: vi.fn(() => null),
    getSelectedVectorPoint: vi.fn(() => null),
    setHoveredVectorPoint: vi.fn(),
    setHoveredVectorSegment: vi.fn(),
    setHoveredVectorSegmentInsertPoint: vi.fn(),
    setSelectedVectorPoint: vi.fn(),
    setSelectedVectorSegment: vi.fn()
  }
}))

import { vectorApis } from '../vector-apis'

describe('Vector direct parent creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createElementsInParent.mockReturnValue(['vector-1'])
    mocks.getSystemProperty.mockReturnValue(false)
  })

  it('keeps workspace topology points and stores Group-local computed bounds', () => {
    const points = {
      pointA: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointA',
        kind: 'anchor' as const,
        x: 100,
        y: 200
      },
      pointB: {
        anchorType: 'sharp' as const,
        handleMode: 'none' as const,
        id: 'pointB',
        kind: 'anchor' as const,
        x: 130,
        y: 240
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

    expect(
      vectorApis.createVectorElementsInParent(
        [
          {
            networks,
            parentId: 'group-1',
            parentWorkspaceOrigin: { x: 90, y: 180 },
            points,
            segments,
            type: 'vector'
          }
        ],
        'group-1',
        {
          sharedDelivery: 'transaction-end',
          undoable: true
        }
      )
    ).toEqual(['vector-1'])

    expect(mocks.createElementsInParent).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          height: 40,
          pointCoordinateSpace: 'workspace',
          points,
          type: 'vector',
          width: 30,
          x: 10,
          y: 20
        })
      ],
      'group-1',
      undefined,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
  })
})

describe('Vector canonical property commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSystemProperty.mockReturnValue(false)
  })

  it('commits final topology as one ordered canonical property patch', () => {
    expect(vectorApis.removeVectorAnchorPoint('vector-1', 'pointB')).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            width: 0.1,
            height: 0.1
          },
          records: [
            {
              key: 'points',
              remove: ['pointB']
            },
            {
              key: 'segments',
              remove: ['segmentA']
            },
            {
              key: 'networks',
              set: {
                networkA: {
                  closed: false,
                  pointIds: ['pointA'],
                  segmentIds: []
                }
              }
            }
          ]
        }
      ],
      {}
    )
    expect(mocks.patchLocalComputedData).not.toHaveBeenCalled()
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
  })

  it('keeps transient drag preview on the local computed route', () => {
    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )

    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 25, y: 15 },
        {
          skipResult: true,
          undoable: false
        }
      )
    ).toBe(true)

    expect(mocks.patchLocalComputedData).toHaveBeenCalledOnce()
    expect(mocks.patchLocalComputedData).toHaveBeenCalledWith([
      {
        elementId: 'vector-1',
        patch: expect.objectContaining({
          records: expect.objectContaining({
            points: expect.any(Object)
          })
        })
      }
    ])
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('keeps transient structural preview on the same local patch batch route', () => {
    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )

    expect(
      vectorApis.appendVectorAnchorPoint(
        'vector-1',
        {
          id: 'pointC',
          type: 'sharp',
          x: 30,
          y: 20,
          inHandle: null,
          outHandle: null
        },
        {
          undoable: false
        }
      )
    ).toEqual(
      expect.objectContaining({
        point: expect.objectContaining({
          id: 'pointC',
          x: 30,
          y: 20
        })
      })
    )

    expect(mocks.patchLocalComputedData).toHaveBeenCalledOnce()
    expect(mocks.patchLocalComputedData).toHaveBeenCalledWith([
      {
        elementId: 'vector-1',
        patch: expect.objectContaining({
          records: expect.objectContaining({
            points: expect.any(Object)
          })
        })
      }
    ])
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('commits a final point move through canonical properties', () => {
    expect(
      vectorApis.updateVectorAnchorPointPosition(
        'vector-1',
        'pointB',
        { x: 25, y: 15 },
        {
          skipResult: true,
          undoable: true
        }
      )
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          values: {
            x: 0,
            y: 0,
            width: 25,
            height: 15,
            closed: false
          },
          records: [
            {
              key: 'points',
              set: {
                pointB: {
                  anchorType: 'sharp',
                  handleMode: 'none',
                  kind: 'anchor',
                  x: 25,
                  y: 15
                }
              }
            }
          ]
        }
      ],
      {
        undoable: true
      }
    )
    expect(mocks.patchLocalComputedData).not.toHaveBeenCalled()
  })

  it('commits all accepted vector positions once and preserves ordered ids', () => {
    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const
    mocks.patchElementProperties.mockImplementation(
      (patches: readonly { elementId: string }[]) =>
        patches.map(({ elementId }) => elementId)
    )

    expect(
      vectorApis.setVectorElementPositions(
        [
          {
            elementId: 'vector-1',
            position: { x: 10, y: 20 }
          },
          {
            elementId: 'vector-no-op',
            position: { x: 0, y: 0 }
          },
          {
            elementId: 'vector-invalid',
            position: { x: Number.NaN, y: 10 }
          },
          {
            elementId: 'vector-2',
            position: { x: -5, y: 15 }
          }
        ],
        options
      )
    ).toEqual(['vector-1', 'vector-2'])

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    const [patches, receivedOptions] =
      mocks.patchElementProperties.mock.calls[0]
    expect(receivedOptions).toBe(options)
    expect(
      patches.map((patch: { elementId: string }) => patch.elementId)
    ).toEqual(['vector-1', 'vector-2'])
    expect(patches[0]).toMatchObject({
      values: {
        x: 10,
        y: 20
      },
      records: [
        {
          key: 'points',
          set: {
            pointA: {
              x: 10,
              y: 20
            },
            pointB: {
              x: 30,
              y: 30
            }
          }
        }
      ]
    })
    expect(patches[1]).toMatchObject({
      values: {
        x: -5,
        y: 15
      },
      records: [
        {
          key: 'points',
          set: {
            pointA: {
              x: -5,
              y: 15
            },
            pointB: {
              x: 15,
              y: 25
            }
          }
        }
      ]
    })
  })

  it('delegates the single vector position convenience to batch-of-one', () => {
    const options = { undoable: true } as const
    const setVectorElementPositions = vi
      .spyOn(vectorApis, 'setVectorElementPositions')
      .mockReturnValue(['vector-1'])

    expect(
      vectorApis.setVectorElementPosition('vector-1', { x: 10, y: 20 }, options)
    ).toBe(true)
    expect(setVectorElementPositions).toHaveBeenCalledWith(
      [
        {
          elementId: 'vector-1',
          position: { x: 10, y: 20 }
        }
      ],
      options
    )
    setVectorElementPositions.mockRestore()
  })
})
