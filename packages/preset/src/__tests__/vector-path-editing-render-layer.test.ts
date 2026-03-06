import { describe, expect, it } from 'vitest'
import { getVisibleHandleAnchorIds } from '../render-layers/vector-path-editing-render-layer'

describe('vector path editing handle visibility', () => {
  it('shows n-1/n/n+1 for open subpath without wrapping', () => {
    const subpaths = [
      {
        closed: false,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null },
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, 'a')
    expect(visible).toEqual(new Set(['a', 'b']))
  })

  it('wraps neighbors for closed subpath so endpoint selection shows both sides', () => {
    const subpaths = [
      {
        closed: true,
        segmentIds: [],
        points: [
          { id: 'a', x: 0, y: 0, inHandle: null, outHandle: null },
          { id: 'b', x: 1, y: 0, inHandle: null, outHandle: null },
          { id: 'c', x: 2, y: 0, inHandle: null, outHandle: null }
        ]
      }
    ]

    const visible = getVisibleHandleAnchorIds(subpaths, 'a')
    expect(visible).toEqual(new Set(['a', 'b', 'c']))
  })
})
