import { describe, it, expect } from 'vitest'
import {
  InteractionActions,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asyra/utils'
import { decideFromCreateElementRules } from '../create-element-rules'
import { baseSnapshot } from './test-helpers'

describe('decideFromCreateElementRules', () => {
  it('should return INTERACTION_CREATE_ELEMENT with the correct payload', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE,
      mouse: {
        ...baseSnapshot.mouse,
        position: { x: 123, y: 456 }
      }
    }

    const result = decideFromCreateElementRules(snapshot)

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_CREATE_ELEMENT,
      payload: {
        position: { x: 123, y: 456 },
        elementType: PrimaryToolType.RECTANGLE
      }
    })
  })
})
