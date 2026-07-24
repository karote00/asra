import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  InputType,
  ModifierKey,
  MouseButton,
  type RawInputEvent
} from '@asyra/utils'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import core from '../../contexts'
import { InputSystemEvents } from '../../constants'
import { keyCombinations } from '../key-combinations'

const pointerMove = (
  overrides: Partial<RawInputEvent> = {}
): RawInputEvent => ({
  type: InputType.POINTER,
  keys: [],
  modifiers: {
    [ModifierKey.META]: true,
    [ModifierKey.CTRL]: false,
    [ModifierKey.ALT]: false,
    [ModifierKey.SHIFT]: false
  },
  pointer: {
    clientX: 10,
    clientY: 20,
    deltaX: 0,
    deltaY: 0,
    deltaZ: 0,
    button: MouseButton.NONE
  },
  ...overrides
})

describe('canvas hover modifier snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates Meta and Ctrl from every mouse move before feature execution', () => {
    const setSystemProperty = vi
      .spyOn(core, 'setSystemProperty')
      .mockImplementation(() => undefined)
    vi.spyOn(core, 'getSystemProperty').mockReturnValue(undefined)

    keyCombinations[InputSystemEvents.INPUT_MOUSE_MOVE][0].callback(
      pointerMove()
    )

    expect(setSystemProperty).toHaveBeenCalledWith(
      PresetSystemPropertyKeys.KEY_META,
      true
    )
    expect(setSystemProperty).toHaveBeenCalledWith(
      PresetSystemPropertyKeys.KEY_CTRL,
      false
    )
  })
})
