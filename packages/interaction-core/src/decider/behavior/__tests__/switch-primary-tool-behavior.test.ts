import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DetailType, PrimaryToolType } from '@asyra/utils'
import { decideSwitchPrimaryToolBehavior } from '../switch-primary-tool-behavior'
import * as rules from '../../rules'

vi.mock('../../rules', () => ({
  decideFromSwitchPrimaryToolRules: vi.fn()
}))

describe('decideSwitchPrimaryToolBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should call decideFromSwitchPrimaryToolRules with the detail object', () => {
    const detail: DetailType = { primaryTool: PrimaryToolType.RECTANGLE }
    decideSwitchPrimaryToolBehavior(detail)
    expect(rules.decideFromSwitchPrimaryToolRules).toHaveBeenCalledWith(detail)
  })

  it('should call decideFromSwitchPrimaryToolRules with undefined if no detail is provided', () => {
    decideSwitchPrimaryToolBehavior()
    expect(rules.decideFromSwitchPrimaryToolRules).toHaveBeenCalledWith(
      undefined
    )
  })
})
