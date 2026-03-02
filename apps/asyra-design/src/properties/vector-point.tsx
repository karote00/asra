import { Input } from '@asyra/design-system'
import { useCallback } from 'react'
import { VECTOR_TOKENS, type VectorPointTarget } from '@asyra/core'
import { elementApis, selectionApis, systemContextApis } from '../common-apis'
import { useSelectedVectorPoint } from '../providers'
import { parseFiniteInputNumber } from './number-input'

const getTargetLabel = (target: VectorPointTarget) => {
  if (target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE) {
    return 'In Handle'
  }

  if (target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE) {
    return 'Out Handle'
  }

  return 'Anchor'
}

const VectorPoint = () => {
  const selectedPoint = useSelectedVectorPoint()
  const elementId = selectedPoint?.elementId ?? null
  const pointId = selectedPoint?.pointId ?? null
  const index = selectedPoint?.index ?? null
  const target = selectedPoint?.target ?? VECTOR_TOKENS.POINT.TARGET.ANCHOR
  const x = selectedPoint?.x ?? null
  const y = selectedPoint?.y ?? null
  const anchorPoint =
    elementId && pointId
      ? (elementApis.getVectorAnchorPointById(elementId, pointId)?.point ??
        null)
      : null
  const pointType = anchorPoint?.type ?? 'sharp'

  const applyTargetSelection = useCallback(
    (
      updatedPoint: {
        point: {
          x: number
          y: number
          inHandle: { x: number; y: number } | null
          outHandle: { x: number; y: number } | null
        }
        index: number
      } | null,
      nextTarget: VectorPointTarget
    ) => {
      if (!elementId || !pointId || !updatedPoint) {
        return false
      }

      const targetPosition =
        nextTarget === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ? { x: updatedPoint.point.x, y: updatedPoint.point.y }
          : nextTarget === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
            ? updatedPoint.point.inHandle
            : updatedPoint.point.outHandle

      if (!targetPosition) {
        return false
      }

      selectionApis.selectVectorPoint({
        elementId,
        pointId,
        target: nextTarget
      })
      // Compatibility mirror during SelectionManager migration.
      systemContextApis.setSelectedVectorPoint({
        elementId,
        pointId,
        index: updatedPoint.index,
        target: nextTarget,
        x: targetPosition.x,
        y: targetPosition.y
      })
      return true
    },
    [elementId, pointId]
  )

  const handleChangeX = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return false
      }

      const nextX = parseFiniteInputNumber(newValue)
      if (nextX === null) {
        return false
      }

      const updatedPoint =
        target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ? elementApis.updateVectorAnchorPointPosition(elementId, pointId, {
              x: nextX,
              y
            })
          : elementApis.updateVectorAnchorPointHandlePosition(
              elementId,
              pointId,
              target,
              {
                x: nextX,
                y
              }
            )
      return applyTargetSelection(updatedPoint, target)
    },
    [elementId, pointId, x, y, target, applyTargetSelection]
  )

  const handleChangeY = useCallback(
    (newValue: string) => {
      if (!elementId || !pointId || x === null || y === null) {
        return false
      }

      const nextY = parseFiniteInputNumber(newValue)
      if (nextY === null) {
        return false
      }

      const updatedPoint =
        target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
          ? elementApis.updateVectorAnchorPointPosition(elementId, pointId, {
              x,
              y: nextY
            })
          : elementApis.updateVectorAnchorPointHandlePosition(
              elementId,
              pointId,
              target,
              {
                x,
                y: nextY
              }
            )
      return applyTargetSelection(updatedPoint, target)
    },
    [elementId, pointId, x, y, target, applyTargetSelection]
  )

  const handleChangePointType = useCallback(
    (newType: 'smooth' | 'sharp') => {
      if (!elementId || !pointId) {
        return
      }

      const updatedPoint = elementApis.updateVectorAnchorPointType(
        elementId,
        pointId,
        newType
      )
      applyTargetSelection(updatedPoint, VECTOR_TOKENS.POINT.TARGET.ANCHOR)
    },
    [elementId, pointId, applyTargetSelection]
  )

  if (!elementId || !pointId || x === null || y === null || !anchorPoint) {
    return null
  }

  return (
    <>
      <div
        className="px-3 pt-2 text-xs text-gray-400"
        data-testid="prop-point-id"
      >
        Point {index !== null ? index + 1 : '-'} - {getTargetLabel(target)}
      </div>
      <div
        className="px-3 pt-1 text-[11px] text-gray-400"
        data-testid="prop-point-target"
      >
        Target: {getTargetLabel(target)}
      </div>
      {target === VECTOR_TOKENS.POINT.TARGET.ANCHOR && (
        <div className="px-3 pt-2 pb-1">
          <label
            className="block text-[11px] text-gray-400 pb-1"
            htmlFor="point-type"
          >
            Point Type
          </label>
          <select
            id="point-type"
            value={pointType}
            onChange={(event) =>
              handleChangePointType(event.target.value as 'smooth' | 'sharp')
            }
            className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-400"
            data-testid="prop-point-type"
          >
            <option value="sharp">Sharp</option>
            <option value="smooth">Smooth</option>
          </select>
        </div>
      )}
      <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
        <div className="w-1/2">
          <Input
            value={x}
            prefix="X"
            onChange={handleChangeX}
            data-testid="prop-point-x"
          />
        </div>
        <div className="w-1/2">
          <Input
            value={y}
            prefix="Y"
            onChange={handleChangeY}
            data-testid="prop-point-y"
          />
        </div>
      </div>
    </>
  )
}

export default VectorPoint
