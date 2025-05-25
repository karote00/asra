import { Icon } from '@asra/design-system'
import { usePrimaryTool } from '../providers'
import { PrimaryToolType } from '@asra/utils'

const ToolButton = () => {
  const primaryTool = usePrimaryTool()

  return (
    <div
      className={`flex text-white align-middle ${
        primaryTool === PrimaryToolType.RECTANGLE
          ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
          : 'hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <Icon name="Rectangle" />
    </div>
  )
}

export default ToolButton
