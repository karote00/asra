import { EntityTypes } from '@asra/utils'
import { Icon } from '@asra/design-system'
import { useElementData } from '../providers/scene-tree'

const Element = ({ elementId }: { elementId: string }) => {
  const elementData = useElementData(elementId)
  if (!elementData) return null

  const { name, type, lock, visible } = elementData
  return (
    <div className="flex items-center justify-between p-2 hover:bg-panel-light text-gray-200">
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
