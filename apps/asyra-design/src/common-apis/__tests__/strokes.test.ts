import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  changeComputedData: vi.fn(),
  commitPropertyChanges: vi.fn(),
  getElementById: vi.fn(),
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

  it('reads and updates the first canonical stroke through property APIs', () => {
    expect(strokeApis.getPrimaryStrokeColor('whisker-1')).toBe('#5B3A29')

    expect(
      strokeApis.updatePrimaryStrokeColor('whisker-1', '#2563EB', {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toBe(true)

    expect(mocks.updatePropertyById).toHaveBeenCalledWith(
      'stroke-1',
      'fill',
      expect.objectContaining({
        color: '#2563EB',
        id: 'stroke-1'
      }),
      {
        ownerElementId: 'whisker-1',
        ownerPropertyName: 'strokes'
      },
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(mocks.commitPropertyChanges).toHaveBeenCalledWith({
      sharedDelivery: 'transaction-end',
      undoable: true
    })
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
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
  })
})
