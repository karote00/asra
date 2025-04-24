import React from 'react'
import Header from './header'
import Position from './position'
import Dimension from './dimension'
import { COLUMN_WIDTH } from '../constants'
import { useElementSelection } from '../providers'
// import Rotation from './rotation'

const Properties: React.FC = () => {
  const elementSelection = useElementSelection()

  return (
    <div
      className={`w-${COLUMN_WIDTH} z-10 dark:bg-panel-darker dark:border-l dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'right-sidebar' }}
    >
      {elementSelection.size && (
        <>
          <Header label="Layout" />
          <Position />
          <Dimension />
          {/* <Rotation /> */}
        </>
      )}
    </div>
  )
}

export default Properties
