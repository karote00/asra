import type { MouseEventHandler } from 'react'

export function DialogCloseButton({
  label,
  onClick
}: {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      aria-label={label}
      className="dialog-close-button"
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="dialog-close-button__mark">
        ×
      </span>
    </button>
  )
}
