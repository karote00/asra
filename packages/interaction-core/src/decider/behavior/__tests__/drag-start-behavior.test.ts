import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrimaryToolType, SystemContextSnapshot } from '@asyra/utils'
import { decideDragStartBehavior } from '../drag-start-behavior'
import * as rules from '../../rules'
import { baseSnapshot } from '../../rules/__tests__/test-helpers'

vi.mock('../../rules', () => ({
  decideFromCreateElementRules: vi.fn(),
  decideFromSelectRules: vi.fn()
}))

describe('decideDragStartBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should call decideFromSelectRules when the primary tool is SELECT', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.SELECT
    }
    decideDragStartBehavior(snapshot)
    expect(rules.decideFromSelectRules).toHaveBeenCalledWith(snapshot)
  })

  it('should call decideFromCreateElementRules when the primary tool is RECTANGLE', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE
    }
    decideDragStartBehavior(snapshot)
    expect(rules.decideFromCreateElementRules).toHaveBeenCalledWith(snapshot)
  })

  it('should return null for unhandled tools', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: 'some-other-tool' as PrimaryToolType
    }
    const result = decideDragStartBehavior(snapshot)
    expect(result).toBeNull()
  })
})
