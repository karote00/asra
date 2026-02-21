import React from 'react'
import Header from './header'
import Position from './position'
import Dimension from './dimension'
import Rotation from './rotation'
import VectorPoint from './vector-point'
import { COLUMN_WIDTH } from '../constants'
import {
  useElementSelection,
  usePathEditingVectorId,
  useSelectedVectorPoint
} from '../providers'

const Properties: React.FC = () => {
  const elementSelection = useElementSelection()
  const pathEditingVectorId = usePathEditingVectorId()
  const selectedVectorPoint = useSelectedVectorPoint()
  const showVectorPoint =
    !!selectedVectorPoint &&
    !!pathEditingVectorId &&
    pathEditingVectorId === selectedVectorPoint.elementId

  return (
    <div
      className={`w-${COLUMN_WIDTH} z-10 dark:bg-panel-darker dark:border-l dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'right-sidebar' }}
      data-testid="properties-panel"
    >
      {showVectorPoint && (
        <>
          <Header label="Point" />
          <VectorPoint />
        </>
      )}
      {!showVectorPoint && !!elementSelection.size && (
        <>
          <Header label="Layout" />
          <Position />
          <Dimension />
          <Rotation />
        </>
      )}
    </div>
  )
}

export default Properties
