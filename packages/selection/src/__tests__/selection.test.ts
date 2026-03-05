import { describe, it, expect, beforeEach } from 'vitest'
import BaseSelection from '../selections/base-selection'

describe('Selection', () => {
  let selection: BaseSelection

  beforeEach(() => {
    selection = new BaseSelection({
      selectionType: 'element',
      selectAction: 'selectElements',
      eventName: 'selectElements'
    })
  })

  it('should initialize with no selected ids', () => {
    expect(selection.getSelectedIds()).toEqual(new Set([]))
    expect(selection.getPrevSelectedIds()).toEqual(new Set([]))
  })

  it('should select ids correctly', () => {
    selection.select(['id1', 'id2'])

    expect(selection.getSelectedIds()).toEqual(new Set(['id1', 'id2']))
  })

  it('should deselect id correctly', () => {
    selection.select(['id1', 'id2'])
    selection.deselect(['id1'])

    expect(selection.getSelectedIds()).toEqual(new Set(['id2']))
  })

  it('should clear selection correctly', () => {
    selection.select(['id1', 'id2'])
    selection.clear()

    expect(selection.getSelectedIds()).toEqual(new Set([]))
  })

  it('should store previous selected ids when selecting', () => {
    expect(selection.getPrevSelectedIds()).toEqual(new Set([]))

    selection.select(['id1', 'id2'])
    expect(selection.getPrevSelectedIds()).toEqual(new Set([]))

    selection.select(['id3'])
    expect(selection.getPrevSelectedIds()).toEqual(new Set(['id1', 'id2']))
  })

  it('should store previous selected ids when deselecting', () => {
    selection.select(['id1', 'id2'])
    selection.deselect(['id1'])

    expect(selection.getPrevSelectedIds()).toEqual(new Set(['id1', 'id2']))
  })

  it('should store previous selected ids when clearing', () => {
    selection.select(['id1', 'id2'])
    selection.clear()

    expect(selection.getPrevSelectedIds()).toEqual(new Set(['id1', 'id2']))
  })

  it('should not add change for no-op select([]) when already empty', () => {
    selection.select([])

    expect(selection.changes).toEqual([])
  })

  it('should not add change for no-op clear() when already empty', () => {
    selection.clear()

    expect(selection.changes).toEqual([])
  })

  it('should not add change for no-op deselect on missing id', () => {
    selection.select(['id1'])
    selection.cleanChanges()

    selection.deselect(['missing-id'])

    expect(selection.changes).toEqual([])
    expect(selection.getSelectedIds()).toEqual(new Set(['id1']))
  })
})
