import { ROW_HEIGHT } from '../constants'

const ToolBar = () => {
  return (
    <div
      className={`bg-blue-500 h-${ROW_HEIGHT}`}
      style={{ gridArea: 'header' }}
    >
      ToolBar
    </div>
  )
}

export default ToolBar
