import {
  type ComponentProps,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef
} from 'react'
import type { ElementRawData, ModifierKeys } from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import { Icon } from '@asyra/design-system'
import { useElementData } from '../providers'
import { selectElements } from '../controllers/element-selection'
import { setHoveredElementId } from '../controllers/hovered-element'

interface ElementData {
  elementId: string
  isSelected: boolean
  isHovered: boolean
}

const INIT_MODIFIERS: ModifierKeys = {
  meta: false,
  ctrl: false,
  alt: false,
  shift: false
}

type IconName = ComponentProps<typeof Icon>['name']

const ELEMENT_ICON_MAP: Record<string, IconName> = {
  [EntityTypes.GROUP]: 'Group',
  [EntityTypes.FRAME]: 'Group',
  [EntityTypes.WORKSPACE]: 'Group',
  rect: 'Rect',
  oval: 'Oval',
  vector: 'Pen'
}

const getElementIconName = (type: string): IconName => {
  return ELEMENT_ICON_MAP[type] ?? 'Rect'
}

const getModifierKeys = (e: KeyboardEvent): ModifierKeys => {
  return {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey
  }
}

const Element = ({ elementId, isSelected, isHovered }: ElementData) => {
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
  const handleElementMouseEnter = useCallback(() => {
    setHoveredElementId(id)
  }, [id])
  const handleElementMouseLeave = useCallback(() => {
    setHoveredElementId(null)
  }, [])

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

  const bgColor = isSelected
    ? 'bg-panel-lighter'
    : isHovered
      ? 'bg-panel-light'
      : ''
  const hoverBgColor = isSelected
    ? 'hover:bg-panel-lighter'
    : 'hover:bg-panel-light'

  return (
    <div
      className={`flex items-center justify-between p-2 ${bgColor} ${hoverBgColor} text-gray-200`}
      onClick={handleElementClick}
      onMouseEnter={handleElementMouseEnter}
      onMouseLeave={handleElementMouseLeave}
      data-testid={`element-item-${id}`}
      data-layer-element="true"
      data-selected={isSelected}
    >
      <div className="flex items-center space-x-1 gap-1">
        <Icon showCursor={false} name={getElementIconName(type)} />
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
