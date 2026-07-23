import { describe, expect, it } from 'vitest'
import {
  VECTOR_HANDLE_MODES,
  VECTOR_TOKENS,
  getVectorControlId,
  getVectorNetworkAnchorHandleRefs,
  getVectorPointTargetPosition,
  isVectorAnchorNode,
  isVectorControlNode,
  isVectorHandleMode,
  sortVectorItemsById,
  type VectorPointNode
} from '../index'

const anchor: VectorPointNode = {
  id: 'anchor-1',
  kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
  x: 0,
  y: 0
}

const control: VectorPointNode = {
  id: 'control-1',
  kind: VECTOR_TOKENS.POINT.KIND.CONTROL,
  x: 10,
  y: 20
}

describe('vector type guards', () => {
  it('creates canonical control ids from the anchor and role', () => {
    expect(getVectorControlId('anchor-1', VECTOR_TOKENS.CONTROL.ROLE.IN)).toBe(
      'anchor-1:in'
    )
    expect(getVectorControlId('anchor-1', VECTOR_TOKENS.CONTROL.ROLE.OUT)).toBe(
      'anchor-1:out'
    )
  })

  it('projects the selected anchor or handle position', () => {
    const point = {
      x: 10,
      y: 20,
      inHandle: { x: 5, y: 15 },
      outHandle: null
    }

    expect(
      getVectorPointTargetPosition(point, VECTOR_TOKENS.POINT.TARGET.ANCHOR)
    ).toEqual({ x: 10, y: 20 })
    expect(
      getVectorPointTargetPosition(point, VECTOR_TOKENS.POINT.TARGET.IN_HANDLE)
    ).toEqual({ x: 5, y: 15 })
    expect(
      getVectorPointTargetPosition(point, VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE)
    ).toBeNull()
  })

  it('narrows vector point nodes by their canonical kind token', () => {
    expect(isVectorAnchorNode(anchor)).toBe(true)
    expect(isVectorAnchorNode(control)).toBe(false)
    expect(isVectorControlNode(control)).toBe(true)
    expect(isVectorControlNode(anchor)).toBe(false)
    expect(isVectorAnchorNode(undefined)).toBe(false)
    expect(isVectorControlNode(null)).toBe(false)
  })

  it('accepts only canonical vector handle modes', () => {
    expect(isVectorHandleMode(VECTOR_HANDLE_MODES.NONE)).toBe(true)
    expect(isVectorHandleMode(VECTOR_HANDLE_MODES.MIRROR_ANGLE)).toBe(true)
    expect(isVectorHandleMode(VECTOR_HANDLE_MODES.MIRROR_ANGLE_LENGTH)).toBe(
      true
    )
    expect(isVectorHandleMode('mirror-length')).toBe(false)
  })

  it('orders generated vector ids by numeric suffix without mutating input', () => {
    const items = [{ id: 'network-10' }, { id: 'network-2' }]

    expect(sortVectorItemsById(items)).toEqual([
      { id: 'network-2' },
      { id: 'network-10' }
    ])
    expect(items).toEqual([{ id: 'network-10' }, { id: 'network-2' }])
  })

  it('maps segment controls to their owning network anchors', () => {
    expect(
      getVectorNetworkAnchorHandleRefs(
        {
          pointIds: ['anchor-1', 'anchor-2'],
          segmentIds: ['segment-1']
        },
        {
          'segment-1': {
            id: 'segment-1',
            startId: 'anchor-1',
            endId: 'anchor-2',
            outControlId: 'control-out',
            inControlId: 'control-in'
          }
        }
      )
    ).toEqual(
      new Map([
        ['anchor-1', { inControlId: null, outControlId: 'control-out' }],
        ['anchor-2', { inControlId: 'control-in', outControlId: null }]
      ])
    )
  })
})
