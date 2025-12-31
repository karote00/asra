import { describe, it, expect } from 'vitest'
import {
  InteractionActions,
  SystemContextSnapshot,
  PrimaryToolType
} from '@asra/utils'
import { decideFromResizeElementRules } from '../resize-element-rules'
import { baseSnapshot } from './test-helpers'

describe('decideFromResizeElementRules', () => {
  it('should return INTERACTION_RESIZE_ELEMENT with the correct payload', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot,
      primaryTool: PrimaryToolType.RECTANGLE,
      mouse: {
        ...baseSnapshot.mouse,
        dragStart: { x: 10, y: 20 },
        position: { x: 100, y: 200 }
      }
    }

    const result = decideFromResizeElementRules(snapshot)

    expect(result).toEqual({
      type: InteractionActions.INTERACTION_RESIZE_ELEMENT,
      payload: {
        dragStart: { x: 10, y: 20 },
        position: { x: 100, y: 200 },
        elementType: PrimaryToolType.RECTANGLE
      },
      options: {
        undoable: false
      }
    })
  })
})
