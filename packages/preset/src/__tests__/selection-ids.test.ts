import { describe, expect, it } from 'vitest'
import { VECTOR_TOKENS } from '@asyra/core'
import {
  decodeVectorPointSelectionId,
  decodeVectorSegmentSelectionId,
  encodeVectorPointSelectionId,
  encodeVectorSegmentSelectionId
} from '../selection/ids.js'

describe('preset selection ids', () => {
  it('round-trips vector point and segment references with escaped ids', () => {
    const point = {
      elementId: 'vector:1',
      pointId: 'point/1',
      target: VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE
    }
    const segment = { elementId: 'vector:1', segmentId: 'segment/1' }

    expect(
      decodeVectorPointSelectionId(encodeVectorPointSelectionId(point))
    ).toEqual(point)
    expect(
      decodeVectorSegmentSelectionId(encodeVectorSegmentSelectionId(segment))
    ).toEqual(segment)
  })

  it('rejects malformed or unsupported references', () => {
    expect(decodeVectorPointSelectionId('element:point:unknown')).toBeNull()
    expect(decodeVectorPointSelectionId('element:point')).toBeNull()
    expect(decodeVectorSegmentSelectionId('element')).toBeNull()
  })
})
