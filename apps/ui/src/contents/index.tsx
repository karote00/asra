import React from 'react'
import Element from './Element'
import { useFlattenedIdsData } from '../providers'
import { COLUMN_WIDTH } from '../constants'

const Contents: React.FC = () => {
  const flattenedIds = useFlattenedIdsData()

  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-r dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'left-sidebar' }}
    >
      {flattenedIds.map((elementId) => (
        <Element key={elementId} elementId={elementId} />
      ))}
    </div>
  )
}

export default Contents
