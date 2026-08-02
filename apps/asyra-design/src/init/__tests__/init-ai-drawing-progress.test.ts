import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemPropertyKeys } from '../../constants'

const mocks = vi.hoisted(() => ({
  defineSystemProperty: vi.fn(),
  registerRenderLayer: vi.fn()
}))

vi.mock('../../contexts', () => ({
  default: {
    defineSystemProperty: mocks.defineSystemProperty,
    registerRenderLayer: mocks.registerRenderLayer
  }
}))

import { initAiDrawingProgress } from '../capabilities/init-ai-drawing-progress'

describe('initAiDrawingProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defines one validated runtime-only property without registering a Render-owned loading layer', () => {
    initAiDrawingProgress()
    initAiDrawingProgress()

    expect(mocks.defineSystemProperty).toHaveBeenCalledOnce()
    expect(mocks.defineSystemProperty).toHaveBeenCalledWith(
      SystemPropertyKeys.AI_DRAWING_PROGRESS,
      null,
      {
        runtime: true,
        validate: expect.any(Function)
      }
    )
    const validate = mocks.defineSystemProperty.mock.calls[0]?.[2]?.validate
    expect(
      validate?.({
        bounds: { height: 80, width: 120, x: 10, y: 20 },
        completedElements: 25,
        phase: 'drawing',
        totalElements: 100
      })
    ).toBe(true)
    expect(
      validate?.({
        bounds: { height: 80, width: 120, x: 10, y: 20 },
        completedElements: 101,
        phase: 'drawing',
        totalElements: 100
      })
    ).toBe(false)
    expect(mocks.registerRenderLayer).not.toHaveBeenCalled()
  })
})
