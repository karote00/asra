import { useCallback } from 'react'
import { Icon } from '@asra/design-system'
import { usePrimaryTool } from '../providers'
import { PrimaryToolType } from '@asra/utils'
import { resetData } from '../controllers/app'

const selectedStyle =
  'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
const normalStyle =
  'hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-400'

const ToolButton = () => {
  const primaryTool = usePrimaryTool()
  const selectToolStyle =
    primaryTool === PrimaryToolType.SELECT ? selectedStyle : normalStyle
  const rectangleToolStyle =
    primaryTool === PrimaryToolType.RECTANGLE ? selectedStyle : normalStyle

  const handleReset = useCallback(() => {
    resetData()
  }, [])

  return (
    <div className="flex text-white">
      <div onClick={handleReset} className="pr-4 cursor-pointer">
        Reset
      </div>
      <div className={`flex align-middle ${selectToolStyle}`}>
        <Icon name="Select" />
      </div>
      <div className={`flex align-middle ${rectangleToolStyle}`}>
        <Icon name="Rectangle" />
      </div>
    </div>
  )
}

export default ToolButton
