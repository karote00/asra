import { describe, expect, it } from 'vitest'
import maximumSourceSvg from '../../../test-data/ai-drawing/maximum-tabby-polygon.svg?raw'
import {
  createCatOnlyWhiteBackgroundItemsAtSource,
  type DetailedTabbyCompositionItem
} from '../../../test-data/ai-drawing/detailed-tabby'

const countPoints = (items: readonly DetailedTabbyCompositionItem[]): number =>
  items.reduce(
    (itemTotal, item) =>
      itemTotal +
      (item.paths?.reduce(
        (pathTotal, path) => pathTotal + path.points.length,
        0
      ) ?? 0),
    0
  )

describe('maximum-detail tabby SVG fixture owner', () => {
  it('preserves the complete 27,471-item, 295,794-point maximum-detail source', () => {
    const items = createCatOnlyWhiteBackgroundItemsAtSource(maximumSourceSvg, {
      height: 941,
      width: 1672
    })

    expect(items).toHaveLength(27_471)
    expect(countPoints(items)).toBe(295_794)
    expect(items.every(({ primitive }) => primitive === 'vector')).toBe(true)
    expect(new Set(items.map(({ role }) => role)).size).toBe(items.length)
    expect(items[0]).toMatchObject({
      role: 'portrait-background',
      style: { fillColor: '#FFFFFF' }
    })
  })
})
