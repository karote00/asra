import { useCallback } from 'react'
import { Icon, type IconName } from '@asyra/design-system'
import { usePrimaryTool } from '../providers'
import { resetData, switchPrimaryTool } from '../controllers/app'
import { PrimaryToolType } from '../constants'
import { CRDT_7076_DEMO_FILE_ID } from '../config/demo-document'
import { getRequiredFileId } from '../render-app/collaboration-mode'

const PRIMARY_TOOL_ICON_MAP: Record<string, IconName> = {
  [PrimaryToolType.SELECT]: 'Select',
  [PrimaryToolType.RECTANGLE]: 'Rect',
  [PrimaryToolType.OVAL]: 'Oval',
  [PrimaryToolType.PEN]: 'Pen'
}

const ToolButton = () => {
  const primaryTool = usePrimaryTool()
  const isDemoResetAvailable = getRequiredFileId() === CRDT_7076_DEMO_FILE_ID

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
    <div className="flex items-center gap-1">
      {isDemoResetAvailable ? (
        <>
          <button
            aria-label="Reset document"
            className="tool-btn"
            data-testid="reset-button"
            onClick={handleReset}
            title="Reset document"
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              viewBox="0 0 16 16"
              width="16"
            >
              <path
                d="M3.5 5.5A5 5 0 1 1 3 9"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
              <path
                d="M3.5 2.5v3h3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <div
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-[#4a4a4a]"
            data-testid="reset-separator"
          />
        </>
      ) : null}
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
