import React from 'react'
import { COLUMN_WIDTH } from '../constants'
import Position from './position'
import Dimension from './dimension'
import Rotation from './rotation'
import Header from './header'

const Properties: React.FC = () => {
  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-l dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'right-sidebar' }}
    >
      <Header label="Layout" />
      <Position />
      <Dimension />
      <Rotation />
    </div>
  )
}

export default Properties
