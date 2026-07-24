import React, {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
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
import { resolveLayerPointerTarget } from '../controllers/layer-dom-drop-target'
import {
  type LayerDropIntent,
  projectLayerDropIntent
} from '../controllers/layer-drop-intent'
import {
  cancelLayerHierarchyMoveSession,
  endLayerHierarchyMoveSession,
  startLayerHierarchyMoveSession,
  updateLayerHierarchyMoveSession
} from '../controllers/layer-move-session'
import {
  deriveLayerMoveSource,
  type LayerMoveSourcePlan
} from '../controllers/layer-move-source'
import {
  cancelLayerPointerSession,
  createLayerPointerSession,
  endLayerPointerSession,
  isLayerPointerBypassTarget,
  type LayerPointerCancellationReason,
  type LayerPointerSession,
  updateLayerPointerSession
} from '../controllers/layer-pointer-session'
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
  const activeLayerMove = useRef<{
    pointerSession: LayerPointerSession
    source: LayerMoveSourcePlan
  } | null>(null)
  const suppressNextClick = useRef(false)
  const clickSuppressionGeneration = useRef(0)
  const [dropIntent, setDropIntent] = useState<LayerDropIntent | null>(null)
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

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClick.current) {
      return false
    }
    suppressNextClick.current = false
    return true
  }, [])
  const armImmediateClickSuppression = useCallback(() => {
    suppressNextClick.current = true
    const generation = clickSuppressionGeneration.current + 1
    clickSuppressionGeneration.current = generation
    window.setTimeout(() => {
      if (clickSuppressionGeneration.current === generation) {
        suppressNextClick.current = false
      }
    }, 0)
  }, [])
  const handleContentsPanelClick = useCallback(() => {
    if (consumeSuppressedClick()) {
      return
    }
    clearSelection()
  }, [consumeSuppressedClick])
  const handleContentsPanelMouseLeave = useCallback(() => {
    setHoveredElementId(null)
  }, [])
  const handleElementSelect = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, elementId: string) => {
      if (consumeSuppressedClick()) {
        return
      }
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
    [
      consumeSuppressedClick,
      elementSelection,
      flattenedIds,
      selectElements,
      visibleIds
    ]
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

  const clearLayerMovePresentation = useCallback((pointerId?: number) => {
    activeLayerMove.current = null
    setDropIntent(null)
    const panel = parentRef.current
    if (
      panel &&
      pointerId !== undefined &&
      typeof panel.hasPointerCapture === 'function' &&
      panel.hasPointerCapture(pointerId)
    ) {
      panel.releasePointerCapture(pointerId)
    }
  }, [])

  const getPointerTarget = useCallback(
    (clientX: number, clientY: number) =>
      typeof document.elementFromPoint === 'function'
        ? resolveLayerPointerTarget(
            clientX,
            clientY,
            document.elementFromPoint.bind(document)
          )
        : null,
    []
  )

  const handleLayerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, elementId: string) => {
      if (
        event.button !== 0 ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        isLayerPointerBypassTarget(event.target)
      ) {
        return
      }

      const sourceResult = deriveLayerMoveSource({
        sourceElementId: elementId,
        selectedIds: [...elementSelection],
        flattenedIds,
        elementDataMap
      })
      if (!sourceResult.ok) {
        return
      }

      const pointerSession = createLayerPointerSession({
        pointerId: event.pointerId,
        sourceElementId: elementId,
        clientX: event.clientX,
        clientY: event.clientY
      })
      activeLayerMove.current = {
        pointerSession,
        source: sourceResult.plan
      }
      setDropIntent(null)
      void startLayerHierarchyMoveSession(pointerSession, sourceResult.plan)
        .then((started) => {
          if (
            !started &&
            activeLayerMove.current?.pointerSession.pointerId ===
              event.pointerId
          ) {
            clearLayerMovePresentation(event.pointerId)
          }
        })
        .catch(() => {
          if (
            activeLayerMove.current?.pointerSession.pointerId ===
            event.pointerId
          ) {
            clearLayerMovePresentation(event.pointerId)
          }
        })
    },
    [clearLayerMovePresentation, elementDataMap, elementSelection, flattenedIds]
  )

  const handleLayerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = activeLayerMove.current
      if (!active) {
        return
      }

      const wasDragActive = active.pointerSession.dragActive
      const pointerSession = updateLayerPointerSession(active.pointerSession, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        target: getPointerTarget(event.clientX, event.clientY)
      })
      if (!pointerSession) {
        return
      }

      if (
        !wasDragActive &&
        pointerSession.dragActive &&
        typeof event.currentTarget.setPointerCapture === 'function'
      ) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      active.pointerSession = pointerSession
      const nextDropIntent =
        pointerSession.dragActive && pointerSession.target
          ? projectLayerDropIntent({
              target: pointerSession.target,
              source: active.source,
              flattenedIds,
              elementDataMap,
              collapsedGroupIds
            })
          : null
      setDropIntent(nextDropIntent)
      void updateLayerHierarchyMoveSession(
        pointerSession,
        nextDropIntent
      ).catch(() => {
        if (
          activeLayerMove.current?.pointerSession.pointerId === event.pointerId
        ) {
          clearLayerMovePresentation(event.pointerId)
        }
      })
    },
    [
      clearLayerMovePresentation,
      collapsedGroupIds,
      elementDataMap,
      flattenedIds,
      getPointerTarget
    ]
  )

  const handleLayerPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = activeLayerMove.current
      if (!active) {
        return
      }

      const pointerSession = endLayerPointerSession(active.pointerSession, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        target: getPointerTarget(event.clientX, event.clientY)
      })
      if (!pointerSession) {
        return
      }

      const finalDropIntent =
        pointerSession.dragActive && pointerSession.target
          ? projectLayerDropIntent({
              target: pointerSession.target,
              source: active.source,
              flattenedIds,
              elementDataMap,
              collapsedGroupIds
            })
          : null
      if (pointerSession.dragActive) {
        armImmediateClickSuppression()
      }
      clearLayerMovePresentation(event.pointerId)

      if (pointerSession.dragActive && !pointerSession.target) {
        void cancelLayerHierarchyMoveSession('outside').catch(() => undefined)
        return
      }

      void endLayerHierarchyMoveSession(pointerSession, finalDropIntent)
        .then(() => {
          if (
            finalDropIntent?.kind === 'valid' &&
            finalDropIntent.expandGroupId
          ) {
            setCollapsedGroupIds((current) => {
              const next = new Set(current)
              next.delete(finalDropIntent.expandGroupId as string)
              return next
            })
          }
        })
        .catch(() => undefined)
    },
    [
      armImmediateClickSuppression,
      clearLayerMovePresentation,
      collapsedGroupIds,
      elementDataMap,
      flattenedIds,
      getPointerTarget
    ]
  )

  const cancelActiveLayerMove = useCallback(
    (reason: LayerPointerCancellationReason) => {
      const active = activeLayerMove.current
      if (!active) {
        return
      }
      const cancelled = cancelLayerPointerSession(active.pointerSession, reason)
      if (!cancelled) {
        return
      }
      clearLayerMovePresentation(cancelled.pointerId)
      void cancelLayerHierarchyMoveSession(reason).catch(() => undefined)
    },
    [clearLayerMovePresentation]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelActiveLayerMove('escape')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      cancelActiveLayerMove('unmount')
    }
  }, [cancelActiveLayerMove])

  const getRowDropState = useCallback(
    (elementId: string) => {
      if (!dropIntent || dropIntent.targetElementId !== elementId) {
        return null
      }
      return dropIntent.kind === 'invalid' ? 'invalid' : dropIntent.zone
    },
    [dropIntent]
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
      onPointerMove={handleLayerPointerMove}
      onPointerUp={handleLayerPointerUp}
      onPointerCancel={() => cancelActiveLayerMove('pointer-cancel')}
      onLostPointerCapture={() => cancelActiveLayerMove('lost-capture')}
      data-testid="contents-panel"
      data-layer-move-state={
        dropIntent
          ? dropIntent.kind === 'valid'
            ? 'valid'
            : 'invalid'
          : 'idle'
      }
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
      <div
        className="flex-1 overflow-y-auto"
        data-layer-drop-workspace="true"
        data-layer-drop-state={
          dropIntent?.kind === 'valid' && dropIntent.zone === 'workspace'
            ? 'workspace'
            : undefined
        }
        style={
          dropIntent?.kind === 'valid' && dropIntent.zone === 'workspace'
            ? { boxShadow: 'inset 0 -2px 0 #4db3ff' }
            : undefined
        }
      >
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
                  dropState={getRowDropState(elementId)}
                  onToggleGroup={handleToggleGroup}
                  onSelect={handleElementSelect}
                  onPointerDown={handleLayerPointerDown}
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
