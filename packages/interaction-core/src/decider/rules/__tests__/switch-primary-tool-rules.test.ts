import { describe, it, expect } from 'vitest'
import { InteractionActions, PrimaryToolType, DetailType } from '@asra/utils'
import { decideFromSwitchPrimaryToolRules } from '../switch-primary-tool-rules'

describe('decideFromSwitchPrimaryToolRules', () => {
  it('should return INTERACTION_SWITCH_PRIMARY_TOOL with the correct tool from detail', () => {
    const detail: DetailType = { primaryTool: PrimaryToolType.RECTANGLE }
    const result = decideFromSwitchPrimaryToolRules(detail)

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL,
      payload: {
        primaryTool: PrimaryToolType.RECTANGLE
      }
    })
  })

  it('should return with an undefined primaryTool if detail is not provided', () => {
    const result = decideFromSwitchPrimaryToolRules()

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL,
      payload: {
        primaryTool: undefined
      }
    })
  })

  it('should return with an undefined primaryTool if detail does not contain primaryTool', () => {
    const detail: DetailType = { someOtherProp: 'value' }
    const result = decideFromSwitchPrimaryToolRules(detail)

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL,
      payload: {
        primaryTool: undefined
      }
    })
  })
})
