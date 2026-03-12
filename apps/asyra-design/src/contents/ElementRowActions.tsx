import { Icon } from '@asyra/design-system'

interface ElementRowActionsProps {
  isHovered: boolean
  isSelected: boolean
  lock: boolean
  visible: boolean
}

export const ElementRowActions = ({
  isHovered,
  isSelected,
  lock,
  visible
}: ElementRowActionsProps) => {
  return (
    <div
      className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100"
      style={{
        opacity: isHovered || isSelected ? 1 : 0,
        transition: 'opacity 0.12s ease'
      }}
    >
      <div className="flex items-center text-[#777]">
        <Icon name={lock ? 'Lock' : 'Unlock'} />
      </div>
      <div className="flex items-center text-[#777]">
        <Icon name={visible ? 'Visible' : 'Invisible'} />
      </div>
    </div>
  )
}
