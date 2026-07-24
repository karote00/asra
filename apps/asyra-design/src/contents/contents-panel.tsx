import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Element from './Element'
import { GroupCommandControls } from './GroupCommandControls'
import { projectVisibleLayerRows } from './layer-hierarchy'
import { getVisibleRangeSelection } from './layer-selection'
import { COLUMN_WIDTH, ROW_HEIGHT } from '../constants'
import {
  clearSelection,
  selectElements
} from '../controllers/element-selection'
import { deriveGroupCommandState } from '../controllers/group-commands'
import { setHoveredElementId } from '../controllers/hovered-element'
import {
  useElementSelection,
  useElementDataMap,
  useFlattenedIdsData,
  useHoveredElementId
} from '../providers'

const Contents: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null)
  const flattenedIds = useFlattenedIdsData()
  const elementDataMap = useElementDataMap()
  const elementSelection = useElementSelection()
  const hoveredElementId = useHoveredElementId()
  const lastSelectedId = useRef<string | null>(null)
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set()
  )
  const groupCommandState = useMemo(
    () =>
      deriveGroupCommandState(
        [...elementSelection],
        flattenedIds,
        elementDataMap
      ),
    [elementDataMap, elementSelection, flattenedIds]
  )
  const layerProjection = useMemo(
    () =>
      projectVisibleLayerRows(flattenedIds, elementDataMap, collapsedGroupIds),
    [collapsedGroupIds, elementDataMap, flattenedIds]
  )
  const visibleRows = layerProjection.rows
  const visibleIds = useMemo(
    () => visibleRows.map((row) => row.id),
    [visibleRows]
  )
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getItemKey: (index) => visibleRows[index]?.id ?? index,
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

      const rangeSelection = getVisibleRangeSelection({
        canonicalIds: flattenedIds,
        visibleIds,
        selectedIds: elementSelection,
        anchorId: lastSelectedId.current,
        clickedId: elementId
      })
      if (!rangeSelection) {
        return
      }

      selectElements(rangeSelection.selectedIds)
      lastSelectedId.current = rangeSelection.anchorId
    },
    [elementSelection, flattenedIds, selectElements, visibleIds]
  )
  const handleToggleGroup = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
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
        <GroupCommandControls
          canGroup={groupCommandState.canGroup}
          canUngroup={groupCommandState.canUngroup}
        />
      </div>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto">
        {layerProjection.error ? (
          <div
            role="alert"
            className="px-3 py-2 text-[10px] text-[#f28b82]"
            data-testid="layers-projection-error"
          >
            Layers hierarchy is unavailable.
          </div>
        ) : null}
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
            const row = visibleRows[virtualRow.index]
            const elementId = row.id

            return (
              <div
                key={virtualRow.key}
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
                  depth={row.depth}
                  isGroup={row.isGroup}
                  isExpanded={row.isExpanded}
                  onToggleGroup={handleToggleGroup}
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
