import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  calculateZoomFit: vi.fn(),
  core: {
    getAllElementsBounds: vi.fn(),
    getSystemProperty: vi.fn(),
    setSystemProperty: vi.fn()
  }
}))

vi.mock('../../contexts', () => ({
  default: mocks.core
}))

vi.mock('@asyra/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asyra/utils')>()

  return {
    ...actual,
    calculateZoomFit: mocks.calculateZoomFit
  }
})

import { PresetSystemPropertyKeys } from '@asyra/preset'
import { DEFAULT_CANVAS_PADDING } from '@asyra/utils'
import { viewportApis } from '../viewport'

describe('viewport common APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('hands completed Core world bounds directly to zoom-fit', () => {
    const elementsBounds = {
      minX: 100,
      minY: 50,
      maxX: 220,
      maxY: 120
    }
    const nextState = {
      scale: 2,
      position: { x: 30, y: 40 }
    }
    const viewportAnchor = document.createElement('div')
    viewportAnchor.id = 'viewport-anchor'
    viewportAnchor.getBoundingClientRect = vi.fn(
      () =>
        ({
          x: 80,
          y: 40,
          width: 800,
          height: 600,
          top: 40,
          right: 880,
          bottom: 640,
          left: 80,
          toJSON: () => ({})
        }) as DOMRect
    )
    document.body.append(viewportAnchor)
    mocks.core.getAllElementsBounds.mockReturnValue(elementsBounds)
    mocks.calculateZoomFit.mockReturnValue(nextState)

    viewportApis.zoomFit()

    expect(mocks.core.getAllElementsBounds).toHaveBeenCalledOnce()
    expect(mocks.calculateZoomFit).toHaveBeenCalledWith({
      elementsBounds,
      viewportBounds: {
        minX: 80,
        minY: 40,
        maxX: 880,
        maxY: 640
      },
      padding: DEFAULT_CANVAS_PADDING
    })
    expect(mocks.core.setSystemProperty).toHaveBeenNthCalledWith(
      1,
      PresetSystemPropertyKeys.ZOOM,
      nextState.scale
    )
    expect(mocks.core.setSystemProperty).toHaveBeenNthCalledWith(
      2,
      PresetSystemPropertyKeys.VIEWPORT_POSITION,
      nextState.position
    )
  })
})
