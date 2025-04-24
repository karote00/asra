import React, { useCallback } from 'react'
import Element from './Element'
import { useFlattenedIdsData } from '../providers'
import { COLUMN_WIDTH } from '../constants'
import { selectElements } from '../controllers/element-selection'

const Contents: React.FC = () => {
  const flattenedIds = useFlattenedIdsData()

  const handleContentsPanelClick = useCallback(() => {
    selectElements([])
  }, [])

  return (
    <div
      className={`w-${COLUMN_WIDTH} z-10 dark:bg-panel-darker dark:border-r dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'left-sidebar' }}
      onClick={handleContentsPanelClick}
    >
      {flattenedIds.map((elementId) => (
        <Element key={elementId} elementId={elementId} />
      ))}
    </div>
  )
}

export default Contents
