import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  commitPropertyChanges: vi.fn(),
  getElementById: vi.fn(),
  updatePropertyById: vi.fn()
}))

vi.mock('../../contexts', () => ({
  default: {
    commitPropertyChanges: mocks.commitPropertyChanges,
    updatePropertyById: mocks.updatePropertyById
  },
  render: {},
  sceneTree: {
    getElementById: mocks.getElementById
  }
}))

import { fillApis } from '../fills'

describe('fill common API primary-color boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getElementById.mockReturnValue({
      getAllComputedData: () => ({
        fills: [
          {
            color: '#050504',
            colorFormat: 'hex',
            id: 'fill-1',
            opacity: 1,
            type: 'fill',
            visible: true
          }
        ],
        height: 39,
        width: 16
      })
    })
  })

  it('reads and updates the first canonical fill through property APIs', () => {
    expect(fillApis.getPrimaryFillColor('pupil-left')).toBe('#050504')

    expect(
      fillApis.updatePrimaryFillColor('pupil-left', '#DC2626', {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toBe(true)

    expect(mocks.updatePropertyById).toHaveBeenCalledWith(
      'fill-1',
      'color',
      '#DC2626',
      {
        ownerElementId: 'pupil-left',
        ownerPropertyName: 'fills'
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

  it('returns false without a write for missing fills or an unchanged color', () => {
    expect(fillApis.updatePrimaryFillColor('pupil-left', '#050504')).toBe(false)
    mocks.getElementById.mockReturnValue({
      getAllComputedData: () => ({ fills: [] })
    })

    expect(fillApis.getPrimaryFillColor('missing-fill')).toBeNull()
    expect(fillApis.updatePrimaryFillColor('missing-fill', '#DC2626')).toBe(
      false
    )
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
  })

  it('applies ordered primary fill colors with one property commit', () => {
    mocks.getElementById.mockImplementation((elementId: string) => ({
      getAllComputedData: () => ({
        fills: [
          {
            color: '#050504',
            id: `fill-${elementId}`,
            type: 'fill'
          }
        ]
      })
    }))
    const options = {
      sharedDelivery: 'immediate',
      undoable: true
    } as const

    expect(
      fillApis.updatePrimaryFillColors(
        [
          { color: '#DC2626', elementId: 'pupil-left' },
          { color: '#DC2626', elementId: 'pupil-right' }
        ],
        options
      )
    ).toEqual([true, true])
    expect(mocks.updatePropertyById.mock.calls).toEqual([
      [
        'fill-pupil-left',
        'color',
        '#DC2626',
        {
          ownerElementId: 'pupil-left',
          ownerPropertyName: 'fills'
        },
        options
      ],
      [
        'fill-pupil-right',
        'color',
        '#DC2626',
        {
          ownerElementId: 'pupil-right',
          ownerPropertyName: 'fills'
        },
        options
      ]
    ])
    expect(mocks.commitPropertyChanges).toHaveBeenCalledOnce()
    expect(mocks.commitPropertyChanges).toHaveBeenCalledWith(options)
  })

  it('aligns partial batch results and skips an empty property commit', () => {
    mocks.getElementById.mockImplementation((elementId: string) => {
      if (elementId === 'missing') {
        return undefined
      }
      return {
        getAllComputedData: () => ({
          fills: [
            {
              color: '#050504',
              id: `fill-${elementId}`,
              type: 'fill'
            }
          ]
        })
      }
    })

    expect(
      fillApis.updatePrimaryFillColors([
        { color: '#DC2626', elementId: 'changed' },
        { color: '#050504', elementId: 'unchanged' },
        { color: '#DC2626', elementId: 'missing' }
      ])
    ).toEqual([true, false, false])
    expect(mocks.updatePropertyById).toHaveBeenCalledOnce()
    expect(mocks.updatePropertyById).toHaveBeenCalledWith(
      'fill-changed',
      'color',
      '#DC2626',
      {
        ownerElementId: 'changed',
        ownerPropertyName: 'fills'
      },
      undefined
    )
    expect(mocks.commitPropertyChanges).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    mocks.getElementById.mockReturnValue({
      getAllComputedData: () => ({
        fills: [
          {
            color: '#050504',
            id: 'fill-unchanged',
            type: 'fill'
          }
        ]
      })
    })
    expect(
      fillApis.updatePrimaryFillColors([
        { color: '#050504', elementId: 'unchanged' }
      ])
    ).toEqual([false])
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
    expect(mocks.commitPropertyChanges).not.toHaveBeenCalled()
  })
})
