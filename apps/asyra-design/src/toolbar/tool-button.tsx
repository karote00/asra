import { useCallback } from 'react'
import { Icon, type IconName } from '@asyra/design-system'
import { usePrimaryTool } from '../providers'
import { resetData, switchPrimaryTool } from '../controllers/app'
import { PrimaryToolType } from '../constants'

const PRIMARY_TOOL_ICON_MAP: Record<string, IconName> = {
  [PrimaryToolType.SELECT]: 'Select',
  [PrimaryToolType.RECTANGLE]: 'Rect',
  [PrimaryToolType.OVAL]: 'Oval',
  [PrimaryToolType.PEN]: 'Pen'
}

const ToolButton = () => {
  const primaryTool = usePrimaryTool()

  const handleReset = useCallback(() => {
    void resetData().catch((error: unknown) => {
      console.error('[toolbar.reset] Failed:', error)
    })
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
    <div className="flex items-center gap-1">
      <button
        className="tool-btn mr-2"
        onClick={handleReset}
        data-testid="reset-button"
        title="Reset"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 2.5v4h4" />
          <path d="M2.75 9.5a5.25 5.25 0 1 0 1.18-3.75L2.5 6.5" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-[#333] mx-1" />

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
