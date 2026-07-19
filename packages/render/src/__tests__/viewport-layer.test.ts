import { describe, expect, it, vi } from 'vitest'
import { RenderLayer } from '../layers/scene'
import { ViewportLayer } from '../layers/viewport'
import type { RenderElementData } from '../types'

describe('ViewportLayer', () => {
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
