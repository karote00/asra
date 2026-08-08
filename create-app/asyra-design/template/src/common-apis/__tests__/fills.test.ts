import type { FillAttrs } from '@asyra/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  commitPropertyChanges: vi.fn(),
  getElementById: vi.fn(),
  patchElementProperties: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  updatePropertyById: vi.fn()
}))

vi.mock('../../contexts', () => ({
  default: {
    commitPropertyChanges: mocks.commitPropertyChanges,
    getElementComputedData: (elementId: string) =>
      mocks.getElementById(elementId)?.getAllComputedData(),
    getElementData: (elementId: string) =>
      mocks.getElementById(elementId) ? { id: elementId } : undefined,
    patchElementProperties: mocks.patchElementProperties,
    updatePropertyById: mocks.updatePropertyById
  }
}))

vi.mock('../transaction', () => ({
  transactionApis: {
    runTransaction: mocks.runTransaction
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

  it('adds and removes one repeatable fill through canonical record patches', () => {
    const fillId = fillApis.addFill('pupil-left', { undoable: true })

    expect(fillId).toEqual(expect.any(String))
    expect(fillId).not.toBe('')
    expect(mocks.patchElementProperties).toHaveBeenNthCalledWith(
      1,
      [
        {
          elementId: 'pupil-left',
          records: [
            {
              key: 'fills',
              set: {
                [fillId as string]: expect.objectContaining({
                  color: '#cccccc',
                  kind: 'solid',
                  visible: true
                })
              }
            }
          ]
        }
      ],
      { undoable: true }
    )

    expect(
      fillApis.removeFill('pupil-left', 'fill-1', { undoable: true })
    ).toBe(true)
    expect(mocks.patchElementProperties).toHaveBeenNthCalledWith(
      2,
      [
        {
          elementId: 'pupil-left',
          records: [
            {
              key: 'fills',
              remove: ['fill-1']
            }
          ]
        }
      ],
      { undoable: true }
    )
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2)
  })

  it('reads and patches the first canonical fill through one Core record batch', () => {
    expect(fillApis.getPrimaryFillColor('pupil-left')).toBe('#050504')

    expect(
      fillApis.updatePrimaryFillColor('pupil-left', '#DC2626', {
        sharedDelivery: 'transaction-end',
        undoable: true
      })
    ).toBe(true)

    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'pupil-left',
          records: [
            {
              key: 'fills',
              set: {
                'fill-1': {
                  color: '#DC2626',
                  colorFormat: 'hex',
                  opacity: 1,
                  visible: true
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
    expect(mocks.runTransaction).toHaveBeenCalledOnce()
    expect(mocks.updatePropertyById).not.toHaveBeenCalled()
    expect(mocks.commitPropertyChanges).not.toHaveBeenCalled()
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
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
  })

  it('applies ordered primary fill colors with one Core patch batch', () => {
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
    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'pupil-left',
          records: [
            {
              key: 'fills',
              set: {
                'fill-pupil-left': {
                  color: '#DC2626'
                }
              }
            }
          ]
        },
        {
          elementId: 'pupil-right',
          records: [
            {
              key: 'fills',
              set: {
                'fill-pupil-right': {
                  color: '#DC2626'
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
  })

  it('aligns partial batch results and skips an empty transaction', () => {
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
    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'changed',
          records: [
            {
              key: 'fills',
              set: {
                'fill-changed': {
                  color: '#DC2626'
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
    expect(mocks.patchElementProperties).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('preserves canonical fill fields without forwarding UI aggregation metadata', () => {
    const currentFill = {
      color: '#050504',
      colorFormat: 'hex',
      id: 'fill-1',
      ids: ['fill-1'],
      opacity: 1,
      type: 'fill',
      visible: true
    } as FillAttrs & { ids: string[] }
    const options = {
      sharedDelivery: 'transaction-end',
      undoable: true
    } as const

    fillApis.updateFillFields(
      'rect-1',
      'fill-1',
      currentFill,
      {
        opacity: 0.5,
        visible: false
      },
      options
    )

    expect(mocks.patchElementProperties).toHaveBeenCalledOnce()
    expect(mocks.patchElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'rect-1',
          records: [
            {
              key: 'fills',
              set: {
                'fill-1': {
                  color: '#050504',
                  colorFormat: 'hex',
                  opacity: 0.5,
                  visible: false
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
  })
})
