import React from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import Element from './Element'
import { flattenedElementIds } from '../states/scene-tree'

const Contents: React.FC = () => {
  useSignals()

  return (
    <div className="bg-green-500" style={{ gridArea: 'left-sidebar' }}>
      {flattenedElementIds.value.map((elementId) => (
        <Element key={elementId} elementId={elementId} />
      ))}
    </div>
  )
}

export default Contents
