import { useCallback } from 'react'
import { Icon } from '@asyra/design-system'
import { usePrimaryTool } from '../providers'
import { resetData, switchPrimaryTool } from '../controllers/app'
import { PrimaryToolType } from '../constants'

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
  const ovalToolStyle =
    primaryTool === PrimaryToolType.OVAL ? selectedStyle : normalStyle

  const handleReset = useCallback(() => {
    resetData()
  }, [])

  const handleSwitchToSelectTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.SELECT)
  }, [])

  const handleSwitchToRectangleTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.RECTANGLE)
  }, [])

  const handleSwitchToOvalTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.OVAL)
  }, [])

  return (
    <div className="flex text-white">
      <div
        className="pr-4 cursor-pointer"
        onClick={handleReset}
        data-testid="reset-button"
      >
        Reset
      </div>
      <div
        className={`flex align-middle ${selectToolStyle}`}
        onClick={handleSwitchToSelectTool}
        data-testid="tool-select"
        data-active={primaryTool === PrimaryToolType.SELECT}
      >
        <Icon name="Select" />
      </div>
      <div
        className={`flex align-middle ${rectangleToolStyle}`}
        onClick={handleSwitchToRectangleTool}
        data-testid="tool-rectangle"
        data-active={primaryTool === PrimaryToolType.RECTANGLE}
      >
        <Icon name="Rectangle" />
      </div>
      <div
        className={`flex align-middle ${ovalToolStyle}`}
        onClick={handleSwitchToOvalTool}
        data-testid="tool-oval"
        data-active={primaryTool === PrimaryToolType.OVAL}
      >
        <Icon name="Oval" />
      </div>
      <div className="flex align-middle" data-testid="tool-triangle">
        <Icon name="Triangle" />
      </div>
    </div>
  )
}

export default ToolButton
