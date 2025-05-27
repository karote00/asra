import { useCallback } from 'react'
import { Icon } from '@asra/design-system'
import { PrimaryToolType } from '@asra/utils'
import { usePrimaryTool } from '../providers'
import { resetData, switchPrimaryTool } from '../controllers/app'

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

  const handleSwitchToSelectTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.SELECT)
  }, [])

  const handleSwitchToRectangleTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.RECTANGLE)
  }, [])

  return (
    <div className="flex text-white">
      <div className="pr-4 cursor-pointer" onClick={handleReset}>
        Reset
      </div>
      <div
        className={`flex align-middle ${selectToolStyle}`}
        onClick={handleSwitchToSelectTool}
      >
        <Icon name="Select" />
      </div>
      <div
        className={`flex align-middle ${rectangleToolStyle}`}
        onClick={handleSwitchToRectangleTool}
      >
        <Icon name="Rectangle" />
      </div>
    </div>
  )
}

export default ToolButton
