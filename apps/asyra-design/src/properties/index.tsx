import React from 'react'
import { COLUMN_WIDTH } from '../constants'
import {
  useElementSelection,
  usePathEditingVectorId,
  useSelectedVectorPoint
} from '../providers'
import ElementPropertiesPanel from './panels/element-properties-panel'
import VectorPointPropertiesPanel from './panels/vector-point-properties-panel'

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
      {showVectorPoint ? (
        <VectorPointPropertiesPanel />
      ) : elementSelection.size ? (
        <ElementPropertiesPanel />
      ) : null}
    </div>
  )
}

export default Properties
