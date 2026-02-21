import { type ComponentProps, useCallback } from 'react'
import { Icon } from '@asyra/design-system'
import { usePrimaryTool } from '../providers'
import { resetData, switchPrimaryTool } from '../controllers/app'
import { PrimaryToolType } from '../constants'

const selectedStyle =
  'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
const normalStyle =
  'hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-400'

type IconName = ComponentProps<typeof Icon>['name']

const PRIMARY_TOOL_ICON_MAP: Record<string, IconName> = {
  [PrimaryToolType.SELECT]: 'Select',
  [PrimaryToolType.RECTANGLE]: 'Rect',
  [PrimaryToolType.OVAL]: 'Oval',
  [PrimaryToolType.PEN]: 'Pen'
}

const ToolButton = () => {
  const primaryTool = usePrimaryTool()
  const selectToolStyle =
    primaryTool === PrimaryToolType.SELECT ? selectedStyle : normalStyle
  const rectangleToolStyle =
    primaryTool === PrimaryToolType.RECTANGLE ? selectedStyle : normalStyle
  const ovalToolStyle =
    primaryTool === PrimaryToolType.OVAL ? selectedStyle : normalStyle
  const penToolStyle =
    primaryTool === PrimaryToolType.PEN ? selectedStyle : normalStyle

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

  const handleSwitchToPenTool = useCallback(() => {
    switchPrimaryTool(PrimaryToolType.PEN)
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
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.SELECT]} />
      </div>
      <div
        className={`flex align-middle ${rectangleToolStyle}`}
        onClick={handleSwitchToRectangleTool}
        data-testid="tool-rectangle"
        data-active={primaryTool === PrimaryToolType.RECTANGLE}
      >
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.RECTANGLE]} />
      </div>
      <div
        className={`flex align-middle ${ovalToolStyle}`}
        onClick={handleSwitchToOvalTool}
        data-testid="tool-oval"
        data-active={primaryTool === PrimaryToolType.OVAL}
      >
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.OVAL]} />
      </div>
      <div
        className={`flex align-middle ${penToolStyle}`}
        onClick={handleSwitchToPenTool}
        data-testid="tool-pen"
        data-active={primaryTool === PrimaryToolType.PEN}
      >
        <Icon name="Pen" />
      </div>
    </div>
  )
}

export default ToolButton
