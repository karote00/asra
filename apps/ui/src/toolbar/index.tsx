import { useCallback } from 'react'
import { Button } from '@asra/design-system'

import ThemeToggle from './theme-toggle'
import { ROW_HEIGHT } from '../constants'
import { addRectangle } from '../controllers/scene-tree'
import Zoom from './zoom'

const ToolBar = () => {
  const handleAddNewElement = useCallback(() => {
    addRectangle()
  }, [addRectangle])

  return (
    <div
      className={`h-12 z-10 dark:bg-panel-darker dark:border-b dark:border-border-dark flex items-center px-4 justify-between h-${ROW_HEIGHT} px-4`}
      style={{ gridArea: 'header' }}
    >
      <Button
        onClick={handleAddNewElement}
        variant="secondary"
        label="Add new Element"
      />
      <ThemeToggle />
      <Zoom />
    </div>
  )
}

export default ToolBar
