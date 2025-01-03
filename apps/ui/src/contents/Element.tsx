import { useSignals } from '@preact/signals-react/runtime'
import { getElement } from '../states/scene-tree'

const Element = ({ elementId }: { elementId: string }) => {
  useSignals()
  const elementInstance = getElement(elementId)
  if (!elementInstance) return null

  const { name, isLocked, isVisible } = elementInstance.value
  return (
    <div className="flex items-center justify-between p-2 hover:bg-panel-light cursor-pointer text-gray-200">
      <div className="flex items-center space-x-2">
        <span className="material-icons">folder</span>
        <span>{name}</span>
      </div>

      <div className="flex items-center space-x-2">
        <span className="material-icons">
          {isLocked ? 'lock' : 'lock_open'}
        </span>
        <span className="material-icons">
          {isVisible ? 'visibility' : 'visibility_off'}
        </span>
      </div>
    </div>
  )
}

export default Element
