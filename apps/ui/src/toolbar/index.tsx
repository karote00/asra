import ThemeToggle from './theme-toggle'
import { ROW_HEIGHT } from '../constants'
import Zoom from './zoom'
import ToolButton from './tool-button'

const ToolBar = () => {
  return (
    <div
      className={`h-12 z-10 dark:bg-panel-darker dark:border-b dark:border-border-dark flex items-center px-4 justify-between h-${ROW_HEIGHT} px-4`}
      style={{ gridArea: 'header' }}
    >
      <ToolButton />
      <ThemeToggle />
      <Zoom />
    </div>
  )
}

export default ToolBar
