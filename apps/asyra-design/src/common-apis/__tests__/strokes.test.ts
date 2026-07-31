import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  changeComputedData: vi.fn(),
  commitPropertyChanges: vi.fn(),
  getElementById: vi.fn(),
  patchElementProperties: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  updatePropertyById: vi.fn()
}))

vi.mock('../../contexts', () => ({
  default: {
    changeComputedData: mocks.changeComputedData,
    commitPropertyChanges: mocks.commitPropertyChanges,
    deps: {
      sceneTree: {
        getElementById: mocks.getElementById
      }
    },
    patchElementProperties: mocks.patchElementProperties,
    updatePropertyById: mocks.updatePropertyById
  }
}))

vi.mock('../transaction', () => ({
  transactionApis: {
    runTransaction: mocks.runTransaction
  }
}))

import { strokeApis } from '../strokes'

describe('stroke common API primary-color boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getElementById.mockReturnValue({
      get: (key: string) => (key === 'type' ? 'vector' : undefined),
      getAllComputedData: () => ({
        strokes: [
          {
            id: 'stroke-1',
            type: 'stroke',
            style: 'solid',
            position: 'center',
            width: 3,
            dash: 20,
            gap: 20,
            fill: {
              id: 'stroke-1',
              type: 'fill',
              color: '#5B3A29',
              colorFormat: 'hex',
              opacity: 1,
              visible: true
            },
            joinType: 'miter',
            capType: 'butt',
            miterAngle: 28.96
          }
        ]
      })
    })
  })

  it('reads and patches the first canonical stroke through one Core record batch', () => {
    expect(strokeApis.getPrimaryStrokeColor('whisker-1')).toBe('#5B3A29')

    expect(
      strokeApis.updatePrimaryStrokeColor('whisker-1', '#2563EB', {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'whisker-1',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-1': {
                  style: 'solid',
                  position: 'center',
                  width: 3,
                  dash: 20,
                  gap: 20,
                  fill: {
                    color: '#2563EB',
                    colorFormat: 'hex',
                    id: 'stroke-1',
                    opacity: 1,
                    type: 'fill',
                    visible: true
                  },
                  joinType: 'miter',
                  capType: 'butt',
                  miterAngle: 28.96
                }
              }
            }
          ]
        }
      ],
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
    expect(mocks.commitPropertyChanges).not.toHaveBeenCalled()
    expect(mocks.changeComputedData).not.toHaveBeenCalled()
  })

  it('returns false without a write for missing strokes or an unchanged color', () => {
    expect(strokeApis.updatePrimaryStrokeColor('whisker-1', '#5B3A29')).toBe(
      false
    )
    mocks.getElementById.mockReturnValue({
      get: () => 'vector',
      getAllComputedData: () => ({ strokes: [] })
    })

    expect(strokeApis.getPrimaryStrokeColor('missing-stroke')).toBeNull()
    expect(
      strokeApis.updatePrimaryStrokeColor('missing-stroke', '#2563EB')
    ).toBe(false)
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
  })

  it('applies ordered primary stroke colors with one Core patch batch', () => {
    mocks.getElementById.mockImplementation((elementId: string) => ({
      get: (key: string) => (key === 'type' ? 'vector' : undefined),
      getAllComputedData: () => ({
        strokes: [
          {
            id: `stroke-${elementId}`,
            type: 'stroke',
            fill: {
              color: '#5B3A29',
              id: `stroke-${elementId}`,
              type: 'fill'
            }
          }
        ]
      })
    }))
    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const

    expect(
      strokeApis.updatePrimaryStrokeColors(
        [
          { color: '#2563EB', elementId: 'whisker-left' },
          { color: '#2563EB', elementId: 'whisker-right' }
        ],
        options
      )
    ).toEqual([true, true])
    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'whisker-left',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-whisker-left': {
                  fill: {
                    color: '#2563EB',
                    id: 'stroke-whisker-left',
                    type: 'fill'
                  }
                }
              }
            }
          ]
        },
        {
          elementId: 'whisker-right',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-whisker-right': {
                  fill: {
                    color: '#2563EB',
                    id: 'stroke-whisker-right',
                    type: 'fill'
                  }
                }
              }
            }
          ]
        }
      ],
      options
    )
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
    expect(mocks.commitPropertyChanges).not.toHaveBeenCalled()
    expect(mocks.changeComputedData).not.toHaveBeenCalled()
  })

  it('aligns partial batch results and skips an empty transaction', () => {
    mocks.getElementById.mockImplementation((elementId: string) => {
      if (elementId === 'missing') {
        return undefined
      }
      return {
        get: (key: string) => (key === 'type' ? 'vector' : undefined),
        getAllComputedData: () => ({
          strokes: [
            {
              fill: {
                color: '#5B3A29',
                id: `stroke-${elementId}`,
                type: 'fill'
              },
              id: `stroke-${elementId}`,
              type: 'stroke'
            }
          ]
        })
      }
    })

    expect(
      strokeApis.updatePrimaryStrokeColors([
        { color: '#2563EB', elementId: 'changed' },
        { color: '#5B3A29', elementId: 'unchanged' },
        { color: '#2563EB', elementId: 'missing' }
      ])
    ).toEqual([true, false, false])
    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'changed',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-changed': {
                  fill: {
                    color: '#2563EB',
                    id: 'stroke-changed',
                    type: 'fill'
                  }
                }
              }
            }
          ]
        }
      ],
      undefined
    )
    expect(mocks.runTransaction).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    mocks.getElementById.mockReturnValue({
      get: (key: string) => (key === 'type' ? 'vector' : undefined),
      getAllComputedData: () => ({
        strokes: [
          {
            fill: {
              color: '#5B3A29',
              id: 'stroke-unchanged',
              type: 'fill'
            },
            id: 'stroke-unchanged',
            type: 'stroke'
          }
        ]
      })
    })
    expect(
      strokeApis.updatePrimaryStrokeColors([
        { color: '#5B3A29', elementId: 'unchanged' }
      ])
    ).toEqual([false])
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('patches one changed stroke field as one record operation', () => {
    const currentStroke = mocks.getElementById('whisker-1').getAllComputedData()
      .strokes[0]

    strokeApis.updateStrokeField(
      'whisker-1',
      'stroke-1',
      currentStroke,
      'width',
      5,
      { undoable: true }
    )

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'whisker-1',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-1': {
                  style: 'solid',
                  position: 'center',
                  width: 5,
                  dash: 20,
                  gap: 20,
                  fill: {
                    color: '#5B3A29',
                    colorFormat: 'hex',
                    id: 'stroke-1',
                    opacity: 1,
                    type: 'fill',
                    visible: true
                  },
                  joinType: 'miter',
                  capType: 'butt',
                  miterAngle: 28.96
                }
              }
            }
          ]
        }
      ],
      { undoable: true }
    )
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
    expect(mocks.commitPropertyChanges).not.toHaveBeenCalled()
    expect(mocks.changeComputedData).not.toHaveBeenCalled()
  })

  it('coordinates vector bounds values and stroke record fields in the same patch item', () => {
    const currentStroke = {
      id: 'stroke-1',
      type: 'stroke',
      width: 3
    }
    mocks.getElementById.mockReturnValue({
      get: (key: string) => (key === 'type' ? 'vector' : undefined),
      getAllComputedData: () => ({
        height: 999,
        networks: {
          network: {
            id: 'network',
            segmentIds: [],
            vertexIds: ['point-1']
          }
        },
        pointCoordinateSpace: 'workspace',
        points: {
          'point-1': {
            id: 'point-1',
            x: 30,
            y: 40
          }
        },
        segments: {},
        width: 999,
        x: 0,
        y: 0
      })
    })

    strokeApis.updateStrokeFields(
      'whisker-1',
      'stroke-1',
      currentStroke as never,
      {
        width: 5
      },
      { undoable: true }
    )

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'whisker-1',
          records: [
            {
              key: 'strokes',
              set: {
                'stroke-1': {
                  width: 5
                }
              }
            }
          ],
          values: {
            height: 0.1,
            width: 0.1
          }
        }
      ],
      { undoable: true }
    )
    expect(mocks.changeComputedData).not.toHaveBeenCalled()
  })
})
