import React, { useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Element from './Element'
import { useFlattenedIdsData } from '../providers'
import { COLUMN_WIDTH, ROW_HEIGHT } from '../constants'
import { selectElements } from '../controllers/element-selection'
import { setHoveredElementId } from '../controllers/hovered-element'
import { useElementSelection, useHoveredElementId } from '../providers'

const Contents: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null)
  const flattenedIds = useFlattenedIdsData()
  const elementSelection = useElementSelection()
  const hoveredElementId = useHoveredElementId()
  const rowVirtualizer = useVirtualizer({
    count: flattenedIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (ROW_HEIGHT + 2) * 4, // padding is 2
    overscan: 5
  })

  const handleContentsPanelClick = useCallback(() => {
    selectElements([])
  }, [])
  const handleContentsPanelMouseLeave = useCallback(() => {
    setHoveredElementId(null)
  }, [])

  return (
    <div
      ref={parentRef}
      className={`w-${COLUMN_WIDTH} z-10 overflow-y-auto flex flex-col`}
      style={{
        gridArea: 'left-sidebar',
        background: '#252525',
        borderRight: '1px solid #1a1a1a'
      }}
      onClick={handleContentsPanelClick}
      onMouseLeave={handleContentsPanelMouseLeave}
      data-testid="contents-panel"
    >
      {/* Panel header */}
      <div
        className="flex items-center px-3 flex-shrink-0"
        style={{
          height: '40px',
          minHeight: '40px',
          borderBottom: '1px solid #2c2c2c'
        }}
      >
        <span className="text-[11px] font-medium text-[#999]">Layers</span>
      </div>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto">
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
                  isHovered={hoveredElementId === elementId}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Contents
