import { MouseEvent, useCallback, useEffect, useRef } from 'react'
import type { ElementRawData, ModifierKeys } from '@asyra/utils'
import { capitalizeFirstLetter, EntityType } from '@asyra/utils'
import { Icon } from '@asyra/design-system'
import { useElementData } from '../providers'
import { selectElements } from '../controllers/element-selection'

interface ElementData {
  elementId: string
  isSelected: boolean
}

const INIT_MODIFIERS: ModifierKeys = {
  meta: false,
  ctrl: false,
  alt: false,
  shift: false
}

const getModifierKeys = (e: KeyboardEvent): ModifierKeys => {
  return {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey
  }
}

const Element = ({ elementId, isSelected }: ElementData) => {
  const elementData = useElementData(elementId)
  if (!elementData) return null

  const { id, name, type, lock, visible } = elementData as ElementRawData
  const modifierKeys = useRef<ModifierKeys>(INIT_MODIFIERS)
  const handleElementClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()

      selectElements([id])
    },
    [selectElements]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      modifierKeys.current = getModifierKeys(e)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      modifierKeys.current = getModifierKeys(e)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const bgColor = isSelected ? 'bg-panel-lighter' : ''
  const hoverBgColor = isSelected
    ? 'hover:bg-panel-lighter'
    : 'hover:bg-panel-light'

  return (
    <div
      className={`flex items-center justify-between p-2 ${bgColor} ${hoverBgColor} text-gray-200`}
      onClick={handleElementClick}
      data-testid={`element-item-${id}`}
      data-layer-element="true"
      data-selected={isSelected}
    >
      <div className="flex items-center space-x-1 gap-1">
        <Icon
          showCursor={false}
          name={capitalizeFirstLetter(type) as EntityType}
        />
        {name}
      </div>

      <div className="flex items-center space-x-1">
        <Icon name={lock ? 'Lock' : 'Unlock'} />
        <Icon name={visible ? 'Visible' : 'Invisible'} />
      </div>
    </div>
  )
}

export default Element
