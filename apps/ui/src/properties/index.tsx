import React from 'react'
import { COLUMN_WIDTH } from '../constants'

const Properties: React.FC = () => {
  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-l dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'right-sidebar' }}
    ></div>
  )
}

export default Properties
