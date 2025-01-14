import { useCallback } from 'react'
import { Button } from '@asra/design-system'

import ThemeToggle from './theme-toggle'
import { ROW_HEIGHT } from '../constants'
import { sceneTreeManager } from '../states/data-context'

const ToolBar = () => {
  const handleAddNewElement = useCallback(() => {
    sceneTreeManager.addRectangle()
  }, [sceneTreeManager])

  return (
    <div
      className={`h-12 dark:bg-panel-darker dark:border-b dark:border-border-dark flex items-center px-4 justify-between h-${ROW_HEIGHT} px-4`}
      style={{ gridArea: 'header' }}
    >
      <Button
        onClick={handleAddNewElement}
        variant="secondary"
        label="Add new Element"
      />
      <ThemeToggle />
    </div>
  )
}

export default ToolBar
