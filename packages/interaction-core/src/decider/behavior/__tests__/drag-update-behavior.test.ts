import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrimaryToolType, SystemContextSnapshot } from '@asyra/utils'
import { decideDragUpdateBehavior } from '../drag-update-behavior'
import * as rules from '../../rules'
import { baseSnapshot } from '../../rules/__tests__/test-helpers'

vi.mock('../../rules', () => ({
  decideFromResizeElementRules: vi.fn()
}))

describe('decideDragUpdateBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should call decideFromResizeElementRules when the primary tool is RECTANGLE', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE
    }
    decideDragUpdateBehavior(snapshot)
    expect(rules.decideFromResizeElementRules).toHaveBeenCalledWith(snapshot)
  })

  it('should return null when the primary tool is SELECT', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.SELECT
    }
    const result = decideDragUpdateBehavior(snapshot)
    expect(result).toBeNull()
  })

  it('should return null for unhandled tools', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: 'some-other-tool' as PrimaryToolType
    }
    const result = decideDragUpdateBehavior(snapshot)
    expect(result).toBeNull()
  })
})
