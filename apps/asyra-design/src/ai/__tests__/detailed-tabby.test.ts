import { describe, expect, it } from 'vitest'
import sourceSvg from '../../../test-data/ai-drawing/detailed-tabby-cat-only-white-background.svg?raw'
import maximumSourceSvg from '../../../test-data/ai-drawing/maximum-tabby-polygon.svg?raw'
import {
  createCatOnlyWhiteBackgroundItemsAtSource,
  type DetailedTabbyCompositionItem
} from '../../../test-data/ai-drawing/detailed-tabby'

const createItems = (itemLimit: number) =>
  createCatOnlyWhiteBackgroundItemsAtSource(sourceSvg, {
    height: 941,
    itemLimit,
    width: 1672
  })

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

describe('detailed-tabby bounded fixture owner', () => {
  it('creates exact deterministic 16-, 320-, and 1,280-item prefixes', () => {
    const fastItems = createItems(16)
    const mediumItems = createItems(320)
    const largeItems = createItems(1280)

    expect(fastItems).toHaveLength(16)
    expect(mediumItems).toHaveLength(320)
    expect(largeItems).toHaveLength(1280)

    expect(mediumItems.slice(0, fastItems.length)).toEqual(fastItems)
    expect(largeItems.slice(0, mediumItems.length)).toEqual(mediumItems)

    for (const items of [fastItems, mediumItems, largeItems]) {
      expect(items.every(({ primitive }) => primitive === 'vector')).toBe(true)
      expect(new Set(items.map(({ role }) => role)).size).toBe(items.length)
      expect(items[0]).toMatchObject({
        role: 'portrait-background',
        style: { fillColor: '#FFFFFF' }
      })
    }

    expect(countPoints(fastItems)).toBe(12_919)
    expect(countPoints(mediumItems)).toBe(51_768)
    expect(countPoints(largeItems)).toBe(86_474)
  })

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
