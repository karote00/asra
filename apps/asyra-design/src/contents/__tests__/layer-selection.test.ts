import { describe, expect, it } from 'vitest'
import { getVisibleRangeSelection } from '../layer-selection'

const canonicalIds = ['group', 'hidden-child', 'a', 'b', 'c']
const visibleIds = ['group', 'a', 'b', 'c']

describe('Layers visible-range selection', () => {
  it('adds the visible range in canonical order', () => {
    expect(
      getVisibleRangeSelection({
        canonicalIds,
        visibleIds,
        selectedIds: new Set(['a']),
        anchorId: 'a',
        clickedId: 'c'
      })
    ).toEqual({
      selectedIds: ['a', 'b', 'c'],
      anchorId: 'c'
    })
  })

  it('preserves a selected hidden descendant while using visible bounds', () => {
    expect(
      getVisibleRangeSelection({
        canonicalIds,
        visibleIds,
        selectedIds: new Set(['hidden-child', 'a']),
        anchorId: 'a',
        clickedId: 'b'
      })
    ).toEqual({
      selectedIds: ['hidden-child', 'a', 'b'],
      anchorId: 'b'
    })
  })

  it('retains hidden selection when no selected visible anchor exists', () => {
    expect(
      getVisibleRangeSelection({
        canonicalIds,
        visibleIds,
        selectedIds: new Set(['hidden-child']),
        anchorId: 'hidden-child',
        clickedId: 'c'
      })
    ).toEqual({
      selectedIds: ['hidden-child', 'c'],
      anchorId: 'c'
    })
  })

  it('rejects a clicked id that is not currently visible', () => {
    expect(
      getVisibleRangeSelection({
        canonicalIds,
        visibleIds,
        selectedIds: new Set(['a']),
        anchorId: 'a',
        clickedId: 'hidden-child'
      })
    ).toBeNull()
  })
})
