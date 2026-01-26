import React from 'react'
import { COLUMN_WIDTH } from '../../constants'

const Tree: React.FC = () => {
  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-r dark:border-t dark:border-border-dark overflow-y-auto`}
    ></div>
  )
}

export default Tree
