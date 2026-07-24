import { describe, expect, it } from 'vitest'
import { resolveLayerPointerTarget } from './layer-dom-drop-target'

const pointResolver = (element: Element | null) => () => element

describe('Layers DOM drop target projection', () => {
  it('derives before, inside, and after zones from one stable Group row', () => {
    const row = document.createElement('div')
    row.dataset.layerElementId = 'group-1'
    row.dataset.layerIsGroup = 'true'
    row.getBoundingClientRect = () =>
      ({
        top: 10,
        bottom: 40,
        height: 30
      }) as DOMRect

    expect(
      resolveLayerPointerTarget(0, 12, pointResolver(row))
    ).toEqual({
      kind: 'row',
      elementId: 'group-1',
      zone: 'before'
    })
    expect(
      resolveLayerPointerTarget(0, 25, pointResolver(row))
    ).toEqual({
      kind: 'row',
      elementId: 'group-1',
      zone: 'inside'
    })
    expect(
      resolveLayerPointerTarget(0, 38, pointResolver(row))
    ).toEqual({
      kind: 'row',
      elementId: 'group-1',
      zone: 'after'
    })
  })

  it('uses before or after only for non-Group rows', () => {
    const row = document.createElement('div')
    row.dataset.layerElementId = 'shape'
    row.dataset.layerIsGroup = 'false'
    row.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 30,
        height: 30
      }) as DOMRect

    expect(
      resolveLayerPointerTarget(0, 14, pointResolver(row))
    ).toMatchObject({ zone: 'before' })
    expect(
      resolveLayerPointerTarget(0, 16, pointResolver(row))
    ).toMatchObject({ zone: 'after' })
  })

  it('returns workspace only for the explicit empty-area target', () => {
    const emptyArea = document.createElement('div')
    emptyArea.dataset.layerDropWorkspace = 'true'
    const outside = document.createElement('div')

    expect(
      resolveLayerPointerTarget(0, 0, pointResolver(emptyArea))
    ).toEqual({ kind: 'workspace' })
    expect(resolveLayerPointerTarget(0, 0, pointResolver(outside))).toBeNull()
    expect(resolveLayerPointerTarget(0, 0, pointResolver(null))).toBeNull()
  })
})
