import { type MouseEvent, type PointerEvent, useCallback } from 'react'
import type { ElementRawData } from '@asyra/utils'
import { ICON_SIZE } from '../constants'
import { useElementData } from '../providers'
import { setHoveredElementId } from '../controllers/hovered-element'
import {
  toggleElementLock,
  toggleElementVisible
} from '../controllers/element-row-actions'
import { ElementIcon } from './ElementIcon'
import { ElementRowActions } from './ElementRowActions'
import { GroupDisclosure } from './GroupDisclosure'

interface ElementData {
  elementId: string
  isSelected: boolean
  isHovered: boolean
  depth: number
  isGroup: boolean
  isExpanded: boolean
  dropState: 'before' | 'inside' | 'after' | 'invalid' | null
  onToggleGroup: (groupId: string) => void
  onSelect: (event: MouseEvent<HTMLDivElement>, elementId: string) => void
  onPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    elementId: string
  ) => void
}

const Element = ({
  elementId,
  isSelected,
  isHovered,
  depth,
  isGroup,
  isExpanded,
  dropState,
  onToggleGroup,
  onSelect,
  onPointerDown
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
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerDown(event, id)
    },
    [id, onPointerDown]
  )
  const handleToggleLock = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      toggleElementLock(id)
    },
    [id]
  )
  const handleToggleVisible = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      toggleElementVisible(id)
    },
    [id]
  )

  let background: string | undefined
  if (isHovered) {
    background = 'rgba(255,255,255,0.04)'
  }
  if (isSelected) {
    background = 'rgba(13,153,255,0.15)'
  }

  let boxShadow: string | undefined
  if (dropState === 'before') {
    boxShadow = 'inset 0 2px 0 #4db3ff'
  }
  if (dropState === 'after') {
    boxShadow = 'inset 0 -2px 0 #4db3ff'
  }
  if (dropState === 'inside') {
    boxShadow = 'inset 0 0 0 2px #4db3ff'
  }
  if (dropState === 'invalid') {
    boxShadow = 'inset 0 0 0 2px #f28b82'
  }

  return (
    <div
      className="layer-item flex items-center justify-between cursor-default"
      style={{
        height: '32px',
        paddingLeft: `${depth * ICON_SIZE}px`,
        background,
        boxShadow
      }}
      onClick={handleElementClick}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleElementMouseEnter}
      onMouseLeave={handleElementMouseLeave}
      data-testid={`element-item-${id}`}
      data-layer-element="true"
      data-layer-element-id={id}
      data-layer-is-group={isGroup}
      data-layer-drag-eligible={!lock}
      data-layer-drop-state={dropState ?? undefined}
      data-selected={isSelected}
      data-layer-depth={depth}
    >
      <div className="flex items-center min-w-0">
        {isGroup ? (
          <GroupDisclosure
            groupId={id}
            isExpanded={isExpanded}
            onToggle={onToggleGroup}
          />
        ) : (
          <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        )}
        <div
          className={`flex items-center flex-shrink-0 ${isSelected ? 'text-[#4db3ff]' : 'text-[#999]'}`}
        >
          <ElementIcon elementId={id} type={type} />
        </div>
        <span
          className={`px-1 text-[11px] truncate ${isSelected ? 'text-[#e5e5e5] font-medium' : 'text-[#ccc]'}`}
        >
          {name}
        </span>
      </div>
      <ElementRowActions
        elementId={id}
        isHovered={isHovered}
        isSelected={isSelected}
        lock={lock}
        visible={visible}
        onToggleLock={handleToggleLock}
        onToggleVisible={handleToggleVisible}
      />
    </div>
  )
}

export default Element
