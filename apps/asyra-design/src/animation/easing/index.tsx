import React from 'react'
import { COLUMN_WIDTH } from '../../constants'

const Easing: React.FC = () => {
  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-border-dark dark:border-t overflow-y-autor p-4`}
    ></div>
  )
}

export default Easing
