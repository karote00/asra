import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrimaryToolStore } from '../primary-tool'
import * as UIContextModule from '../../../ui-context'

// Mock ui-context
vi.mock('../../../ui-context', () => ({
  default: {
    updatePrimaryTool: vi.fn()
  }
}))

describe('PrimaryToolStore', () => {
  let primaryToolStore: PrimaryToolStore

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    primaryToolStore = new PrimaryToolStore()
  })

  it('should update primary tool in ui context', () => {
    primaryToolStore.updatePrimaryTool('rectangle')

    expect(UIContextModule.default.updatePrimaryTool).toHaveBeenCalledWith(
      'rectangle'
    )
  })

  it('should update primary tool to SELECT', () => {
    primaryToolStore.updatePrimaryTool('select')

    expect(UIContextModule.default.updatePrimaryTool).toHaveBeenCalledWith(
      'select'
    )
  })
})
