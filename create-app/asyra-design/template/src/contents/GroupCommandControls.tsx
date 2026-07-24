import type { MouseEvent } from 'react'
import type { GroupCommandDescriptor } from '../config/group-command-descriptors'

interface GroupCommandControlsProps {
  descriptors: readonly GroupCommandDescriptor[]
}

export const GroupCommandControls = ({
  descriptors
}: GroupCommandControlsProps) => {
  const handleCommand =
    (descriptor: GroupCommandDescriptor) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      descriptor.execute()
    }

  return (
    <div className="ml-auto flex items-center gap-1">
      {descriptors.map((descriptor) => (
        <button
          key={descriptor.id}
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] text-[#bbb] enabled:hover:bg-white/10 enabled:hover:text-white disabled:text-[#555]"
          aria-label={descriptor.ariaLabel}
          data-testid={`layers-${descriptor.id}-button`}
          data-layer-pointer-bypass="true"
          disabled={!descriptor.enabled}
          title={`${descriptor.label} (${descriptor.shortcutLabel})`}
          onClick={handleCommand(descriptor)}
        >
          {descriptor.label}
        </button>
      ))}
    </div>
  )
}
