import type { MouseEvent } from 'react'

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

  return (
    <button
      type="button"
      className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[10px] text-[#888] hover:text-[#ddd]"
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse Group' : 'Expand Group'}
      data-testid={`layers-group-toggle-${groupId}`}
      data-layer-pointer-bypass="true"
      onClick={handleClick}
    >
      {isExpanded ? '▾' : '›'}
    </button>
  )
}
