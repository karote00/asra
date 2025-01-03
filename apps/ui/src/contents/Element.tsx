import { useSignals } from '@preact/signals-react/runtime'
import { EntityTypes } from '@asra/utils'
import { Icon } from '@asra/design-system'
import { getElement } from '../states/scene-tree'

const Element = ({ elementId }: { elementId: string }) => {
  useSignals()
  const elementInstance = getElement(elementId)
  if (!elementInstance) return null

  const { name, type, lock, visible } = elementInstance.value
  return (
    <div className="flex items-center justify-between p-2 hover:bg-panel-light cursor-pointer text-gray-200">
      <div className="flex items-center space-x-1 gap-1">
        <Icon name={type as EntityTypes} />
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
