import { describe, expect, it } from 'vitest'
import { InputType, ModifierKey } from '@asyra/utils'
import { keyMap } from '@asyra/core'
import { InputSystemEvents } from '../../constants'
import { groupShortcutInputRegistrations } from '../group-command-descriptors'
import { isEditableShortcutTarget, keyCombinations } from '../key-combinations'

describe('Group shortcut routing', () => {
  it('registers one Meta and one Ctrl combo without a duplicate Shift combo', () => {
    expect(keyCombinations[InputSystemEvents.INPUT_SHORTCUT_GROUP]).toEqual(
      groupShortcutInputRegistrations.map(({ key, modifiers }) =>
        expect.objectContaining({
          type: InputType.KEYBOARD,
          keys: [key],
          modifiers: [...modifiers],
          detail: { groupShortcut: true }
        })
      )
    )
    expect(groupShortcutInputRegistrations).toEqual([
      expect.objectContaining({
        key: keyMap.keys.KeyG,
        modifiers: [ModifierKey.META]
      }),
      expect.objectContaining({
        key: keyMap.keys.KeyG,
        modifiers: [ModifierKey.CTRL]
      })
    ])
  })

  it('classifies text, number, color, textarea, and contenteditable targets', () => {
    const editableTargets = [
      document.createElement('input'),
      Object.assign(document.createElement('input'), { type: 'number' }),
      Object.assign(document.createElement('input'), { type: 'color' }),
      document.createElement('textarea'),
      Object.assign(document.createElement('div'), {
        contentEditable: 'true'
      })
    ]

    editableTargets.forEach((target) => {
      expect(isEditableShortcutTarget(target)).toBe(true)
    })
    expect(isEditableShortcutTarget(document.createElement('button'))).toBe(
      false
    )
    expect(isEditableShortcutTarget(null)).toBe(false)
  })
})
