import { type MouseEvent, useCallback } from 'react'
import type { ElementRawData } from '@asyra/utils'
import { useElementData } from '../providers'
import { setHoveredElementId } from '../controllers/hovered-element'
import { ElementIcon } from './ElementIcon'
import { ElementRowActions } from './ElementRowActions'

interface ElementData {
  elementId: string
  isSelected: boolean
  isHovered: boolean
  onSelect: (event: MouseEvent<HTMLDivElement>, elementId: string) => void
}

const Element = ({
  elementId,
  isSelected,
  isHovered,
  onSelect
}: ElementData) => {
  const elementData = useElementData(elementId)
  if (!elementData) return null

  const { id, name, type, lock, visible } = elementData as ElementRawData
  const handleElementClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      onSelect(e, id)
    },
    [id, onSelect]
  )
  const handleElementMouseEnter = useCallback(() => {
    setHoveredElementId(id)
  }, [id])
  const handleElementMouseLeave = useCallback(() => {
    setHoveredElementId(null)
  }, [])

  return (
    <div
      className="layer-item flex items-center justify-between px-3 cursor-default"
      style={{
        height: '32px',
        ...(isSelected
          ? { background: 'rgba(13,153,255,0.15)' }
          : isHovered
            ? { background: 'rgba(255,255,255,0.04)' }
            : {})
      }}
      onClick={handleElementClick}
      onMouseEnter={handleElementMouseEnter}
      onMouseLeave={handleElementMouseLeave}
      data-testid={`element-item-${id}`}
      data-layer-element="true"
      data-selected={isSelected}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`flex items-center flex-shrink-0 ${isSelected ? 'text-[#4db3ff]' : 'text-[#999]'}`}
        >
          <ElementIcon elementId={id} type={type} />
        </div>
        <span
          className={`text-[11px] truncate ${isSelected ? 'text-[#e5e5e5] font-medium' : 'text-[#ccc]'}`}
        >
          {name}
        </span>
      </div>
      <ElementRowActions
        isHovered={isHovered}
        isSelected={isSelected}
        lock={lock}
        visible={visible}
      />
    </div>
  )
}

export default Element
