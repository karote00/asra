import { useCallback } from 'react'
import Core from '../core'
import { ROW_HEIGHT } from '../constants'

const ToolBar = () => {
  const handleAddNewElement = useCallback(() => {
    Core.addRectangle()
  }, [Core])

  return (
    <div
      className={`bg-blue-500 h-${ROW_HEIGHT}`}
      style={{ gridArea: 'header' }}
    >
      ToolBar
      <button
        className="bg-neutral-700 text-white"
        onClick={handleAddNewElement}
      >
        Add Element
      </button>
    </div>
  )
}

export default ToolBar
