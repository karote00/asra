import { useCallback, useEffect, useRef } from 'react'
import type { ElementRawData, Modifiers } from '@asra/utils'
import { EntityTypes } from '@asra/utils'
import { Icon } from '@asra/design-system'
import { useElementData } from '../providers'
import { selectElements } from '../controllers/element-selection'
import { useElementSelection } from '../providers'

const getModifiers = (e: KeyboardEvent): Modifiers => {
  return {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey
  }
}

const Element = ({ elementId }: { elementId: string }) => {
  const elementData = useElementData(elementId)
  if (!elementData) return null

  const elementSelection = useElementSelection()
  const { id, name, type, lock, visible } = elementData as ElementRawData
  const modifierKeys = useRef({
    meta: false,
    ctrl: false,
    alt: false,
    shift: false
  })
  const handleElementClick = useCallback(() => {
    selectElements([id])
  }, [selectElements])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      modifierKeys.current = getModifiers(e)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      modifierKeys.current = getModifiers(e)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const isSelected = elementSelection.has(id)
  const bgColor = isSelected ? 'bg-panel-lighter' : ''
  const hoverBgColor = isSelected
    ? 'hover:bg-panel-lighter'
    : 'hover:bg-panel-light'

  return (
    <div
      className={`flex items-center justify-between p-2 ${bgColor} ${hoverBgColor} text-gray-200`}
      onClick={handleElementClick}
    >
      <div className="flex items-center space-x-1 gap-1">
        <Icon showCursor={false} name={type as EntityTypes} />
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
