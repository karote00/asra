import type { MouseEvent } from 'react'
import { Icon } from '@asyra/design-system'

interface ElementRowActionsProps {
  elementId: string
  isHovered: boolean
  isSelected: boolean
  lock: boolean
  visible: boolean
  onToggleLock: (event: MouseEvent<HTMLButtonElement>) => void
  onToggleVisible: (event: MouseEvent<HTMLButtonElement>) => void
}

export const ElementRowActions = ({
  elementId,
  isHovered,
  isSelected,
  lock,
  visible,
  onToggleLock,
  onToggleVisible
}: ElementRowActionsProps) => {
  return (
    <div
      className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100"
      data-layer-pointer-bypass="true"
      style={{
        opacity: isHovered || isSelected ? 1 : 0,
        transition: 'opacity 0.12s ease'
      }}
    >
      <button
        type="button"
        className={`flex items-center justify-center w-5 h-5 ${
          lock ? 'text-[#e5e5e5]' : 'text-[#777]'
        } hover:text-[#e5e5e5]`}
        onClick={onToggleLock}
        title={lock ? 'Unlock element' : 'Lock element'}
        aria-pressed={lock}
        aria-label={lock ? 'Unlock element' : 'Lock element'}
        data-testid={`content-element-lock-${elementId}`}
      >
        <Icon name={lock ? 'Lock' : 'Unlock'} />
      </button>
      <button
        type="button"
        className={`flex items-center justify-center w-5 h-5 ${
          visible ? 'text-[#e5e5e5]' : 'text-[#555]'
        } hover:text-[#e5e5e5]`}
        onClick={onToggleVisible}
        title={visible ? 'Hide element' : 'Show element'}
        aria-pressed={visible}
        aria-label={visible ? 'Hide element' : 'Show element'}
        data-testid={`content-element-visible-${elementId}`}
      >
        <Icon name={visible ? 'Visible' : 'Invisible'} />
      </button>
    </div>
  )
}
