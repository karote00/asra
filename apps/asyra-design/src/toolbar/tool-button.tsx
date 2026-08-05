import { useCallback } from 'react'
import { Icon, type IconName } from '@asyra/design-system'
import { usePrimaryTool } from '../providers'
import { switchPrimaryTool } from '../controllers/app'
import { PrimaryToolType } from '../constants'

const PRIMARY_TOOL_ICON_MAP: Record<string, IconName> = {
  [PrimaryToolType.SELECT]: 'Select',
  [PrimaryToolType.RECTANGLE]: 'Rect',
  [PrimaryToolType.OVAL]: 'Oval',
  [PrimaryToolType.PEN]: 'Pen'
}

const ToolButton = () => {
  const primaryTool = usePrimaryTool()

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
    <div className="flex items-center gap-1">
      <button
        className={`tool-btn ${primaryTool === PrimaryToolType.SELECT ? 'active' : ''}`}
        onClick={handleSwitchToSelectTool}
        data-testid="tool-select"
        data-active={primaryTool === PrimaryToolType.SELECT}
        title="Select (V)"
      >
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.SELECT]} />
      </button>
      <button
        className={`tool-btn ${primaryTool === PrimaryToolType.RECTANGLE ? 'active' : ''}`}
        onClick={handleSwitchToRectangleTool}
        data-testid="tool-rectangle"
        data-active={primaryTool === PrimaryToolType.RECTANGLE}
        title="Rectangle (R)"
      >
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.RECTANGLE]} />
      </button>
      <button
        className={`tool-btn ${primaryTool === PrimaryToolType.OVAL ? 'active' : ''}`}
        onClick={handleSwitchToOvalTool}
        data-testid="tool-oval"
        data-active={primaryTool === PrimaryToolType.OVAL}
        title="Oval (O)"
      >
        <Icon name={PRIMARY_TOOL_ICON_MAP[PrimaryToolType.OVAL]} />
      </button>
      <button
        className={`tool-btn ${primaryTool === PrimaryToolType.PEN ? 'active' : ''}`}
        onClick={handleSwitchToPenTool}
        data-testid="tool-pen"
        data-active={primaryTool === PrimaryToolType.PEN}
        title="Pen (P)"
      >
        <Icon name="Pen" />
      </button>
    </div>
  )
}

export default ToolButton
