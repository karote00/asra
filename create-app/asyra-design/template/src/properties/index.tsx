import React from 'react'
import { COLUMN_WIDTH } from '../constants'
import {
  useElementDataMap,
  useElementSelection,
  usePathEditingVectorId,
  useSelectedVectorPoint
} from '../providers'
import ElementPropertiesPanel from './panels/element-properties-panel'
import VectorPointPropertiesPanel from './panels/vector-point-properties-panel'

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  rect: 'rectangle',
  oval: 'oval',
  vector: 'vector path',
  frame: 'frame',
  group: 'group',
  workspace: 'workspace',
  element: 'element'
}

const toSentenceCase = (value: string) => {
  if (!value) {
    return ''
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

const getElementSelectionLabel = (
  elementSelection: Set<string>,
  elementDataMap: Record<string, { type?: string }>
) => {
  const types = new Set<string>()
  elementSelection.forEach((elementId) => {
    const type = elementDataMap[elementId]?.type
    if (type) {
      types.add(type)
    }
  })

  if (types.size === 1) {
    const type = types.values().next().value as string
    const rawLabel = ELEMENT_TYPE_LABELS[type] ?? type.replace(/[-_]/g, ' ')
    return toSentenceCase(rawLabel)
  }

  if (types.size > 1) {
    return 'Selection'
  }

  return 'Element'
}

const Properties: React.FC = () => {
  const elementSelection = useElementSelection()
  const elementDataMap = useElementDataMap()
  const pathEditingVectorId = usePathEditingVectorId()
  const selectedVectorPoint = useSelectedVectorPoint()
  const showVectorPoint =
    !!selectedVectorPoint &&
    !!pathEditingVectorId &&
    pathEditingVectorId === selectedVectorPoint.elementId
  const elementTitle = getElementSelectionLabel(
    elementSelection,
    elementDataMap
  )
  const title = pathEditingVectorId ? 'Vector' : elementTitle
  let panelContent = (
    <div className="flex items-center justify-center h-full">
      <span className="text-[11px] text-[#555]">No selection</span>
    </div>
  )
  if (elementSelection.size) {
    panelContent = <ElementPropertiesPanel title={title} />
  }
  if (showVectorPoint) {
    panelContent = <VectorPointPropertiesPanel title={title} />
  }

  return (
    <div
      className={`w-${COLUMN_WIDTH} z-10 overflow-y-auto text-white`}
      style={{
        gridArea: 'right-sidebar',
        background: '#252525',
        borderLeft: '1px solid #1a1a1a'
      }}
      data-testid="properties-panel"
    >
      {panelContent}
    </div>
  )
}

export default Properties
