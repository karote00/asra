const isMac = navigator.platform.toUpperCase().includes('MAC')

export const KeyMap = {
  Control: isMac ? 'Ctrl' : 'Meta',
  Meta: 'Meta',
  Shift: 'Shift',
  Alt: 'Alt',
  MouseDown: 'MouseDown',
  MouseMove: 'MouseMove',
  MouseUp: 'MouseUp',
  MouseLeft: 'MouseLeft',
  MouseRight: 'MouseRight',
  MouseMiddle: 'MouseMiddle'
}
