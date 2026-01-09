import { describe, it, expect, vi, beforeEach } from 'vitest'
import RenderStore from '../render'
import * as UIContextModule from '../../ui-context'

// Mock ui-context
vi.mock('../../ui-context', () => ({
  default: {
    updateZoom: vi.fn()
  }
}))

describe('RenderStore', () => {
  let renderStore: RenderStore

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    renderStore = new RenderStore()
  })

  it('should update zoom in ui context', () => {
    renderStore.updateZoom(2.5)

    expect(UIContextModule.default.updateZoom).toHaveBeenCalledWith(2.5)
  })

  it('should update zoom to 1', () => {
    renderStore.updateZoom(1)

    expect(UIContextModule.default.updateZoom).toHaveBeenCalledWith(1)
  })

  it('should update zoom to 0.5', () => {
    renderStore.updateZoom(0.5)

    expect(UIContextModule.default.updateZoom).toHaveBeenCalledWith(0.5)
  })
})
