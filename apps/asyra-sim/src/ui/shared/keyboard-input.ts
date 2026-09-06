/** Let native fields keep their own shortcuts, including open shadow roots. */
export function isEditableKeyboardEvent(event: KeyboardEvent): boolean {
  return event.composedPath().some((target) => {
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
}
