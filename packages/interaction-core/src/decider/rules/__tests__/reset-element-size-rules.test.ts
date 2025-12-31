import { describe, it, expect } from 'vitest'
import {
  InteractionActions,
  SystemContextSnapshot,
  DEFAULT_ELEMENT_SIZE,
  PrimaryToolType
} from '@asra/utils'
import { decideFromResetElementSizeRules } from '../reset-element-size-rules'
import { baseSnapshot } from './test-helpers'

describe('decideFromResetElementSizeRules', () => {
  it('should return INTERACTION_RESET_ELEMENT_SIZE when mouse is down but not dragging', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE,
      mouse: {
        ...baseSnapshot.mouse,
        down: true,
        dragging: false
      }
    }

    const result = decideFromResetElementSizeRules(snapshot)

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_RESET_ELEMENT_SIZE,
      payload: {
        dimension: {
          width: DEFAULT_ELEMENT_SIZE,
          height: DEFAULT_ELEMENT_SIZE
        },
        elementType: PrimaryToolType.RECTANGLE
      }
    })
  })

  it('should return null when mouse is down and dragging', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: {
        ...baseSnapshot.mouse,
        down: true,
        dragging: true
      }
    }

    const result = decideFromResetElementSizeRules(snapshot)

    expect(result).toBeNull()
  })

  it('should return null when mouse is not down', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      mouse: {
        ...baseSnapshot.mouse,
        down: false
      }
    }

    const result = decideFromResetElementSizeRules(snapshot)

    expect(result).toBeNull()
  })
})
