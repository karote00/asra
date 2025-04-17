const MODIFIER_KEYS = new Set(['Meta', 'Ctrl', 'Shift', 'Alt'])
const SPECIAL_EVENTS = new Set(['Wheel'])

export default class KeyMap {
  private os: 'Windows' | 'Mac' | 'Linux'
  private keyMap: Record<string, string>

  constructor() {
    this.os = this.detectOS()
    this.keyMap = this.createKeyMap()
  }

  private detectOS(): 'Windows' | 'Mac' | 'Linux' {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('mac')) return 'Mac'
    if (platform.includes('win')) return 'Windows'
    return 'Linux'
  }

  private createKeyMap(): Record<string, string> {
    const baseMap: Record<string, string> = {
      Escape: 'Escape',
      Tab: 'Tab',
      CapsLock: 'CapsLock',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift',
      ControlLeft: 'Ctrl',
      ControlRight: 'Ctrl',
      AltLeft: 'Alt',
      AltRight: 'Alt',
      MetaLeft: 'Meta',
      MetaRight: 'Meta',
      Space: 'Space',
      Enter: 'Enter',
      Backspace: 'Backspace',

      // Arrow Key
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',

      // Number
      Digit0: '0',
      Digit1: '1',
      Digit2: '2',
      Digit3: '3',
      Digit4: '4',
      Digit5: '5',
      Digit6: '6',
      Digit7: '7',
      Digit8: '8',
      Digit9: '9',

      // Letter
      KeyA: 'A',
      KeyB: 'B',
      KeyC: 'C',
      KeyD: 'D',
      KeyE: 'E',
      KeyF: 'F',
      KeyG: 'G',
      KeyH: 'H',
      KeyI: 'I',
      KeyJ: 'J',
      KeyK: 'K',
      KeyL: 'L',
      KeyM: 'M',
      KeyN: 'N',
      KeyO: 'O',
      KeyP: 'P',
      KeyQ: 'Q',
      KeyR: 'R',
      KeyS: 'S',
      KeyT: 'T',
      KeyU: 'U',
      KeyV: 'V',
      KeyW: 'W',
      KeyX: 'X',
      KeyY: 'Y',
      KeyZ: 'Z',

      // Symbol
      Minus: '-',
      Equal: '=',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      /* eslint-disable quotes */
      Quote: "'",
      Backquote: '`',
      Comma: ',',
      Period: '.',
      Slash: '/',

      // F1~F12
      F1: 'F1',
      F2: 'F2',
      F3: 'F3',
      F4: 'F4',
      F5: 'F5',
      F6: 'F6',
      F7: 'F7',
      F8: 'F8',
      F9: 'F9',
      F10: 'F10',
      F11: 'F11',
      F12: 'F12',

      // Numpad
      Numpad0: 'Numpad0',
      Numpad1: 'Numpad1',
      Numpad2: 'Numpad2',
      Numpad3: 'Numpad3',
      Numpad4: 'Numpad4',
      Numpad5: 'Numpad5',
      Numpad6: 'Numpad6',
      Numpad7: 'Numpad7',
      Numpad8: 'Numpad8',
      Numpad9: 'Numpad9',
      NumpadAdd: '+',
      NumpadSubtract: '-',
      NumpadMultiply: '*',
      NumpadDivide: '/',
      NumpadEnter: 'Enter',
      NumpadDecimal: '.'
    }

    if (this.os === 'Mac') {
      baseMap['MetaLeft'] = 'Meta'
      baseMap['MetaRight'] = 'Meta'
      baseMap['AltLeft'] = 'Option'
      baseMap['AltRight'] = 'Option'
      baseMap['Delete'] = 'Delete'
    } else if (this.os === 'Windows' || this.os === 'Linux') {
      baseMap['MetaLeft'] = 'Windows'
      baseMap['MetaRight'] = 'Windows'
      baseMap['Delete'] = 'Del'
    }

    return baseMap
  }

  public mapKey(code: string): string {
    return this.keyMap[code] || code
  }

  public isModifiers(key: string): boolean {
    return MODIFIER_KEYS.has(key)
  }

  public isSpecialEvent(key: string): boolean {
    return SPECIAL_EVENTS.has(key)
  }
}
