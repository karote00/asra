import { useEffect } from 'react'

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

      // Preserve native editing, including inputs inside a shadow-root host.
      const editing = event.composedPath().some((target) => {
        if (!(target instanceof HTMLElement)) return false
        const editable = target.getAttribute('contenteditable')
        return (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          editable === '' ||
          editable === 'true' ||
          editable === 'plaintext-only'
        )
      })
      if (editing) return
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
