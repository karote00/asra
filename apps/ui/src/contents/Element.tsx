import { useSignals } from '@preact/signals-react/runtime'
import { Icon } from '@asra/design-system'
import { getElement } from '../states/scene-tree'

const Element = ({ elementId }: { elementId: string }) => {
  useSignals()
  const elementInstance = getElement(elementId)
  if (!elementInstance) return null

  const { name, isLocked, isVisible } = elementInstance.value
  return (
    <div className="flex items-center justify-between p-2 hover:bg-panel-light cursor-pointer text-gray-200">
      <div className="flex items-center space-x-2">
        <Icon name="Group" />
        {name}
      </div>

      <div className="flex items-center space-x-2">
        <Icon name={isLocked ? 'Lock' : 'Unlock'} />
        <Icon name={isVisible ? 'Visible' : 'Invisible'} />
      </div>
    </div>
  )
}

export default Element
