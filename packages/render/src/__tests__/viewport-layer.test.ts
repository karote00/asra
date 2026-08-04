import { describe, expect, it, vi } from 'vitest'
import { RenderLayer } from '../layers/scene/index.js'
import { ViewportLayer } from '../layers/viewport/index.js'
import type { RenderElementData } from '../types.js'

describe('ViewportLayer', () => {
  it('reports the exact number of projected RenderLayer elements without exposing the map', () => {
    const projectedElements = new Map([
      ['group-1', {}],
      ['vector-1', {}]
    ])
    const getAllElementsSpy = vi
      .spyOn(RenderLayer.prototype, 'getAllElements')
      .mockReturnValue(projectedElements as never)
    const viewport = new ViewportLayer()

    expect(viewport.getProjectedElementCount()).toBe(2)
    expect(getAllElementsSpy).toHaveBeenCalledOnce()
  })

  it('forwards the committed sibling index when adding an element', () => {
    const data = {
      id: 'indexed-element',
      type: 'rectangle',
      visible: true
    } as unknown as RenderElementData
    const addElementSpy = vi
      .spyOn(RenderLayer.prototype, 'addElement')
      .mockReturnValue(undefined)
    const viewport = new ViewportLayer()

    viewport.addElement(data, 2)

    expect(addElementSpy).toHaveBeenCalledWith(data, 2)
  })
})
