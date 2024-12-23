import { useCallback } from 'react'
import { Button } from '@asra/design-system'

import Core from '../core'
import { ROW_HEIGHT } from '../constants'

const ToolBar = () => {
  const handleAddNewElement = useCallback(() => {
    Core.addRectangle()
  }, [Core])

  return (
    <div
      className={`bg-secondary-10 h-${ROW_HEIGHT}`}
      style={{ gridArea: 'header' }}
    >
      <Button onClick={handleAddNewElement} label="Add Element" />
    </div>
  )
}

export default ToolBar
