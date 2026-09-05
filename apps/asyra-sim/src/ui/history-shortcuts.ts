import { useEffect } from 'react'
import { isEditableKeyboardEvent } from './keyboard-input'

export type HistoryDirection = 'undo' | 'redo'

export function useHistoryShortcuts(
  enabled: boolean,
  onHistory: (direction: HistoryDirection) => void
) {
  useEffect(() => {
    if (!enabled) return
    let active = true
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !active ||
        event.defaultPrevented ||
        event.isComposing ||
        event.code !== 'KeyZ' ||
        event.altKey ||
        event.metaKey === event.ctrlKey
      )
        return

      if (isEditableKeyboardEvent(event)) return
      event.preventDefault()
      if (!event.repeat) onHistory(event.shiftKey ? 'redo' : 'undo')
    }
    // Bubble after local controls, before the window-level browser input adapter.
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      active = false
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onHistory])
}
