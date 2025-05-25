import React, { useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Element from './Element'
import { useFlattenedIdsData } from '../providers'
import { COLUMN_WIDTH, ROW_HEIGHT } from '../constants'
import { selectElements } from '../controllers/element-selection'
import { useElementSelection } from '../providers'

const Contents: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null)
  const flattenedIds = useFlattenedIdsData()
  const elementSelection = useElementSelection()

  const rowVirtualizer = useVirtualizer({
    count: flattenedIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (ROW_HEIGHT + 2) * 4, // padding is 2
    overscan: 5
  })

  const handleContentsPanelClick = useCallback(() => {
    selectElements([])
  }, [])

  return (
    <div
      ref={parentRef}
      className={`w-${COLUMN_WIDTH} z-10 dark:bg-panel-darker dark:border-r dark:border-border-dark overflow-y-auto`}
      style={{ gridArea: 'left-sidebar' }}
      onClick={handleContentsPanelClick}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
          const elementId = flattenedIds[virtualRow.index]

          return (
            <div
              key={elementId}
              data-index={index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <Element
                elementId={elementId}
                isSelected={elementSelection.has(elementId)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Contents
