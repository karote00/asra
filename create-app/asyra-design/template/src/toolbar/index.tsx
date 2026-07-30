import ThemeToggle from './theme-toggle'
import Zoom from './zoom'
import ToolButton from './tool-button'

export interface ToolBarProps {
  readonly aiOpen?: boolean
  readonly aiShortcutLabel?: string
  readonly onAiToggle?: (invoker: HTMLButtonElement) => void
}

const ToolBar = ({
  aiOpen = false,
  aiShortcutLabel,
  onAiToggle
}: ToolBarProps) => {
  return (
    <div
      className="z-10 flex items-center justify-between px-3"
      style={{
        gridArea: 'header',
        height: '40px',
        minHeight: '40px',
        background: '#2c2c2c',
        borderBottom: '1px solid #1a1a1a'
      }}
      data-testid="toolbar"
    >
      <ToolButton />
      <div className="flex items-center gap-2">
        {onAiToggle ? (
          <button
            aria-expanded={aiOpen}
            aria-label={aiOpen ? 'Close Agent' : 'Open Agent'}
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-medium transition-colors ${
              aiOpen
                ? 'border-[#8d7bff] bg-[#745cff] text-white'
                : 'border-[#47484e] bg-[#33343a] text-[#dedee3] hover:border-[#686971] hover:bg-[#3d3e44]'
            }`}
            data-testid="ai-agent-toolbar-button"
            onClick={(event) => onAiToggle(event.currentTarget)}
            title={
              aiShortcutLabel
                ? `Toggle Agent Panel (${aiShortcutLabel})`
                : 'Toggle Agent Panel'
            }
            type="button"
          >
            <span aria-hidden="true" className="text-[11px]">
              ✦
            </span>
            AI
          </button>
        ) : null}
        <ThemeToggle />
        <Zoom />
      </div>
    </div>
  )
}

export default ToolBar
