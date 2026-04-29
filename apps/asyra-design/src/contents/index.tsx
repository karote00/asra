import React, { useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Element from './Element'
import { useFlattenedIdsData } from '../providers'
import { COLUMN_WIDTH, ROW_HEIGHT } from '../constants'
import {
  clearSelection,
  selectElements
} from '../controllers/element-selection'
import { setHoveredElementId } from '../controllers/hovered-element'
import { useElementSelection, useHoveredElementId } from '../providers'

const Contents: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null)
  const flattenedIds = useFlattenedIdsData()
  const elementSelection = useElementSelection()
  const hoveredElementId = useHoveredElementId()
  const lastSelectedId = useRef<string | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: flattenedIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (ROW_HEIGHT + 2) * 4, // padding is 2
    overscan: 5
  })

  const handleContentsPanelClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])
  const handleContentsPanelMouseLeave = useCallback(() => {
    setHoveredElementId(null)
  }, [])
  const handleElementSelect = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, elementId: string) => {
      if (!event.shiftKey) {
        selectElements([elementId])
        lastSelectedId.current = elementId
        return
      }

      if (!flattenedIds.length) {
        return
      }

      const clickedIndex = flattenedIds.indexOf(elementId)
      if (clickedIndex === -1) {
        return
      }

      if (elementSelection.size === 0) {
        selectElements([elementId])
        lastSelectedId.current = elementId
        return
      }

      let anchorId = lastSelectedId.current
      if (!anchorId || !elementSelection.has(anchorId)) {
        anchorId = flattenedIds.find((id) => elementSelection.has(id)) ?? null
      }

      if (!anchorId) {
        selectElements([elementId])
        lastSelectedId.current = elementId
        return
      }

      const anchorIndex = flattenedIds.indexOf(anchorId)
      if (anchorIndex === -1) {
        selectElements([elementId])
        lastSelectedId.current = elementId
        return
      }

      const start = Math.min(anchorIndex, clickedIndex)
      const end = Math.max(anchorIndex, clickedIndex)
      const nextSelection = new Set(elementSelection)
      for (let i = start; i <= end; i += 1) {
        nextSelection.add(flattenedIds[i])
      }

      const orderedSelection = flattenedIds.filter((id) =>
        nextSelection.has(id)
      )

      selectElements(orderedSelection)
      lastSelectedId.current = elementId
    },
    [elementSelection, flattenedIds, selectElements]
  )

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
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <Element
                  elementId={elementId}
                  isSelected={elementSelection.has(elementId)}
                  isHovered={hoveredElementId === elementId}
                  onSelect={handleElementSelect}
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
