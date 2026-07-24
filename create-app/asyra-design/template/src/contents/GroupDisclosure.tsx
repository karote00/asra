import type { MouseEvent } from 'react'
import { IconButton } from '@asyra/design-system'

interface GroupDisclosureProps {
  groupId: string
  isExpanded: boolean
  onToggle: (groupId: string) => void
}

export const GroupDisclosure = ({
  groupId,
  isExpanded,
  onToggle
}: GroupDisclosureProps) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onToggle(groupId)
  }
  let iconClassName = 'h-3 w-3 [&>svg]:h-3 [&>svg]:w-3'
  if (isExpanded) {
    iconClassName += ' rotate-90'
  }

  return (
    <IconButton
      icon="ChevronRight"
      iconClassName={iconClassName}
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[#888] hover:text-[#ddd]"
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse Group' : 'Expand Group'}
      data-testid={`layers-group-toggle-${groupId}`}
      data-layer-pointer-bypass="true"
      onClick={handleClick}
    />
  )
}
