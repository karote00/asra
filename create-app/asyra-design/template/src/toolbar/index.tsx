import ThemeToggle from './theme-toggle'
import Zoom from './zoom'
import ToolButton from './tool-button'

const ToolBar = () => {
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
      <ThemeToggle />
      <div className="flex items-center gap-2">
        <Zoom />
      </div>
    </div>
  )
}

export default ToolBar
