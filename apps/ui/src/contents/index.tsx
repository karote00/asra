import React from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import Element from './Element'
import { flattenedElementIds } from '../states/scene-tree'
import { COLUMN_WIDTH } from '../constants'

const Contents: React.FC = () => {
  useSignals()

  return (
    <div
      className={`w-${COLUMN_WIDTH} dark:bg-panel-darker dark:border-r dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'left-sidebar' }}
    >
      {flattenedElementIds.value.map((elementId) => (
        <Element key={elementId} elementId={elementId} />
      ))}
    </div>
  )
}

export default Contents
