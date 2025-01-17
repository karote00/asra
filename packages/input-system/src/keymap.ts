const createKeyMap = (): Record<string, string> => {
  const platform = navigator.platform.toUpperCase()
  const map: Record<string, string> = {
    Escape: 'Escape',
    Delete: 'Delete',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    MouseLeft: 'MouseLeft',
    MouseMiddle: 'MouseMiddle',
    MouseRight: 'MouseRight',
    MouseWheelUp: 'MouseWheelUp',
    MouseWheelDown: 'MouseWheelDown',
    MouseDown: 'MouseDown',
    MouseMove: 'MouseMove',
    MouseDoubleClick: 'MouseDoubleClick'
  }

  const modifierAliases: Record<string, string[]> = {
    Control: ['ControlLeft', 'ControlRight'],
    Meta: ['MetaLeft', 'MetaRight'],
    Shift: ['ShiftLeft', 'ShiftRight'],
    Alt: ['AltLeft', 'AltRight']
  }

  if (
    platform.includes('MAC') ||
    platform.includes('WIN') ||
    platform.includes('LINUX')
  ) {
    for (const modifier in modifierAliases) {
      modifierAliases[modifier].forEach((alias) => (map[alias] = modifier))
    }
  }

  return map
}

export const KeyMap = createKeyMap()
